import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { StudentModule } from './modules/student/student.module';
import { SchoolModule } from './modules/school/school.module';
import { OfferModule } from './modules/offer/offer.module';
import { ApplicationModule } from './modules/application/application.module';
import { PaymentModule } from './modules/payment/payment.module';
import { MinistryModule } from './modules/ministry/ministry.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AuditModule } from './modules/audit/audit.module';
import { MessageModule } from './modules/message/message.module';
import { TeachingModule } from './modules/teaching/teaching.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60,
          limit: 100,
        },
      ],
    }),
    PrismaModule,
    AuthModule,
    StudentModule,
    SchoolModule,
    OfferModule,
    ApplicationModule,
    PaymentModule,
    MinistryModule,
    NotificationModule,
    AuditModule,
    MessageModule,
    TeachingModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
