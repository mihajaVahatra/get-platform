import { Module } from '@nestjs/common';
import { MinistryService } from './ministry.service';
import { MinistryController } from './ministry.controller';
import { PrismaModule } from '../prisma/prisma.module';

/** Regroupe le contrôleur et le service de supervision nationale du ministère. */
@Module({
  imports: [PrismaModule],
  controllers: [MinistryController],
  providers: [MinistryService],
  exports: [MinistryService],
})
export class MinistryModule {}
