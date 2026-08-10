import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import sgMail from '@sendgrid/mail';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import {
  SendNotificationDto,
  NotificationType,
  NotificationPriority,
} from './dto/send-notification.dto';
import { NotificationPreferencesDto } from './dto/notification-preferences.dto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private encryption: EncryptionService,
  ) {}

  async getPlatformStats() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [total, unread, sentLast7Days, recentByTitle] = await Promise.all([
      this.prisma.notification.count(),
      this.prisma.notification.count({ where: { isRead: false } }),
      this.prisma.notification.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.notification.groupBy({
        by: ['title'],
        where: { createdAt: { gte: sevenDaysAgo } },
        _count: { title: true },
        orderBy: { _count: { title: 'desc' } },
        take: 5,
      }),
    ]);

    return {
      total,
      unread,
      read: total - unread,
      sentLast7Days,
      topRecentTitles: recentByTitle.map((row) => ({
        title: row.title,
        count: row._count.title,
      })),
    };
  }

  async sendInAppBatch(
    userIds: string[],
    content: { title: string; body: string },
  ): Promise<Array<{ userId: string; notificationId: string }>> {
    const recipientIds = [...new Set(userIds)];
    const recipients: Array<{ userId: string; notificationId: string }> = [];
    const batchSize = 25;

    for (let index = 0; index < recipientIds.length; index += batchSize) {
      const results = await Promise.all(
        recipientIds.slice(index, index + batchSize).map(async (userId) => ({
          userId,
          result: (await this.send({
            userId,
            type: NotificationType.IN_APP,
            title: content.title,
            body: content.body,
          })) as { success: boolean; notificationId?: string },
        })),
      );
      for (const { userId, result } of results) {
        if (result.success && result.notificationId) {
          recipients.push({ userId, notificationId: result.notificationId });
        }
      }
    }

    return recipients;
  }

  // ============================================================
  // 1. ENVOI DE NOTIFICATION (principal)
  // ============================================================

  /**
   * Envoie une notification à un utilisateur.
   * Vérifie d'abord les préférences de l'utilisateur.
   */
  async send(dto: SendNotificationDto): Promise<any> {
    // Vérifier que l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: { student: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // Vérifier les préférences de l'utilisateur
    const preferences = await this.getUserPreferences(dto.userId);

    // Vérifier si l'utilisateur a activé ce canal
    const isChannelEnabled = this.isChannelEnabled(dto.type, preferences);
    if (!isChannelEnabled) {
      console.log(`Notification ${dto.type} disabled for user ${dto.userId}`);
      return { success: false, reason: 'Channel disabled' };
    }

    // Envoyer la notification selon le type
    let result;
    switch (dto.type) {
      case NotificationType.EMAIL:
        result = await this.sendEmail(dto, user);
        break;
      case NotificationType.SMS:
        result = await this.sendSms(dto, user);
        break;
      case NotificationType.PUSH:
        result = await this.sendPush(dto, user);
        break;
      case NotificationType.IN_APP:
        result = await this.sendInApp(dto, user);
        break;
      default:
        throw new BadRequestException('Unsupported notification type');
    }

    // Enregistrer la notification en base
    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        data: dto.data,
        sentAt: new Date(),
      },
    });

    return {
      success: true,
      notificationId: notification.id,
      providerResult: result,
    };
  }

  // ============================================================
  // 2. ENVOI PAR CANAL
  // ============================================================

  /**
   * Envoie un email à un utilisateur existant.
   */
  private async sendEmail(dto: SendNotificationDto, user: any) {
    return this.dispatchEmail(user.email, dto.title, dto.body);
  }

  /**
   * Envoie un email directement, sans passer par le système de notification
   * (qui exige un User existant en base, et persiste le corps du message
   * dans Notification.body). Utilisé pour les emails porteurs d'un secret
   * à usage unique (vérification d'adresse email, réinitialisation de mot
   * de passe) : ni la table de notifications, ni les logs, ne doivent
   * conserver ce genre de lien indéfiniment.
   * @param redactBody Si vrai, le corps du message n'est jamais écrit dans
   * les logs (y compris en simulation dev) — utilisé pour les emails
   * contenant un secret (voir AuthService.forgotPassword).
   */
  async sendRawEmail(params: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    redactBody?: boolean;
  }) {
    return this.dispatchEmail(
      params.to,
      params.subject,
      params.text,
      params.html,
      params.redactBody,
    );
  }

  /**
   * Envoie réellement l'email via SendGrid. Si SENDGRID_API_KEY n'est pas
   * configuré, on ne simule (log local) qu'en dehors de la production — même
   * filet de sécurité que les autres providers "simulés" du projet (voir
   * mock-payment.provider.ts) : en production, un email transactionnel non
   * livré doit être une erreur bruyante, pas un log silencieusement ignoré.
   */
  private async dispatchEmail(
    to: string,
    subject: string,
    text: string,
    html?: string,
    redactBody?: boolean,
  ) {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      const isProduction = this.config.get('NODE_ENV') === 'production';
      const allowSimulated =
        this.config.get('ALLOW_SIMULATED_EMAIL') === 'true';
      if (isProduction && !allowSimulated) {
        throw new Error(
          "SENDGRID_API_KEY manquant en production : impossible d'envoyer un email réel. " +
            'Configurez SendGrid, ou définissez ALLOW_SIMULATED_EMAIL=true en connaissance de cause (démo/staging uniquement).',
        );
      }
      console.log(`📧 [dev] Email à ${to} : ${subject}`);
      console.log(`   ${redactBody ? '[corps masqué — contient un secret]' : text}`);
      return {
        provider: 'EMAIL',
        status: 'SIMULATED',
        providerId: `email-${Date.now()}`,
      };
    }

    sgMail.setApiKey(apiKey);
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'no-reply@get.mg';
    const fromName = process.env.SENDGRID_FROM_NAME || 'GET';

    try {
      const [response] = await sgMail.send({
        to,
        from: { email: fromEmail, name: fromName },
        subject,
        text,
        html: html || text,
      });
      const headers = response.headers as Record<string, string> | undefined;
      return {
        provider: 'SENDGRID',
        status: 'SENT',
        providerId: headers?.['x-message-id'] || `sg-${Date.now()}`,
      };
    } catch (error) {
      this.logger.error(`Échec envoi email SendGrid à ${to}`, error as Error);
      throw error;
    }
  }

  /**
   * Envoie un SMS.
   * (Simulé pour l'instant)
   */
  private async sendSms(dto: SendNotificationDto, user: any) {
    const encryptedPhone = user.student?.phone;
    if (!encryptedPhone) {
      throw new BadRequestException('User has no phone number');
    }

    // Le numéro n'est déchiffré qu'ici, à la frontière de l'envoi réel — ni
    // lui ni le contenu du SMS ne doivent apparaître en clair dans les logs.
    let phone: string;
    try {
      phone = this.encryption.decrypt(encryptedPhone);
    } catch (e) {
      this.logger.error(
        `Échec déchiffrement du numéro pour l'utilisateur ${user.id}`,
        e as Error,
      );
      throw new BadRequestException('Numéro de téléphone illisible');
    }
    void phone; // transmis au prestataire SMS réel une fois intégré

    console.log(`📱 [dev] SMS simulé pour l'utilisateur ${user.id}`);

    await this.delay(300);

    return {
      provider: 'SMS',
      status: 'SENT',
      providerId: `sms-${Date.now()}`,
    };
  }

  /**
   * Envoie une notification push.
   * (Simulé pour l'instant)
   */
  private async sendPush(dto: SendNotificationDto, user: any) {
    console.log(
      `🔔 Sending push notification to user ${user.id}: ${dto.title}`,
    );
    console.log(`   Body: ${dto.body}`);

    await this.delay(200);

    return {
      provider: 'PUSH',
      status: 'SENT',
      providerId: `push-${Date.now()}`,
    };
  }

  /**
   * Envoie une notification in-app.
   * (Stockée en base, affichée dans l'interface)
   */
  private async sendInApp(dto: SendNotificationDto, user: any) {
    console.log(
      `📨 Sending in-app notification to user ${user.id}: ${dto.title}`,
    );

    // Déjà enregistrée en base, pas besoin d'envoyer ailleurs

    return {
      provider: 'IN_APP',
      status: 'STORED',
      providerId: `inapp-${Date.now()}`,
    };
  }

  // ============================================================
  // 3. PRÉFÉRENCES UTILISATEUR
  // ============================================================

  /**
   * Récupère les préférences de notification d'un utilisateur.
   * Si elles n'existent pas, crée des préférences par défaut.
   */
  async getUserPreferences(
    userId: string,
  ): Promise<NotificationPreferencesDto> {
    // On peut stocker les préférences dans une table dédiée
    // Pour l'instant, on retourne des valeurs par défaut
    // Dans le futur, on pourrait stocker dans SystemConfig ou une table UserPreferences

    // Simuler des préférences par défaut
    return {
      emailEnabled: true,
      smsEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      categories: [
        'APPLICATION_SUBMITTED',
        'PAYMENT_CONFIRMED',
        'STATUS_CHANGED',
        'WELCOME',
      ],
    };
  }

  /**
   * Met à jour les préférences de notification d'un utilisateur.
   */
  async updatePreferences(userId: string, dto: NotificationPreferencesDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');

    // Dans le futur, on stockera dans une table dédiée
    // Pour l'instant, on simule la mise à jour
    console.log(`📝 Updated preferences for user ${userId}:`, dto);

    return {
      success: true,
      preferences: dto,
    };
  }

  // ============================================================
  // 4. LECTURE DES NOTIFICATIONS
  // ============================================================

  /**
   * Récupère les notifications d'un utilisateur.
   */
  async getUserNotifications(
    userId: string,
    options?: { isRead?: boolean; page?: number; limit?: number },
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (options?.isRead !== undefined) where.isRead = options.isRead;

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Marque une notification comme lue.
   */
  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Marque toutes les notifications comme lues.
   */
  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return { success: true };
  }

  // ============================================================
  // 5. HELPERS
  // ============================================================

  private isChannelEnabled(
    type: NotificationType,
    preferences: NotificationPreferencesDto,
  ): boolean {
    switch (type) {
      case NotificationType.EMAIL:
        return preferences.emailEnabled;
      case NotificationType.SMS:
        return preferences.smsEnabled;
      case NotificationType.PUSH:
        return preferences.pushEnabled;
      case NotificationType.IN_APP:
        return preferences.inAppEnabled;
      default:
        return true;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================
  // 6. MÉTHODES SPÉCIFIQUES POUR LES TEMPLATES
  // ============================================================

  /**
   * Envoie un email de bienvenue.
   */
  async sendWelcomeEmail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { student: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const dto: SendNotificationDto = {
      userId,
      type: NotificationType.EMAIL,
      title: 'Welcome to GET! 🎓',
      body: `Hello ${user.student?.firstName || ''}, welcome to the GET platform! Start your academic journey today.`,
      priority: NotificationPriority.HIGH,
    };

    return this.send(dto);
  }

  /**
   * Envoie une notification de confirmation de paiement.
   */
  async sendPaymentConfirmation(
    userId: string,
    paymentId: string,
    amount: number,
  ) {
    const dto: SendNotificationDto = {
      userId,
      type: NotificationType.EMAIL,
      title: 'Payment Confirmed ✅',
      body: `Your payment of ${amount} MGA has been confirmed. Payment ID: ${paymentId}`,
      priority: NotificationPriority.HIGH,
      data: { paymentId, amount },
    };

    return this.send(dto);
  }

  /**
   * Envoie une notification de changement de statut de candidature.
   */
  async sendApplicationStatusUpdate(
    userId: string,
    applicationId: string,
    status: string,
  ) {
    const dto: SendNotificationDto = {
      userId,
      type: NotificationType.EMAIL,
      title: 'Application Status Updated',
      body: `Your application #${applicationId} status has changed to: ${status}`,
      priority: NotificationPriority.MEDIUM,
      data: { applicationId, status },
    };

    return this.send(dto);
  }

  /**
   * Envoie une notification de rappel (deadline).
   */
  async sendDeadlineReminder(userId: string, offerId: string, deadline: Date) {
    const dto: SendNotificationDto = {
      userId,
      type: NotificationType.EMAIL,
      title: '⚠️ Deadline Reminder',
      body: `Reminder: The deadline for offer ${offerId} is on ${deadline.toLocaleDateString()}. Don't forget to submit your application!`,
      priority: NotificationPriority.MEDIUM,
      data: { offerId, deadline },
    };

    return this.send(dto);
  }
}
