import { Module } from '@nestjs/common';
import { FeeBracketService } from './fee-bracket.service';
import { FeeBracketController } from './fee-bracket.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FeeBracketController],
  providers: [FeeBracketService],
  exports: [FeeBracketService],
})
export class FeeBracketModule {}
