import { Module } from '@nestjs/common';
import { LandingService } from './landing.service';
import { LandingController } from './landing.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageService } from '../../common/services/storage.service';

@Module({
  imports: [PrismaModule],
  controllers: [LandingController],
  providers: [LandingService, StorageService],
})
export class LandingModule {}
