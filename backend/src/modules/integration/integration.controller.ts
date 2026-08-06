import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiParam } from '@nestjs/swagger';
import { ServiceApiKeyGuard } from './guards/service-api-key.guard';
import { IntegrationService } from './integration.service';
import { ListPendingReminderDto } from './dto/list-pending-reminder.dto';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Endpoints réservés aux automatisations n8n (clé API de service, pas de
 * JWT utilisateur). Voir docs/n8n/ pour le cadrage et la justification de
 * chaque route. @Public() est nécessaire ici pour lever le JwtAuthGuard
 * global (cf. app.module.ts) — ServiceApiKeyGuard devient alors la seule
 * porte d'entrée, jamais l'absence totale de garde.
 */
@ApiTags('integration')
@Controller('integration')
@Public()
@UseGuards(ServiceApiKeyGuard)
@ApiSecurity('service-api-key')
export class IntegrationController {
  constructor(private integrationService: IntegrationService) {}

  @Get('applications/pending-reminder')
  @ApiOperation({
    summary:
      'Liste les candidatures encore ouvertes sans mise à jour récente (proxy "dossier incomplet")',
  })
  async listPendingReminder(@Query() query: ListPendingReminderDto) {
    return this.integrationService.listApplicationsPendingReminder(
      query.staleDays ?? 3,
    );
  }

  @Post('applications/:id/reminder')
  @ApiParam({ name: 'id', description: 'Application ID' })
  @ApiOperation({
    summary:
      "Déclenche l'envoi du rappel existant (NotificationService.sendDeadlineReminder) pour une candidature",
  })
  async sendReminder(@Param('id') id: string) {
    return this.integrationService.sendReminder(id);
  }

  @Get('reports/weekly')
  @ApiOperation({
    summary:
      'Indicateurs agrégés des 7 derniers jours (candidatures, admissions, nouveaux comptes, délai moyen de décision)',
  })
  async getWeeklyReport() {
    return this.integrationService.getWeeklyReport();
  }

  @Post('reports/weekly/send')
  @ApiOperation({
    summary:
      "Calcule le rapport hebdomadaire et l'envoie par email à tous les comptes ADMIN_GET actifs",
  })
  async sendWeeklyReport() {
    return this.integrationService.sendWeeklyReport();
  }

  @Post('students/:userId/welcome-email')
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiOperation({
    summary:
      "Déclenche l'envoi du mail de bienvenue existant (NotificationService.sendWelcomeEmail) pour un compte",
  })
  async sendWelcomeEmail(@Param('userId') userId: string) {
    return this.integrationService.sendWelcomeEmail(userId);
  }
}
