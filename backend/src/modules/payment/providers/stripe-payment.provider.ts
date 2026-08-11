import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentProvider } from './payment-provider.interface';

/**
 * Fournisseur de paiement réel via Stripe Checkout — un vrai prestataire de
 * paiement (utilisable en mode test/sandbox avec une clé `sk_test_...`,
 * sans compte professionnel ni vérification KYC, ou en mode réel avec une
 * clé `sk_live_...`), remplace `MockPaymentProvider` en production (faille
 * corrigée suite à l'audit sécurité — voir `payment.module.ts`).
 *
 * MGA (Ariary malgache, seule devise utilisée par ce backend) est une
 * devise "zero-decimal" chez Stripe : le montant est transmis tel quel,
 * sans le multiplier par 100 comme pour une devise à centimes (EUR, USD...).
 *
 * La confirmation ne passe jamais par `confirmPayment` en usage normal (le
 * webhook Stripe natif, vérifié séparément par sa propre signature — voir
 * `PaymentService.handleStripeWebhook` — pousse l'événement dès que le
 * paiement aboutit) ; `confirmPayment` reste implémentée comme filet de
 * sécurité (reprise manuelle, webhook perdu) en interrogeant directement
 * l'API Stripe plutôt que de dépendre uniquement du webhook.
 */
@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  private readonly client: Stripe;
  private readonly successUrl: string;
  private readonly cancelUrl: string;

  constructor(config: ConfigService) {
    const secretKey = config.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error(
        'STRIPE_SECRET_KEY est requis pour utiliser StripePaymentProvider.',
      );
    }
    this.client = new Stripe(secretKey);

    const frontendUrl =
      config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    this.successUrl = `${frontendUrl.replace(/\/$/, '')}/dashboard/student/payments?status=success&session_id={CHECKOUT_SESSION_ID}`;
    this.cancelUrl = `${frontendUrl.replace(/\/$/, '')}/dashboard/student/payments?status=cancelled&session_id={CHECKOUT_SESSION_ID}`;
  }

  async initiatePayment(data: {
    amount: number;
    currency: string;
    studentId: string;
    reference: string;
    description?: string;
  }): Promise<{
    providerReference: string;
    redirectUrl?: string;
    status: 'PENDING' | 'PROCESSING';
  }> {
    const session = await this.client.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        client_reference_id: data.reference,
        line_items: [
          {
            price_data: {
              currency: data.currency.toLowerCase(),
              // Devise zero-decimal (voir docstring de la classe) : le
              // montant MGA est déjà dans sa plus petite unité, aucune
              // conversion en centimes contrairement à EUR/USD.
              unit_amount: Math.round(data.amount),
              product_data: {
                name: data.description || 'Frais de scolarité GET',
              },
            },
            quantity: 1,
          },
        ],
        success_url: this.successUrl,
        cancel_url: this.cancelUrl,
        metadata: { studentId: data.studentId, reference: data.reference },
      },
      // Clé d'idempotence Stripe : un retry réseau côté PaymentService (ou
      // un double appel accidentel) sur la même `reference` retombe sur la
      // même Checkout Session au lieu d'en créer une seconde côté Stripe.
      { idempotencyKey: data.reference },
    );

    return {
      providerReference: session.id,
      redirectUrl: session.url ?? undefined,
      status: 'PENDING',
    };
  }

  async confirmPayment(providerReference: string): Promise<{
    status: 'COMPLETED' | 'FAILED' | 'PENDING';
    providerTransactionId?: string;
    rawData?: any;
  }> {
    const session = await this.client.checkout.sessions.retrieve(
      providerReference,
      { expand: ['payment_intent'] },
    );

    if (session.payment_status === 'paid') {
      return {
        status: 'COMPLETED',
        providerTransactionId: this.extractPaymentIntentId(session),
        rawData: session,
      };
    }
    if (session.status === 'expired') {
      return { status: 'FAILED', rawData: session };
    }
    return { status: 'PENDING', rawData: session };
  }

  async refundPayment(
    providerReference: string,
  ): Promise<{ success: boolean; refundId?: string }> {
    const session = await this.client.checkout.sessions.retrieve(
      providerReference,
      { expand: ['payment_intent'] },
    );
    const paymentIntentId = this.extractPaymentIntentId(session);
    if (!paymentIntentId) {
      // Rien n'a été réellement débité côté Stripe (session non payée) :
      // pas de remboursement à effectuer, ce n'est pas un échec.
      return { success: true };
    }

    const refund = await this.client.refunds.create({
      payment_intent: paymentIntentId,
    });

    return {
      success: refund.status === 'succeeded' || refund.status === 'pending',
      refundId: refund.id,
    };
  }

  /**
   * Vérifie la signature d'un événement webhook Stripe et le décode. Ne
   * fait confiance qu'au contenu signé par la clé `STRIPE_WEBHOOK_SECRET`
   * (jamais au corps brut seul) — voir `PaymentService.handleStripeWebhook`.
   * @throws BadRequestException si la signature est absente/invalide.
   */
  constructWebhookEvent(
    rawBody: Buffer,
    signature: string | undefined,
    webhookSecret: string,
  ): Stripe.Event {
    if (!signature) {
      throw new BadRequestException('Signature webhook Stripe manquante');
    }
    try {
      return this.client.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch {
      throw new BadRequestException('Signature webhook Stripe invalide');
    }
  }

  private extractPaymentIntentId(
    session: Stripe.Checkout.Session,
  ): string | undefined {
    if (!session.payment_intent) return undefined;
    return typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent.id;
  }
}
