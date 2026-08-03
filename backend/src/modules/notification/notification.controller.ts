import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpStatus,
  UseGuards,
  ParseBoolPipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { NotificationPreferencesDto } from './dto/notification-preferences.dto';
import {
  SendWelcomeEmailDto,
  SendPaymentConfirmationDto,
  SendStatusUpdateDto,
  SendReminderDto,
} from './dto/notification-actions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  // ============================================================
  // 1. ENVOI DE NOTIFICATION (admin / système)
  // ============================================================

  @Post('send')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET', 'MINISTRY')
  @ApiOperation({
    summary: 'Send a notification to a user (Admin/Ministry only)',
  })
  @ApiBody({ type: SendNotificationDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Notification sent' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async sendNotification(@Body() dto: SendNotificationDto) {
    const result = await this.notificationService.send(dto);
    return {
      success: true,
      data: result,
      message: 'Notification sent successfully',
    };
  }

  // ============================================================
  // 2. LISTE DES NOTIFICATIONS DE L'UTILISATEUR
  // ============================================================

  @Get('me')
  @ApiOperation({ summary: 'Get my notifications' })
  @ApiQuery({ name: 'isRead', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiPaginatedResponse(NotificationResponseDto)
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notifications retrieved',
  })
  async getMyNotifications(
    @GetUser('id') userId: string,
    @Query('isRead', new ParseBoolPipe({ optional: true })) isRead?: boolean,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    const result = await this.notificationService.getUserNotifications(userId, {
      isRead,
      page,
      limit,
    });
    return {
      success: true,
      data: result.items,
      meta: result.meta,
      message: 'Notifications retrieved successfully',
    };
  }

  // ============================================================
  // 3. MARCHE COMME LUE
  // ============================================================

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification marked as read',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Notification not found',
  })
  async markAsRead(@Param('id') id: string, @GetUser('id') userId: string) {
    const result = await this.notificationService.markAsRead(id, userId);
    return {
      success: true,
      data: result,
      message: 'Notification marked as read',
    };
  }

  @Put('me/read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'All notifications marked as read',
  })
  async markAllAsRead(@GetUser('id') userId: string) {
    const result = await this.notificationService.markAllAsRead(userId);
    return {
      success: true,
      data: result,
      message: 'All notifications marked as read',
    };
  }

  // ============================================================
  // 4. PRÉFÉRENCES
  // ============================================================

  @Get('preferences')
  @ApiOperation({ summary: 'Get my notification preferences' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Preferences retrieved' })
  async getPreferences(@GetUser('id') userId: string) {
    const preferences =
      await this.notificationService.getUserPreferences(userId);
    return {
      success: true,
      data: preferences,
      message: 'Preferences retrieved successfully',
    };
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update my notification preferences' })
  @ApiBody({ type: NotificationPreferencesDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Preferences updated' })
  async updatePreferences(
    @GetUser('id') userId: string,
    @Body() dto: NotificationPreferencesDto,
  ) {
    const result = await this.notificationService.updatePreferences(
      userId,
      dto,
    );
    return {
      success: true,
      data: result,
      message: 'Preferences updated successfully',
    };
  }

  // ============================================================
  // 5. MÉTHODES SPÉCIFIQUES (pour les templates)
  // ============================================================

  @Post('welcome')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiOperation({ summary: 'Send welcome email (Admin only)' })
  @ApiBody({ type: SendWelcomeEmailDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Welcome email sent',
  })
  async sendWelcomeEmail(@Body() dto: SendWelcomeEmailDto) {
    const result = await this.notificationService.sendWelcomeEmail(dto.userId);
    return {
      success: true,
      data: result,
      message: 'Welcome email sent successfully',
    };
  }

  @Post('payment-confirmation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiOperation({ summary: 'Send payment confirmation (Admin only)' })
  @ApiBody({ type: SendPaymentConfirmationDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Payment confirmation sent',
  })
  async sendPaymentConfirmation(@Body() dto: SendPaymentConfirmationDto) {
    const result = await this.notificationService.sendPaymentConfirmation(
      dto.userId,
      dto.paymentId,
      dto.amount,
    );
    return {
      success: true,
      data: result,
      message: 'Payment confirmation sent successfully',
    };
  }

  @Post('status-update')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET', 'SCHOOL_ADMIN')
  @ApiOperation({
    summary: 'Send application status update (Admin/School Admin)',
  })
  @ApiBody({ type: SendStatusUpdateDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Status update sent',
  })
  async sendStatusUpdate(
    @GetUser() caller: any,
    @Body() dto: SendStatusUpdateDto,
  ) {
    await this.ensureApplicationInCallerSchool(caller, dto.applicationId);
    const result = await this.notificationService.sendApplicationStatusUpdate(
      dto.userId,
      dto.applicationId,
      dto.status,
    );
    return {
      success: true,
      data: result,
      message: 'Status update sent successfully',
    };
  }

  @Post('reminder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET', 'SCHOOL_ADMIN')
  @ApiOperation({ summary: 'Send deadline reminder (Admin/School Admin)' })
  @ApiBody({ type: SendReminderDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Reminder sent' })
  async sendReminder(@GetUser() caller: any, @Body() dto: SendReminderDto) {
    await this.ensureOfferInCallerSchool(caller, dto.offerId);
    const result = await this.notificationService.sendDeadlineReminder(
      dto.userId,
      dto.offerId,
      new Date(dto.deadline),
    );
    return {
      success: true,
      data: result,
      message: 'Reminder sent successfully',
    };
  }

  // Un SCHOOL_ADMIN ne doit pouvoir notifier qu'à propos d'une candidature/
  // offre de sa propre école — ADMIN_GET a une portée plateforme.
  private async ensureApplicationInCallerSchool(
    caller: any,
    applicationId: string,
  ) {
    if (caller.role === 'ADMIN_GET') return;
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { offer: { select: { schoolId: true } } },
    });
    if (!application) throw new NotFoundException('Candidature introuvable');
    if (application.offer.schoolId !== caller.schoolAdmin?.schoolId) {
      throw new ForbiddenException(
        'Cette candidature ne relève pas de votre établissement',
      );
    }
  }

  private async ensureOfferInCallerSchool(caller: any, offerId: string) {
    if (caller.role === 'ADMIN_GET') return;
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      select: { schoolId: true },
    });
    if (!offer) throw new NotFoundException('Offre introuvable');
    if (offer.schoolId !== caller.schoolAdmin?.schoolId) {
      throw new ForbiddenException(
        'Cette offre ne relève pas de votre établissement',
      );
    }
  }

  // ============================================================
  // 6. STATISTIQUES DES NOTIFICATIONS
  // ============================================================

  @Get('platform-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET')
  @ApiOperation({
    summary: 'Get platform-wide notification statistics (Admin only)',
  })
  async getPlatformStats() {
    return {
      success: true,
      data: await this.notificationService.getPlatformStats(),
      message: 'Platform statistics retrieved successfully',
    };
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_GET', 'MINISTRY')
  @ApiOperation({
    summary: 'Get notification statistics (Admin/Ministry only)',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Statistics retrieved' })
  async getStats(@GetUser('id') userId: string) {
    const total = await this.prisma.notification.count({
      where: { userId },
    });
    const unread = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return {
      success: true,
      data: {
        total,
        unread,
        read: total - unread,
        byType: {
          EMAIL: 0,
          SMS: 0,
          PUSH: 0,
          IN_APP: 0,
        },
      },
      message: 'Statistics retrieved successfully',
    };
  }
}
