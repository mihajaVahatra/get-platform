import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { MinistryService } from '../ministry/ministry.service';
import { ApplicationStatus } from '../application/dto/update-application-status.dto';
import {
  NotificationType,
  NotificationPriority,
} from '../notification/dto/send-notification.dto';

/**
 * Point d'entrée pour les automatisations n8n. Ne réimplémente aucune
 * règle métier : lit ce qu'il faut pour décider qui relancer, puis délègue
 * l'envoi effectif au service de notification existant.
 *
 * "Candidature en attente de relance" est ici approximé par : statut encore
 * PENDING/UNDER_REVIEW, non mis à jour depuis `staleDays`, et offre encore
 * ouverte à candidature. Ce n'est pas une définition métier de "dossier
 * incomplet" (pièces manquantes) — cette notion n'existe pas encore dans le
 * modèle de données (voir docs/n8n/01-cadrage-et-conception.md) et reste à
 * trancher avant d'aller au-delà de ce proxy.
 */
@Injectable()
export class IntegrationService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private ministryService: MinistryService,
  ) {}

  async listApplicationsPendingReminder(staleDays: number) {
    const staleBefore = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);

    const applications = await this.prisma.application.findMany({
      where: {
        status: {
          in: [ApplicationStatus.PENDING, ApplicationStatus.UNDER_REVIEW],
        },
        updatedAt: { lt: staleBefore },
        offer: { applicationDeadline: { gt: new Date() } },
        // Idempotence : ne pas re-proposer une candidature déjà relancée
        // récemment. Même fenêtre que staleDays — un rappel par période de
        // "silence" observée, pas un par exécution du cron.
        OR: [
          { lastReminderSentAt: null },
          { lastReminderSentAt: { lt: staleBefore } },
        ],
      },
      select: {
        id: true,
        status: true,
        updatedAt: true,
        offerId: true,
        lastReminderSentAt: true,
        offer: { select: { applicationDeadline: true, schoolId: true } },
        student: { select: { userId: true } },
      },
      orderBy: { updatedAt: 'asc' },
    });

    return applications.map((application) => ({
      applicationId: application.id,
      status: application.status,
      lastUpdatedAt: application.updatedAt,
      lastReminderSentAt: application.lastReminderSentAt,
      offerId: application.offerId,
      schoolId: application.offer.schoolId,
      deadline: application.offer.applicationDeadline,
      userId: application.student.userId,
    }));
  }

  async sendReminder(applicationId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        offerId: true,
        offer: { select: { applicationDeadline: true } },
        student: { select: { userId: true } },
      },
    });

    if (!application) {
      throw new NotFoundException('Candidature introuvable');
    }

    const result = await this.notificationService.sendDeadlineReminder(
      application.student.userId,
      application.offerId,
      application.offer.applicationDeadline ?? new Date(),
    );

    await this.prisma.application.update({
      where: { id: applicationId },
      data: { lastReminderSentAt: new Date() },
    });

    return result;
  }

  /**
   * Réutilise MinistryService.getDashboard (agrégats déjà purgés de toute
   * identité — voir son commentaire) pour les candidatures/inscriptions/
   * établissements, et ajoute les deux seuls indicateurs qui n'existaient
   * nulle part : nouveaux comptes et délai moyen de décision sur la
   * période.
   */
  async getWeeklyReport() {
    const to = new Date();
    const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [dashboard, newAccounts, decidedApplications] = await Promise.all([
      this.ministryService.getDashboard({ from, to }),
      this.prisma.user.count({
        where: { createdAt: { gte: from, lte: to } },
      }),
      this.prisma.application.findMany({
        where: {
          decisionDate: { gte: from, lte: to },
          deletedAt: null,
        },
        select: { submittedAt: true, decisionDate: true },
      }),
    ]);

    const averageProcessingDays = decidedApplications.length
      ? decidedApplications.reduce((sum, application) => {
          const days =
            (application.decisionDate!.getTime() -
              application.submittedAt.getTime()) /
            (24 * 60 * 60 * 1000);
          return sum + days;
        }, 0) / decidedApplications.length
      : null;

    return {
      newAccounts,
      decisionsThisWeek: decidedApplications.length,
      averageProcessingDays,
      ...dashboard,
    };
  }

  async sendWelcomeEmail(userId: string) {
    return this.notificationService.sendWelcomeEmail(userId);
  }

  /**
   * Calcule le rapport hebdomadaire et l'envoie à tous les comptes
   * ADMIN_GET, via NotificationService.send (canal EMAIL existant) — pas de
   * liste d'emails à maintenir à part, la source de vérité reste les rôles
   * applicatifs.
   */
  async sendWeeklyReport() {
    const report = await this.getWeeklyReport();

    const admins = await this.prisma.user.findMany({
      where: { role: { name: 'ADMIN_GET' }, isActive: true },
      select: { id: true },
    });

    const body = [
      `Nouveaux comptes (7 jours) : ${report.newAccounts}`,
      `Candidatures totales : ${report.totalApplications}`,
      `Décisions cette semaine : ${report.decisionsThisWeek}`,
      `Taux d'acceptation : ${report.acceptanceRate}%`,
      `Candidatures en attente depuis +48h : ${report.alerts.pendingApplicationsOver48h}`,
      `Écoles actives : ${report.totalSchools}`,
    ].join('\n');

    const results = await Promise.all(
      admins.map((admin) =>
        this.notificationService.send({
          userId: admin.id,
          type: NotificationType.EMAIL,
          title: `Rapport hebdomadaire GET — ${new Date().toLocaleDateString('fr-FR')}`,
          body,
          priority: NotificationPriority.LOW,
          data: report,
        }),
      ),
    );

    return { recipientCount: admins.length, results };
  }
}
