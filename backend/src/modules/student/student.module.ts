import { Module } from '@nestjs/common';
import { StudentService } from './student.service';
import { StudentController } from './student.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EncryptionService } from '../../common/services/encryption.service';
import { StorageService } from '../../common/services/storage.service';

@Module({
  imports: [PrismaModule],
  controllers: [StudentController],
  providers: [StudentService, EncryptionService, StorageService],
  exports: [StudentService],
})
export class StudentModule {}
