import { Module } from '@nestjs/common';
import { SchoolService } from './school.service';
import { SchedulingService } from './scheduling.service';
import { ScheduleGenerationService } from './schedule-generation.service';
import { SchoolController } from './school.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageService } from '../../common/services/storage.service';
import { NotificationModule } from '../notification/notification.module';
import { AnnouncementModule } from '../announcement/announcement.module';
import { TeacherAvailabilityModule } from '../teacher-availability/teacher-availability.module';

@Module({
  imports: [
    PrismaModule,
    NotificationModule,
    AnnouncementModule,
    TeacherAvailabilityModule,
  ],
  controllers: [SchoolController],
  providers: [SchoolService, SchedulingService, ScheduleGenerationService, StorageService],
  exports: [SchoolService, SchedulingService],
})
export class SchoolModule {}
