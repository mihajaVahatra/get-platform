import {
  Injectable,
  NotFoundException,
  Inject,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Prisma, Payment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SchoolService } from '../school/school.service';
import type { PaymentProvider } from './providers/payment-provider.interface';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service des paiements : initiation, confirmation via webhook signé,
 * inscription automatique de l'étudiant après paiement réussi, consultation,
 * historique, génération de reçu PDF et statistiques. Le fournisseur de
 * paiement réel (`PaymentProvider`, injecté sous le token 'PaymentProvider')
 * est interchangeable — voir payment.module.ts pour le choix mock/réel.
 */
@Injectable()
export class PaymentService {
  constructor(
    private prisma: PrismaService,
    @Inject('PaymentProvider') private paymentProvider: PaymentProvider,
    private config: ConfigService,
    private schoolService: SchoolService,
  ) {}

  /**
   * Initie un paiement pour une candidature acceptée de l'étudiant. Le
   * montant provient exclusivement de `application.offer.tuitionFees`
   * (jamais du client). Crée un `Payment` en base (statut PENDING puis
   * PROCESSING) et appelle le fournisseur de paiement externe.
   * @returns id du paiement, référence, URL de redirection fournisseur, montant, statut.
   * @throws NotFoundException si l'étudiant ou la candidature n'existe pas.
   * @throws ForbiddenException si la candidature n'appartient pas à cet étudiant.
   * @throws BadRequestException si la candidature n'est pas ACCEPTED, si le
   * montant est invalide, ou si un paiement est déjà en cours/terminé pour
   * cette candidature (empêche le double paiement).
   */
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

    const reference = `PAY-${Date.now()}-${uuidv4().slice(0, 6)}`;
    const alreadyInProgressMessage = (status: string) =>
      status === 'COMPLETED'
        ? 'Cette candidature a déjà été payée'
        : 'Un paiement est déjà en cours pour cette candidature';

