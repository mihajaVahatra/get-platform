import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { PaymentProvider } from './providers/payment-provider.interface';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaymentService {
  constructor(
    private prisma: PrismaService,
    @Inject('PaymentProvider') private paymentProvider: PaymentProvider,
  ) {}

  async initiatePayment(studentId: string, dto: InitiatePaymentDto) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new NotFoundException('Student not found');

    let amount = dto.amount;

    if (dto.applicationId) {
      const application = await this.prisma.application.findUnique({
        where: { id: dto.applicationId },
        include: { offer: true },
      });
      if (!application) throw new NotFoundException('Application not found');
      if (!dto.amount) {
        amount = application.offer.tuitionFees;
      }
    }

    const reference = `PAY-${Date.now()}-${uuidv4().slice(0, 6)}`;

    const payment = await this.prisma.payment.create({
      data: {
        studentId,
        applicationId: dto.applicationId,
        amount,
        currency: 'MGA',
        method: dto.method,
        reference,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        commission: amount * 0.05,
      },
    });

    const provider = await this.paymentProvider.initiatePayment({
      amount,
      currency: 'MGA',
      studentId,
      reference,
      description: `Paiement pour la candidature ${dto.applicationId || 'N/A'}`,
    });

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerRef: provider.providerReference,
        status: 'PROCESSING',
      },
    });

    return {
      paymentId: payment.id,
      reference,
      redirectUrl: provider.redirectUrl,
      amount,
      status: 'PROCESSING',
    };
  }

  async handleWebhook(dto: PaymentWebhookDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { providerRef: dto.providerReference },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found for this provider reference');
    }

    const confirmation = await this.paymentProvider.confirmPayment(dto.providerReference);

    const status = confirmation.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED';

    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status,
        paidAt: status === 'COMPLETED' ? new Date() : undefined,
        providerRef: dto.providerReference,
      },
    });

    if (status === 'COMPLETED' && payment.applicationId) {
      await this.prisma.application.update({
        where: { id: payment.applicationId },
        data: { status: 'ENROLLED' },
      });
    }

    if (status === 'COMPLETED') {
      await this.prisma.transaction.create({
        data: {
          paymentId: payment.id,
          type: 'PAYMENT',
          amount: payment.amount,
          provider: payment.method,
          providerTransactionId: confirmation.providerTransactionId,
          status: 'SUCCESS',
          rawResponse: confirmation.rawData,
          completedAt: new Date(),
        },
      });
    }

    return updatedPayment;
  }

  async getPayment(paymentId: string, userId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        student: {
          include: {
            user: true,
          },
        },
        transaction: true,
        refund: true,
        application: {
          include: {
            offer: {
              include: {
                school: true,
              },
            },
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    // Vérification d'autorisation simplifiée
    if (payment.student.userId !== userId) {
      // On pourrait vérifier si l'utilisateur est ADMIN_GET ou MINISTRY
      // Pour l'instant, on autorise
    }

    return payment;
  }

  async getHistory(studentId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          application: {
            include: {
              offer: {
                include: {
                  school: true,
                },
              },
            },
          },
          transaction: true,
        },
      }),
      this.prisma.payment.count({ where: { studentId } }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async generateReceipt(paymentId: string, userId: string): Promise<Buffer> {
    const payment = await this.getPayment(paymentId, userId);
    // Pour le moment, on retourne un simple texte
    // Plus tard, on générera un vrai PDF avec PDFKit
    return Buffer.from(`
      RECEIPT
      =======
      Payment ID: ${payment.id}
      Reference: ${payment.reference}
      Amount: ${payment.amount} ${payment.currency}
      Status: ${payment.status}
      Date: ${payment.paidAt || payment.createdAt}
    `);
  }

  async openBankAccount(studentId: string, bankId: string) {
    return {
      accountNumber: `MG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      bankName: 'Banque Partenaire',
      status: 'ACTIVE',
    };
  }

  async getStats(filters?: { from?: Date; to?: Date }) {
    const where: any = {};
    if (filters?.from) where.createdAt = { gte: filters.from };
    if (filters?.to) where.createdAt = { ...where.createdAt, lte: filters.to };

    const totalTransactions = await this.prisma.payment.count({ where });
    const totalAmount = await this.prisma.payment.aggregate({
      where: { status: 'COMPLETED', ...where },
      _sum: { amount: true },
    });
    const byStatus = await this.prisma.payment.groupBy({
      by: ['status'],
      where,
      _count: true,
    });
    const byMethod = await this.prisma.payment.groupBy({
      by: ['method'],
      where: { status: 'COMPLETED', ...where },
      _count: true,
    });

    return {
      totalTransactions,
      totalAmount: totalAmount._sum.amount || 0,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      byMethod: byMethod.map((m) => ({ method: m.method, count: m._count })),
    };
  }
}
