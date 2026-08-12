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
import { AnnouncementModule } from '../announcement/announcement.module';
import { StorageService } from '../../common/services/storage.service';
import { EncryptionService } from '../../common/services/encryption.service';
@Module({
  imports: [PrismaModule, AnnouncementModule],
  controllers: [
    TeachingController,
    TeacherEvaluationsController,
    TeacherAssignmentsController,
    TeacherSubmissionsController,
    TeacherProfileController,
  ],
  providers: [TeachingService, StorageService, EncryptionService],
})
export class TeachingModule {}
