import { Module } from '@nestjs/common';
import { FinancialPartnerService } from './financial-partner.service';
import { FinancialPartnerController } from './financial-partner.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FinancialPartnerController],
  providers: [FinancialPartnerService],
  exports: [FinancialPartnerService],
})
export class FinancialPartnerModule {}
