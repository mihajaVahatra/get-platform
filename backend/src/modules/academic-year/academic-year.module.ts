import { Module } from '@nestjs/common';
import { AcademicYearService } from './academic-year.service';
import { AcademicYearController } from './academic-year.controller';
import { PrismaModule } from '../prisma/prisma.module';

/** Module de gestion des années scolaires (création, mise à jour, suppression, consultation). */
@Module({
  imports: [PrismaModule],
  controllers: [AcademicYearController],
  providers: [AcademicYearService],
  exports: [AcademicYearService],
})
export class AcademicYearModule {}
