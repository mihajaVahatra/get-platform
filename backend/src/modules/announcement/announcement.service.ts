import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';

export type CreateAnnouncementInput = {
  schoolId: string;
  authorId: string;
  title: string;
  body: string;
  targetType: string;
  targetClasses?: string[];
  courseId?: string;
};

/**
 * Point unique de création d'annonce + notification des destinataires.
 * Remplace trois copies quasi identiques (school.service.ts x2,
 * teaching.service.ts x1) qui n'étaient pas transactionnelles : une annonce
 * pouvait se créer sans qu'aucun destinataire ne la reçoive si l'étape
 * suivante échouait. Notifie aussi en un seul aller-retour DB au lieu d'un
 * par destinataire.
 */
@Injectable()
export class AnnouncementService {
  constructor(private prisma: PrismaService) {}

  async createAndNotify(
    input: CreateAnnouncementInput,
    recipientUserIds: string[],
  ): Promise<{ announcementId: string; recipientCount: number }> {
    const uniqueUserIds = [...new Set(recipientUserIds)];

    return this.prisma.$transaction(async (tx) => {
      const announcement = await tx.announcement.create({
        data: {
          schoolId: input.schoolId,
          authorId: input.authorId,
          courseId: input.courseId,
          title: input.title.trim(),
          body: input.body.trim(),
          targetType: input.targetType,
          targetClasses: input.targetClasses ?? [],
        },
      });

      if (uniqueUserIds.length) {
        // Les ids sont générés côté application pour pouvoir relier chaque
        // notification à son destinataire d'annonce en un seul createMany
        // de part et d'autre (createMany ne renvoie pas les lignes créées).
        const rows = uniqueUserIds.map((userId) => ({
          notificationId: uuidv4(),
          userId,
        }));

        await tx.notification.createMany({
          data: rows.map((row) => ({
            id: row.notificationId,
            userId: row.userId,
            type: 'IN_APP',
            title: announcement.title,
            body: announcement.body,
            sentAt: new Date(),
          })),
        });

        await tx.announcementRecipient.createMany({
          data: rows.map((row) => ({
            announcementId: announcement.id,
            userId: row.userId,
            notificationId: row.notificationId,
          })),
        });
      }

      return {
        announcementId: announcement.id,
        recipientCount: uniqueUserIds.length,
      };
    });
  }
}
