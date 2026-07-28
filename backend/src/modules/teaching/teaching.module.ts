import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TeachingController } from './teaching.controller';
import { TeachingService } from './teaching.service';
@Module({
  imports: [PrismaModule],
  controllers: [TeachingController],
  providers: [TeachingService],
})
export class TeachingModule {}
