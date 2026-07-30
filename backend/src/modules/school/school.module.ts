import { Module } from '@nestjs/common';
import { SchoolService } from './school.service';
import { SchoolController } from './school.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageService } from '../../common/services/storage.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [SchoolController],
  providers: [SchoolService, StorageService],
  exports: [SchoolService],
})
export class SchoolModule {}
