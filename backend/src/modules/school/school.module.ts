import { Module } from '@nestjs/common';
import { SchoolService } from './school.service';
import { SchoolController } from './school.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageService } from '../../common/services/storage.service';

@Module({
  imports: [PrismaModule],
  controllers: [SchoolController],
  providers: [SchoolService, StorageService],
  exports: [SchoolService],
})
export class SchoolModule {}
