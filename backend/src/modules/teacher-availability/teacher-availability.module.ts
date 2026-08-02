import { Module } from '@nestjs/common';
import { TeacherAvailabilityService } from './teacher-availability.service';
import {
  TeacherAvailabilityController,
  TeacherTravelBufferController,
  TeacherConflictsController,
} from './teacher-availability.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TeacherAvailabilityController, TeacherTravelBufferController, TeacherConflictsController],
  providers: [TeacherAvailabilityService],
  exports: [TeacherAvailabilityService],
})
export class TeacherAvailabilityModule {}
