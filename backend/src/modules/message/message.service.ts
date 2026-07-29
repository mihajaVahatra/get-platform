import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';

const userPreview = {
  id: true,
  email: true,
  role: { select: { name: true } },
  student: { select: { firstName: true, lastName: true, avatarUrl: true } },
} as const;

@Injectable()
export class MessageService {
  constructor(private readonly prisma: PrismaService) {}

  async send(senderId: string, dto: SendMessageDto) {
    const recipient = await this.prisma.user.findUnique({
      where: { email: dto.recipientEmail.toLowerCase().trim() },
      select: { id: true },
    });
    if (!recipient) throw new NotFoundException('Destinataire introuvable');
    if (recipient.id === senderId)
      throw new BadRequestException(
        'Vous ne pouvez pas vous envoyer un message',
      );

    const now = new Date();
    const directKey = this.getDirectKey(senderId, recipient.id);
    return this.prisma.$transaction(async (transaction) => {
      const conversationId = randomUUID();
      await transaction.$executeRaw`INSERT INTO "conversations" ("id", "directKey", "lastMessageAt", "createdAt") VALUES (${conversationId}, ${directKey}, ${now}, ${now}) ON CONFLICT ("directKey") DO UPDATE SET "lastMessageAt" = EXCLUDED."lastMessageAt"`;
      const conversations = await transaction.$queryRaw<
        { id: string }[]
      >`SELECT "id" FROM "conversations" WHERE "directKey" = ${directKey}`;
      const persistedConversationId = conversations[0].id;
      await transaction.$executeRaw`INSERT INTO "conversation_participants" ("conversationId", "userId") VALUES (${persistedConversationId}, ${senderId}), (${persistedConversationId}, ${recipient.id}) ON CONFLICT DO NOTHING`;
      const messageId = randomUUID();
      await transaction.$executeRaw`INSERT INTO "messages" ("id", "conversationId", "senderId", "recipientId", "subject", "body", "isRead", "createdAt") VALUES (${messageId}, ${persistedConversationId}, ${senderId}, ${recipient.id}, ${dto.subject.trim()}, ${dto.body.trim()}, false, ${now})`;
      return {
        id: messageId,
        conversationId: persistedConversationId,
        senderId,
        recipientId: recipient.id,
        subject: dto.subject.trim(),
        body: dto.body.trim(),
        createdAt: now,
        sender: await this.getUserPreview(senderId),
        recipient: await this.getUserPreview(recipient.id),
      };
    });
  }

