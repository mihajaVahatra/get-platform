import { Module } from '@nestjs/common';
import { ApplicationService } from './application.service';
import { ApplicationController } from './application.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SchoolModule } from '../school/school.module';

@Module({
  imports: [PrismaModule, SchoolModule],
  controllers: [ApplicationController],
  providers: [ApplicationService],
  exports: [ApplicationService],
})
export class ApplicationModule {}
