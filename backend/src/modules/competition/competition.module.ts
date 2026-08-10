import { Module } from '@nestjs/common';
import { CompetitionService } from './competition.service';
import { CompetitionController } from './competition.controller';
import { PrismaModule } from '../prisma/prisma.module';

/** Module de gestion des concours d'admission (compétitions) organisés par les écoles. */
@Module({
  imports: [PrismaModule],
  controllers: [CompetitionController],
  providers: [CompetitionService],
  exports: [CompetitionService],
})
export class CompetitionModule {}
