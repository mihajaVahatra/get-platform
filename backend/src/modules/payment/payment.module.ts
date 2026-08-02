import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { SchoolModule } from '../school/school.module';

@Module({
  imports: [PrismaModule, SchoolModule, ConfigModule],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    {
      provide: 'PaymentProvider',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get('NODE_ENV') === 'production';
        const mockAllowed = config.get('ALLOW_MOCK_PAYMENT') === 'true';
        if (isProduction && !mockAllowed) {
          // Aucun fournisseur de paiement réel n'est encore intégré : on
          // refuse de démarrer plutôt que de simuler silencieusement des
          // transactions en production (cf. audit sécurité).
          throw new Error(
            "Aucun fournisseur de paiement réel n'est configuré pour la production. " +
              'MockPaymentProvider est désactivé hors développement. ' +
              "Intégrez un fournisseur réel avant la mise en production, ou définissez " +
              'ALLOW_MOCK_PAYMENT=true en connaissance de cause (démo/staging uniquement).',
          );
        }
        return new MockPaymentProvider();
      },
    },
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
