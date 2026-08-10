import { Module } from '@nestjs/common';
import { ApplicationService } from './application.service';
import { ApplicationController } from './application.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SchoolModule } from '../school/school.module';
import { NotificationModule } from '../notification/notification.module';

/**
 * Regroupe le contrôleur et le service de gestion des candidatures. Dépend du
 * module École (pour la synchronisation des inscriptions/cours) et du module
 * Notification (pour informer les étudiants des changements de statut).
 */
@Module({
  imports: [PrismaModule, SchoolModule, NotificationModule],
  controllers: [ApplicationController],
  providers: [ApplicationService],
  exports: [ApplicationService],
})
export class ApplicationModule {}
