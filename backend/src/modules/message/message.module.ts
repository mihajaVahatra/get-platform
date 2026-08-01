import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageService } from '../../common/services/storage.service';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';

@Module({
  imports: [PrismaModule],
  controllers: [MessageController],
  providers: [MessageService, StorageService],
  exports: [MessageService],
})
export class MessageModule {}