  async getConversations(userId: string, page = 1, limit = 30) {
    const { safePage, safeLimit } = this.pagination(page, limit);
    const where = { userId };
    const offset = (safePage - 1) * safeLimit;
    const [items, counts] = await Promise.all([
      this.prisma.$queryRaw<
        any[]
      >`SELECT c."id", c."lastMessageAt", u."id" AS "participantId", u."email" AS "participantEmail", s."firstName" AS "participantFirstName", s."lastName" AS "participantLastName", s."avatarUrl" AS "participantAvatarUrl", lm."id" AS "messageId", lm."subject", lm."body", lm."createdAt" AS "messageCreatedAt", lm."senderId" AS "messageSenderId", COALESCE(uc."count", 0)::int AS "unreadCount" FROM "conversation_participants" cp JOIN "conversations" c ON c."id" = cp."conversationId" LEFT JOIN "conversation_participants" op ON op."conversationId" = c."id" AND op."userId" <> ${userId} LEFT JOIN "users" u ON u."id" = op."userId" LEFT JOIN "students" s ON s."userId" = u."id" LEFT JOIN LATERAL (SELECT "id", "subject", "body", "createdAt", "senderId" FROM "messages" WHERE "conversationId" = c."id" ORDER BY "createdAt" DESC LIMIT 1) lm ON true LEFT JOIN LATERAL (SELECT COUNT(*) AS "count" FROM "messages" WHERE "conversationId" = c."id" AND "recipientId" = ${userId} AND "isRead" = false) uc ON true WHERE cp."userId" = ${userId} ORDER BY c."lastMessageAt" DESC LIMIT ${safeLimit} OFFSET ${offset}`,
      this.prisma.$queryRaw<
        { count: bigint }[]
      >`SELECT COUNT(*)::bigint AS "count" FROM "conversation_participants" WHERE "userId" = ${userId}`,
    ]);

    const total = Number(counts[0]?.count ?? 0);
    return {
      items: items.map((item) => ({
        id: item.id,
        lastMessageAt: item.lastMessageAt,
        participant: item.participantId
          ? {
              id: item.participantId,
              email: item.participantEmail,
              student: item.participantFirstName
                ? {
                    firstName: item.participantFirstName,
                    lastName: item.participantLastName,
                    avatarUrl: item.participantAvatarUrl,
                  }
                : null,
            }
          : null,
        lastMessage: item.messageId
          ? {
              id: item.messageId,
              subject: item.subject,
              body: item.body,
              createdAt: item.messageCreatedAt,
              senderId: item.messageSenderId,
            }
          : null,
        unreadCount: item.unreadCount,
      })),
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async getThread(
    conversationId: string,
    userId: string,
    page = 1,
    limit = 50,
  ) {
    await this.ensureParticipant(conversationId, userId);
    const { safePage, safeLimit } = this.pagination(page, limit);
    const [items, counts] = await Promise.all([
      this.prisma.$queryRaw<
        any[]
      >`SELECT m.*, su."email" AS "senderEmail", ss."firstName" AS "senderFirstName", ss."lastName" AS "senderLastName", ru."email" AS "recipientEmail", rs."firstName" AS "recipientFirstName", rs."lastName" AS "recipientLastName" FROM "messages" m JOIN "users" su ON su."id" = m."senderId" JOIN "users" ru ON ru."id" = m."recipientId" LEFT JOIN "students" ss ON ss."userId" = su."id" LEFT JOIN "students" rs ON rs."userId" = ru."id" WHERE m."conversationId" = ${conversationId} ORDER BY m."createdAt" ASC LIMIT ${safeLimit} OFFSET ${(safePage - 1) * safeLimit}`,
      this.prisma.$queryRaw<
        { count: bigint }[]
      >`SELECT COUNT(*)::bigint AS "count" FROM "messages" WHERE "conversationId" = ${conversationId}`,
    ]);
    const total = Number(counts[0]?.count ?? 0);
    return {
      items: items.map((item) => ({
        ...item,
        sender: {
          id: item.senderId,
          email: item.senderEmail,
          student: item.senderFirstName
            ? { firstName: item.senderFirstName, lastName: item.senderLastName }
            : null,
        },
        recipient: {
          id: item.recipientId,
          email: item.recipientEmail,
          student: item.recipientFirstName
            ? {
                firstName: item.recipientFirstName,
                lastName: item.recipientLastName,
              }
            : null,
        },
      })),
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async markThreadAsRead(conversationId: string, userId: string) {
    await this.ensureParticipant(conversationId, userId);
    await this.prisma.$transaction([
      this.prisma
        .$executeRaw`UPDATE "messages" SET "isRead" = true, "readAt" = NOW() WHERE "conversationId" = ${conversationId} AND "recipientId" = ${userId} AND "isRead" = false`,
      this.prisma
        .$executeRaw`UPDATE "conversation_participants" SET "lastReadAt" = NOW() WHERE "conversationId" = ${conversationId} AND "userId" = ${userId}`,
    ]);
    return { success: true };
  }

  async getInbox(userId: string, page = 1, limit = 30) {
    return this.findMessages({ recipientId: userId }, page, limit);
  }

  async getSent(userId: string, page = 1, limit = 30) {
    return this.findMessages({ senderId: userId }, page, limit);
  }

  async markAsRead(messageId: string, userId: string) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, recipientId: userId },
      select: { id: true, isRead: true },
    });
    if (!message) throw new NotFoundException('Message introuvable');
    if (message.isRead) return { id: message.id, isRead: true };
    return this.prisma.message.update({
      where: { id: messageId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.message.count({
      where: { recipientId: userId, isRead: false },
    });
    return { count };
  }

  private async ensureParticipant(conversationId: string, userId: string) {
    const participants = await this.prisma.$queryRaw<
      { conversationId: string }[]
    >`SELECT "conversationId" FROM "conversation_participants" WHERE "conversationId" = ${conversationId} AND "userId" = ${userId}`;
    const participant = participants[0];
    if (!participant) throw new NotFoundException('Conversation introuvable');
  }

  private async findMessages(
    where: { recipientId?: string; senderId?: string },
    page: number,
    limit: number,
  ) {
    const { safePage, safeLimit } = this.pagination(page, limit);
    const [items, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        include: {
          sender: { select: userPreview },
          recipient: { select: userPreview },
        },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.message.count({ where }),
    ]);
    return {
      items,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  private pagination(page: number, limit: number) {
    return {
      safePage: Math.max(1, Number(page) || 1),
      safeLimit: Math.min(100, Math.max(1, Number(limit) || 30)),
    };
  }

  private getDirectKey(firstUserId: string, secondUserId: string) {
    return [firstUserId, secondUserId].sort().join(':');
  }

  private async getUserPreview(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: userPreview,
    });
  }
}
