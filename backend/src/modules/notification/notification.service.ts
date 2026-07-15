import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendNotificationDto, NotificationType, NotificationPriority } from './dto/send-notification.dto';
import { NotificationPreferencesDto } from './dto/notification-preferences.dto';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

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
   * Envoie un email.
   * (Simulé pour l'instant)
   */
  private async sendEmail(dto: SendNotificationDto, user: any) {
    // Dans la vraie vie : SendGrid, AWS SES, etc.
    console.log(`📧 Sending email to ${user.email}: ${dto.title}`);
    console.log(`   Body: ${dto.body}`);
    
    // Simuler un délai d'envoi
    await this.delay(500);
    
    return {
      provider: 'EMAIL',
      status: 'SENT',
      providerId: `email-${Date.now()}`,
    };
  }

  /**
   * Envoie un SMS.
   * (Simulé pour l'instant)
   */
  private async sendSms(dto: SendNotificationDto, user: any) {
    const phone = user.student?.phone;
    if (!phone) {
      throw new BadRequestException('User has no phone number');
    }

    console.log(`📱 Sending SMS to ${phone}: ${dto.title}`);
    console.log(`   Body: ${dto.body}`);
    
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
    console.log(`🔔 Sending push notification to user ${user.id}: ${dto.title}`);
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
    console.log(`📨 Sending in-app notification to user ${user.id}: ${dto.title}`);
    
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
  async getUserPreferences(userId: string): Promise<NotificationPreferencesDto> {
    // On peut stocker les préférences dans une table dédiée
    // Pour l'instant, on retourne des valeurs par défaut
    // Dans le futur, on pourrait stocker dans SystemConfig ou une table UserPreferences
    
    // Simuler des préférences par défaut
    return {
      emailEnabled: true,
      smsEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      categories: ['APPLICATION_SUBMITTED', 'PAYMENT_CONFIRMED', 'STATUS_CHANGED', 'WELCOME'],
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

  private isChannelEnabled(type: NotificationType, preferences: NotificationPreferencesDto): boolean {
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
    return new Promise(resolve => setTimeout(resolve, ms));
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
  async sendPaymentConfirmation(userId: string, paymentId: string, amount: number) {
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
  async sendApplicationStatusUpdate(userId: string, applicationId: string, status: string) {
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
