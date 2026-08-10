import { Module } from '@nestjs/common';
import { FeeBracketService } from './fee-bracket.service';
import { FeeBracketController } from './fee-bracket.controller';
import { PrismaModule } from '../prisma/prisma.module';

/** Module NestJS regroupant le contrôleur et le service des tranches de frais. */
@Module({
  imports: [PrismaModule],
  controllers: [FeeBracketController],
  providers: [FeeBracketService],
  exports: [FeeBracketService],
})
export class FeeBracketModule {}