    // Vérifier + créer sous isolation Serializable : sans ça, deux requêtes
    // d'initiation concurrentes pour la même candidature peuvent toutes les
    // deux passer le contrôle "pas de paiement en cours" avant qu'aucune
    // n'ait écrit sa ligne, et créer deux Payment PENDING (cf. audit
    // sécurité). Sous Serializable, Postgres fait échouer l'une des deux
    // transactions (voir catch P2034 ci-dessous) plutôt que de laisser
    // passer l'incohérence.
    let payment: Payment;
    try {
      payment = await this.prisma.$transaction(
        async (tx) => {
          // Un paiement PENDING/PROCESSING dont le délai (15 min) est
          // dépassé n'a pas pu aboutir : le compter comme "en cours"
          // bloquerait définitivement toute nouvelle tentative pour cette
          // candidature (cf. audit sécurité — reprise des paiements expirés).
          await tx.payment.updateMany({
            where: {
              applicationId: application.id,
              status: { in: ['PENDING', 'PROCESSING'] },
              expiresAt: { lt: new Date() },
            },
            data: { status: 'EXPIRED' },
          });

          const existingPayment = await tx.payment.findFirst({
            where: {
              applicationId: application.id,
              status: { in: ['PENDING', 'PROCESSING', 'COMPLETED'] },
            },
            select: { id: true, status: true },
          });
          if (existingPayment) {
            throw new BadRequestException(
              alreadyInProgressMessage(existingPayment.status),
            );
          }

          return tx.payment.create({
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
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2034'
      ) {
        // Conflit de sérialisation Postgres : l'autre initiation concurrente
        // a gagné la course, celle-ci doit être refusée plutôt que retentée
        // silencieusement (le client peut relancer une nouvelle requête).
        throw new BadRequestException(alreadyInProgressMessage('PENDING'));
      }
      throw err;
    }

    try {
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
    } catch (err) {
      // Le paiement existe déjà en base mais le prestataire n'a jamais
      // confirmé la transaction (panne réseau, timeout...) : ne pas le
      // laisser PENDING indéfiniment, ça bloquerait toute nouvelle
      // tentative sur cette candidature jusqu'à l'expiration (15 min).
      await this.prisma.payment
        .update({ where: { id: payment.id }, data: { status: 'FAILED' } })
        .catch(() => undefined);
      throw err;
    }
  }

  /**
   * Traite la notification asynchrone du fournisseur de paiement. Vérifie
   * la signature HMAC, confirme le statut réel auprès du fournisseur
   * (`confirmPayment`, ne fait jamais confiance au seul contenu du webhook),
   * puis effectue en une transaction : mise à jour du paiement, inscription
   * automatique de l'étudiant (StudentEnrollment + synchronisation des
   * cours) et journalisation. Idempotent : un paiement déjà COMPLETED est
   * retourné tel quel sans retraitement (couvre notamment la double
   * réception d'un même webhook).
   * Si la candidature associée n'est plus ACCEPTED/ENROLLED au moment de la
   * confirmation (webhook tardif reçu après une annulation), le candidat
   * n'est jamais inscrit : le paiement reste enregistré fidèlement mais part
   * en réconciliation (ligne `Refund` PENDING, remboursement fournisseur
   * déclenché hors transaction).
   * @throws ForbiddenException si la signature webhook est absente/invalide.
   * @throws NotFoundException si aucun paiement ne correspond à la référence fournisseur.
   * @throws BadRequestException si le montant du webhook diffère du paiement enregistré.
   */
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

    if (confirmation.status === 'PENDING') {
      // Toujours en cours côté prestataire : ne rien conclure maintenant, un
      // webhook ultérieur confirmera COMPLETED ou FAILED. Avant ce correctif,
      // ce cas retombait dans le ternaire ci-dessous et était traité comme
      // FAILED — un paiement légitimement en cours était donc tué prématurément
      // (cf. audit sécurité).
      return payment;
    }
    const status = confirmation.status; // 'COMPLETED' | 'FAILED' à ce stade

    // Paiement + candidature + inscription + relevé doivent être atomiques :
    // une panne à mi-chemin ne doit jamais laisser un paiement "COMPLETED"
    // sans inscription, ou l'inverse (cf. audit sécurité).
    const result = await this.prisma.$transaction(async (tx) => {
      // Webhook tardif : un autre paiement pour la même candidature est déjà
      // COMPLETED (ex. celui-ci a expiré côté app — voir initiatePayment —
      // puis une nouvelle tentative a abouti avant que le prestataire ne
      // confirme finalement celui-ci). L'argent de CE paiement est réel : on
      // l'enregistre fidèlement, mais sans rejouer l'inscription (déjà faite)
      // et en flaguant pour vérification manuelle plutôt que de laisser
      // passer un double encaissement en silence.
      const otherCompleted =
        status === 'COMPLETED' && payment.applicationId
          ? await tx.payment.findFirst({
              where: {
                applicationId: payment.applicationId,
                status: 'COMPLETED',
                id: { not: payment.id },
              },
              select: { id: true },
            })
          : null;

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status,
          paidAt: status === 'COMPLETED' ? new Date() : undefined,
          providerRef: dto.providerReference,
        },
      });

      let requiresRefund: {
        paymentId: string;
        providerReference: string;
      } | null = null;

      if (status === 'COMPLETED' && payment.applicationId && otherCompleted) {
        console.error(
          `[ALERTE RÉCONCILIATION] Paiement ${payment.id} confirmé tardivement pour la candidature ${payment.applicationId}, mais un autre paiement (${otherCompleted.id}) est déjà COMPLETED pour cette même candidature — double encaissement potentiel, vérification manuelle requise.`,
        );
        await tx.applicationTimeline.create({
          data: {
            applicationId: payment.applicationId,
            status: 'ENROLLED',
            note: `⚠️ Webhook tardif : paiement ${payment.reference} confirmé alors qu'un autre paiement est déjà complété pour cette candidature — vérification manuelle requise (remboursement ?).`,
          },
        });
      } else if (status === 'COMPLETED' && payment.applicationId) {
        const application = await tx.application.findUnique({
          where: { id: payment.applicationId },
          include: { offer: true },
        });

        // La machine à états (`APPLICATION_STATUS_TRANSITIONS`) n'autorise
        // qu'ACCEPTED → ENROLLED ou ACCEPTED → CANCELLED : entre l'initiation
        // du paiement (qui exige ACCEPTED) et la confirmation tardive du
        // webhook, la candidature n'a donc pu que rester ACCEPTED, être déjà
        // ENROLLED (webhook rejoué), ou être ANNULÉE. Inscrire un candidat
        // dont la candidature a été annulée entre-temps réactiverait
        // silencieusement un dossier clos — l'argent reçu doit partir en
        // réconciliation/remboursement plutôt que d'être associé à une
        // inscription qui n'a plus lieu d'être (faille corrigée suite à
        // l'audit QA).
        const isEnrollmentEligible =
          application?.status === 'ACCEPTED' ||
          application?.status === 'ENROLLED';

        if (application && !isEnrollmentEligible) {
          console.error(
            `[ALERTE RÉCONCILIATION] Paiement ${payment.id} confirmé pour la candidature ${application.id}, mais son statut (${application.status}) n'autorise plus l'inscription — remboursement requis.`,
          );
          await tx.refund.create({
            data: {
              paymentId: payment.id,
              amount: payment.amount,
              reason: `Webhook de paiement confirmé après passage de la candidature à ${application.status} — remboursement automatique requis`,
              status: 'PENDING',
            },
          });
          await tx.applicationTimeline.create({
            data: {
              applicationId: application.id,
              status: application.status,
              note: `⚠️ Paiement ${payment.reference} confirmé après annulation de la candidature — mis en réconciliation, remboursement en cours.`,
            },
          });
          requiresRefund = {
            paymentId: payment.id,
            providerReference: dto.providerReference,
          };
        } else {
          let program: { id: string; name: string } | null = null;
          let academicYear: { id: string; label: string } | null = null;
          if (application?.offer.programId) {
            [program, academicYear] = await Promise.all([
              tx.schoolProgram.findFirst({
                where: {
                  id: application.offer.programId,
                  schoolId: application.offer.schoolId,
                  isActive: true,
                },
              }),
              tx.schoolAcademicYear.findFirst({
                where: {
                  schoolId: application.offer.schoolId,
                  isCurrent: true,
                },
              }),
            ]);
          }

          if (application && program && academicYear) {
            const enrolledYear = `Année 1 · ${program.name} · ${academicYear.label}`;
            // La candidature ne passe ENROLLED que si l'inscription a
            // effectivement pu être créée (voir branche else ci-dessous) —
            // avant ce correctif, ce statut était posé inconditionnellement
            // dès qu'un paiement était confirmé, y compris quand l'inscription
            // échouait juste après (cf. audit sécurité).
            await tx.application.update({
              where: { id: application.id },
              data: { status: 'ENROLLED' },
            });
            await tx.studentEnrollment.upsert({
              where: {
                studentId_schoolId: {
                  studentId: application.studentId,
                  schoolId: application.offer.schoolId,
                },
              },
              create: {
                studentId: application.studentId,
                schoolId: application.offer.schoolId,
                programId: program.id,
                programLevel: 1,
                academicYearId: academicYear.id,
                enrolledYear,
                status: 'ACTIVE',
              },
              update: {
                programId: program.id,
                programLevel: 1,
                academicYearId: academicYear.id,
                enrolledYear,
                status: 'ACTIVE',
              },
            });
            await this.schoolService.syncCourseEnrollments(
              application.studentId,
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
          } else if (application) {
            // Le paiement est bien confirmé, mais l'inscription automatique
            // n'a pas pu aboutir (offre sans programme lié, ou programme/année
            // académique introuvable). Ne JAMAIS laisser passer ça en silence
            // — un paiement réel sans inscription réelle est le pire des cas.
            // Le statut de la candidature n'est PAS forcé à ENROLLED ici :
            // il reflète la réalité (pas d'inscription effective) plutôt que
            // de mentir sur l'état du dossier.
            const reason = !application.offer.programId
              ? "l'offre n'est liée à aucun programme"
              : 'aucun programme actif ou année académique en cours pour cette école';
            console.error(
              `[ALERTE INSCRIPTION] Paiement confirmé pour la candidature ${application.id} mais inscription automatique impossible : ${reason}.`,
            );
            await tx.applicationTimeline.create({
              data: {
                applicationId: application.id,
                status: application.status,
                note: `⚠️ Paiement confirmé mais inscription automatique impossible (${reason}) — intervention manuelle requise.`,
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

      return { updatedPayment, refund: requiresRefund };
    });

    // Le remboursement effectif se fait hors transaction (appel réseau
    // fournisseur, comme `confirmPayment` plus haut) : la ligne `Refund`
    // PENDING créée dans la transaction ci-dessus garantit qu'aucun paiement
    // tardif de candidature annulée ne reste sans trace même si cet appel
    // échoue — un job de reprise / une vérification manuelle peut se baser
    // dessus (jamais silencieux, cf. audit sécurité).
    if (result.refund) {
      await this.processRefund(
        result.refund.paymentId,
        result.refund.providerReference,
      );
    }

    return result.updatedPayment;
  }

  /**
   * Déclenche le remboursement auprès du fournisseur pour un paiement mis en
   * réconciliation (webhook tardif sur une candidature annulée) et met à
   * jour la ligne `Refund` PENDING déjà créée en conséquence. Best-effort :
   * n'échoue jamais bruyamment (le paiement reste correctement enregistré
   * COMPLETED et la ligne Refund reste PENDING pour reprise/traitement manuel
   * si l'appel fournisseur échoue).
   */
  private async processRefund(paymentId: string, providerReference: string) {
    try {
      const result =
        await this.paymentProvider.refundPayment(providerReference);
      await this.prisma.refund.update({
        where: { paymentId },
        data: {
          status: result.success ? 'COMPLETED' : 'FAILED',
          processedAt: result.success ? new Date() : undefined,
        },
      });
      if (!result.success) {
        console.error(
          `[ALERTE REMBOURSEMENT] Échec du remboursement fournisseur pour le paiement ${paymentId} — intervention manuelle requise.`,
        );
      }
    } catch (error) {
      console.error(
        `[ALERTE REMBOURSEMENT] Erreur lors du remboursement du paiement ${paymentId} :`,
        error,
      );
    }
  }

  /**
   * Récupère un paiement avec ses relations (étudiant, transaction,
   * remboursement, candidature/offre/école).
   * @throws NotFoundException si le paiement n'existe pas.
   * @throws ForbiddenException si l'appelant n'est ni le propriétaire du
   * paiement, ni ADMIN_GET.
   */
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

    if (payment.student.userId !== userId && role !== 'ADMIN_GET') {
      throw new ForbiddenException(
        'Vous n’êtes pas autorisé à consulter ce paiement',
      );
    }

    return payment;
  }

  /** Historique paginé des paiements d'un étudiant, du plus récent au plus ancien. */
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

  /**
   * Génère un reçu PDF pour un paiement (réutilise getPayment pour le
   * contrôle d'accès). Le PDF est construit manuellement sans bibliothèque
   * externe (voir buildReceiptPdf en bas de fichier).
   */
  async generateReceipt(
    paymentId: string,
    userId: string,
    role: string,
  ): Promise<Buffer> {
    const payment = await this.getPayment(paymentId, userId, role);
    const formattedDate = new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(payment.paidAt || payment.createdAt);

    return buildReceiptPdf([
      'REÇU DE PAIEMENT',
      '',
      `Référence : ${payment.reference}`,
      `Montant : ${payment.amount} ${payment.currency}`,
      `Statut : ${payment.status}`,
      `Date : ${formattedDate}`,
    ]);
  }

  /**
   * Simule l'ouverture d'un compte bancaire pour l'étudiant. Implémentation
   * actuelle : aucune intégration bancaire réelle — `studentId`/`bankId` ne
   * sont pas persistés ni utilisés, le numéro de compte est généré
   * localement. À remplacer par un vrai appel fournisseur avant production.
   */
  async openBankAccount(studentId: string, bankId: string) {
    return {
      accountNumber: `MG-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`,
      bankName: 'Banque Partenaire',
      status: 'ACTIVE',
    };
  }

  /**
   * Liste paginée (bornée à 100 éléments max par page) de tous les
   * paiements de la plateforme, avec un résumé condensé par ligne
   * (nom étudiant, école) plutôt que les entités complètes.
   */
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
          student: {
            select: {
              firstName: true,
              lastName: true,
              user: { select: { email: true } },
            },
          },
          application: {
            select: {
              offer: {
                select: { title: true, school: { select: { name: true } } },
              },
            },
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
          [payment.student.firstName, payment.student.lastName]
            .filter(Boolean)
            .join(' ') || payment.student.user.email,
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

// Génère un PDF minimal mais réel (structure %PDF-1.4 valide, sans
// dépendance externe) — même technique que
// `ministry/report-exporter.ts:createPdf`. Corrige SEC-08/HIGH-02 : le
// contrôleur déclarait déjà `Content-Type: application/pdf`, mais le
// contenu envoyé jusqu'ici était du texte brut.
function escapeReceiptPdfText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');
}

function buildReceiptPdf(lines: string[]): Buffer {
  const commands = [
    'BT',
    '/F1 12 Tf',
    '50 780 Td',
    ...lines.flatMap((line, index) => [
      `(${escapeReceiptPdfText(line)}) Tj`,
      ...(index < lines.length - 1 ? ['0 -20 Td'] : []),
    ]),
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(commands, 'latin1')} >>\nstream\n${commands}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let output = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output, 'latin1'));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(output, 'latin1');
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(output, 'latin1');
}
