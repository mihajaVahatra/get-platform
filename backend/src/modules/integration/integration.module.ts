import { Module } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { ServiceApiKeyGuard } from './guards/service-api-key.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [IntegrationController],
  providers: [IntegrationService, ServiceApiKeyGuard],
})
export class IntegrationModule {}
