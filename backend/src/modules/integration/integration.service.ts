import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ApplicationStatus } from '../application/dto/update-application-status.dto';

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
      },
      select: {
        id: true,
        status: true,
        updatedAt: true,
        offerId: true,
        offer: { select: { applicationDeadline: true, schoolId: true } },
        student: { select: { userId: true } },
      },
      orderBy: { updatedAt: 'asc' },
    });

    return applications.map((application) => ({
      applicationId: application.id,
      status: application.status,
      lastUpdatedAt: application.updatedAt,
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

    return this.notificationService.sendDeadlineReminder(
      application.student.userId,
      application.offerId,
      application.offer.applicationDeadline ?? new Date(),
    );
  }
}
