import { Module } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { ServiceApiKeyGuard } from './guards/service-api-key.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { MinistryModule } from '../ministry/ministry.module';

@Module({
  imports: [PrismaModule, NotificationModule, MinistryModule],
  controllers: [IntegrationController],
  providers: [IntegrationService, ServiceApiKeyGuard],
})
export class IntegrationModule {}
