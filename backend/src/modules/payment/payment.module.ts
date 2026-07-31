import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { SchoolModule } from '../school/school.module';

@Module({
  imports: [PrismaModule, SchoolModule],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    {
      provide: 'PaymentProvider',
      useClass: MockPaymentProvider,
    },
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
