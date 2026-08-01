import { Module } from '@nestjs/common';
import { FinancialPartnerService } from './financial-partner.service';
import { FinancialPartnerController } from './financial-partner.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageService } from '../../common/services/storage.service';

@Module({
  imports: [PrismaModule],
  controllers: [FinancialPartnerController],
  providers: [FinancialPartnerService, StorageService],
  exports: [FinancialPartnerService],
})
export class FinancialPartnerModule {}
