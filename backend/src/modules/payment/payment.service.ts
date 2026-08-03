import {
  Injectable,
  NotFoundException,
  Inject,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SchoolService } from '../school/school.service';
import type { PaymentProvider } from './providers/payment-provider.interface';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaymentService {
  constructor(
    private prisma: PrismaService,
    @Inject('PaymentProvider') private paymentProvider: PaymentProvider,
    private config: ConfigService,
    private schoolService: SchoolService,
  ) {}

  async initiatePayment(studentId: string, dto: InitiatePaymentDto) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const application = await this.prisma.application.findUnique({
      where: { id: dto.applicationId },
      include: { offer: true },
    });
    if (!application) throw new NotFoundException('Application not found');
    if (application.studentId !== studentId) {
      throw new ForbiddenException('Cette candidature ne vous appartient pas');
    }
    if (application.status !== 'ACCEPTED') {
      throw new BadRequestException(
        "Cette candidature n'est pas encore acceptée : le paiement n'est possible qu'après une réponse favorable de l'établissement",
      );
    }

    // Le tarif ne vient jamais du client : l'offre est la source de vérité.
    const amount = application.offer.tuitionFees;
    if (amount <= 0) {
      throw new BadRequestException('Montant de paiement invalide');
    }

    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        applicationId: application.id,
        status: { in: ['PENDING', 'PROCESSING', 'COMPLETED'] },
      },
      select: { id: true, status: true },
    });
    if (existingPayment) {
      throw new BadRequestException(
        existingPayment.status === 'COMPLETED'
          ? 'Cette candidature a déjà été payée'
          : 'Un paiement est déjà en cours pour cette candidature',
      );
    }

    const reference = `PAY-${Date.now()}-${uuidv4().slice(0, 6)}`;

    const payment = await this.prisma.payment.create({
      data: {
        studentId,
        applicationId: application.id,
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
      description: `Paiement pour la candidature ${application.id}`,
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

  async handleWebhook(
    dto: PaymentWebhookDto,
    rawBody?: Buffer,
    signature?: string,
  ) {
    this.assertValidWebhookSignature(dto, rawBody, signature);
    const payment = await this.prisma.payment.findFirst({
      where: { providerRef: dto.providerReference },
    });
    if (!payment) {
      throw new NotFoundException(
        'Payment not found for this provider reference',
      );
    }
    if (payment.status === 'COMPLETED') return payment;
    if (dto.amount !== undefined && dto.amount !== payment.amount) {
      throw new BadRequestException('Montant de webhook incohérent');
    }

    const confirmation = await this.paymentProvider.confirmPayment(
      dto.providerReference,
    );

    const status = confirmation.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED';

    // Paiement + candidature + inscription + relevé doivent être atomiques :
    // une panne à mi-chemin ne doit jamais laisser un paiement "COMPLETED"
    // sans inscription, ou l'inverse (cf. audit sécurité).
    return this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status,
          paidAt: status === 'COMPLETED' ? new Date() : undefined,
          providerRef: dto.providerReference,
        },
      });

      if (status === 'COMPLETED' && payment.applicationId) {
        await tx.application.update({
          where: { id: payment.applicationId },
          data: { status: 'ENROLLED' },
        });
        const application = await tx.application.findUnique({
          where: { id: payment.applicationId },
          include: { offer: true },
        });
        if (application?.offer.programId) {
          const [program, academicYear] = await Promise.all([
            tx.schoolProgram.findFirst({
              where: {
                id: application.offer.programId,
                schoolId: application.offer.schoolId,
                isActive: true,
              },
            }),
            tx.schoolAcademicYear.findFirst({
              where: { schoolId: application.offer.schoolId, isCurrent: true },
            }),
          ]);
          if (program && academicYear) {
            const enrolledYear = `Année 1 · ${program.name} · ${academicYear.label}`;
            const student = await tx.student.update({
              where: { id: application.studentId },
              data: {
                enrolledSchoolId: application.offer.schoolId,
                programId: program.id,
                programLevel: 1,
                academicYearId: academicYear.id,
                enrolledYear,
                enrollmentStatus: 'ACTIVE',
              },
            });
            await this.schoolService.syncCourseEnrollments(
              student.id,
              application.offer.schoolId,
              program.id,
              1,
              tx,
            );
            await tx.applicationTimeline.create({
              data: {
                applicationId: application.id,
                status: 'ENROLLED',
                note: `Étudiant inscrit automatiquement : ${enrolledYear}`,
              },
            });
          }
        }
      }

      if (status === 'COMPLETED') {
        await tx.transaction.create({
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
    });
  }

  async getPayment(paymentId: string, userId: string, role: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        student: {
          select: {
            id: true,
            userId: true,
            firstName: true,
            lastName: true,
            user: { select: { id: true, email: true } },
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

    if (
      payment.student.userId !== userId &&
      role !== 'ADMIN_GET' &&
      role !== 'MINISTRY'
    ) {
      throw new ForbiddenException(
        'Vous n’êtes pas autorisé à consulter ce paiement',
      );
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

  async generateReceipt(
    paymentId: string,
    userId: string,
    role: string,
  ): Promise<Buffer> {
    const payment = await this.getPayment(paymentId, userId, role);
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

  async findAllAdmin(
    page = 1,
    limit = 20,
    filters?: { status?: string; from?: Date; to?: Date },
  ) {
    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.from) where.createdAt = { gte: filters.from };
    if (filters?.to) where.createdAt = { ...where.createdAt, lte: filters.to };

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip: (currentPage - 1) * currentLimit,
        take: currentLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          student: { select: { firstName: true, lastName: true, user: { select: { email: true } } } },
          application: {
            select: { offer: { select: { title: true, school: { select: { name: true } } } } },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      items: items.map((payment) => ({
        id: payment.id,
        reference: payment.reference,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        createdAt: payment.createdAt,
        studentName:
          [payment.student.firstName, payment.student.lastName].filter(Boolean).join(' ') ||
          payment.student.user.email,
        school: payment.application?.offer.school.name || null,
      })),
      meta: {
        page: currentPage,
        limit: currentLimit,
        total,
        totalPages: Math.ceil(total / currentLimit),
      },
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

  private assertValidWebhookSignature(
    dto: PaymentWebhookDto,
    rawBody?: Buffer,
    signature?: string,
  ) {
    const secret = this.config.get<string>('PAYMENT_WEBHOOK_SECRET');
    if (!secret || !signature)
      throw new ForbiddenException('Signature webhook manquante');
    // On signe les octets bruts reçus, pas le DTO re-sérialisé après
    // transformation par class-validator (ordre des clés, coercions de
    // type... peuvent différer de ce que l'expéditeur a réellement signé).
    const payload = rawBody ?? Buffer.from(JSON.stringify(dto));
    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    const received = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (
      received.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(received, expectedBuffer)
    ) {
      throw new ForbiddenException('Signature webhook invalide');
    }
  }
}
