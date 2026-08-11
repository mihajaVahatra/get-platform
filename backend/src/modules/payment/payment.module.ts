import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { StripePaymentProvider } from './providers/stripe-payment.provider';
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
        // Fournisseur réel dès que configuré, quel que soit l'environnement
        // (permet de tester Stripe en mode sandbox/test dès le dev local).
        if (config.get<string>('STRIPE_SECRET_KEY')) {
          return new StripePaymentProvider(config);
        }
        const isProduction = config.get('NODE_ENV') === 'production';
        const mockAllowed = config.get('ALLOW_MOCK_PAYMENT') === 'true';
        if (isProduction && !mockAllowed) {
          // Aucun fournisseur de paiement réel n'est configuré : on refuse
          // de démarrer plutôt que de simuler silencieusement des
          // transactions en production (cf. audit sécurité).
          throw new Error(
            "Aucun fournisseur de paiement réel n'est configuré pour la production. " +
              'MockPaymentProvider est désactivé hors développement. ' +
              'Définissez STRIPE_SECRET_KEY (voir DEPLOYMENT.md), ou ALLOW_MOCK_PAYMENT=true ' +
              'en connaissance de cause (démo/staging uniquement, jamais un vrai déploiement).',
          );
        }
        return new MockPaymentProvider();
      },
    },
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
