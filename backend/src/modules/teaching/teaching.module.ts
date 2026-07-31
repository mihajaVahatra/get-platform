import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  TeacherAssignmentsController,
  TeacherEvaluationsController,
  TeacherProfileController,
  TeacherSubmissionsController,
  TeachingController,
} from './teaching.controller';
import { TeachingService } from './teaching.service';
import { NotificationModule } from '../notification/notification.module';
import { StorageService } from '../../common/services/storage.service';
@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [
    TeachingController,
    TeacherEvaluationsController,
    TeacherAssignmentsController,
    TeacherSubmissionsController,
    TeacherProfileController,
  ],
  providers: [TeachingService, StorageService],
})
export class TeachingModule {}
