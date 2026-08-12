import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StripePaymentProvider } from './stripe-payment.provider';

const mockCreate = jest.fn();
const mockRetrieve = jest.fn();
const mockRefundsCreate = jest.fn();
const mockConstructEvent = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create: mockCreate, retrieve: mockRetrieve } },
    refunds: { create: mockRefundsCreate },
    webhooks: { constructEvent: mockConstructEvent },
  }));
});

describe('StripePaymentProvider', () => {
  let provider: StripePaymentProvider;
  let config: { get: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    config = {
      get: jest.fn((key: string) => {
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123';
        if (key === 'FRONTEND_URL') return 'https://app.test';
        return undefined;
      }),
    };
    provider = new StripePaymentProvider(config as unknown as ConfigService);
  });

  it('refuse de démarrer sans STRIPE_SECRET_KEY', () => {
    const noKeyConfig = { get: jest.fn().mockReturnValue(undefined) };
    expect(
      () => new StripePaymentProvider(noKeyConfig as unknown as ConfigService),
    ).toThrow();
  });

  describe('initiatePayment', () => {
    it('crée une Checkout Session avec le montant MGA tel quel (devise zero-decimal, pas de ×100)', async () => {
      mockCreate.mockResolvedValue({
        id: 'cs_test_1',
        url: 'https://checkout.stripe.com/pay/cs_test_1',
      });

      const result = await provider.initiatePayment({
        amount: 500000,
        currency: 'MGA',
        studentId: 'student-1',
        reference: 'PAY-1',
        description: 'Frais de scolarité',
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'payment',
          client_reference_id: 'PAY-1',
          line_items: [
            expect.objectContaining({
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() est typé `any` par @types/jest
              price_data: expect.objectContaining({
                currency: 'mga',
                unit_amount: 500000,
              }),
            }),
          ],
        }),
        { idempotencyKey: 'PAY-1' },
      );
      expect(result).toEqual({
        providerReference: 'cs_test_1',
        redirectUrl: 'https://checkout.stripe.com/pay/cs_test_1',
        status: 'PENDING',
      });
    });
  });

  describe('confirmPayment', () => {
    it('retourne COMPLETED quand la session Stripe est payée', async () => {
      mockRetrieve.mockResolvedValue({
        payment_status: 'paid',
        status: 'complete',
        payment_intent: { id: 'pi_123' },
      });

      const result = await provider.confirmPayment('cs_test_1');

      expect(result).toEqual(
        expect.objectContaining({
          status: 'COMPLETED',
          providerTransactionId: 'pi_123',
        }),
      );
    });

    it('retourne FAILED quand la session a expiré', async () => {
      mockRetrieve.mockResolvedValue({
        payment_status: 'unpaid',
        status: 'expired',
      });

      const result = await provider.confirmPayment('cs_test_1');

      expect(result.status).toBe('FAILED');
    });

    it('retourne PENDING pour une session encore ouverte et non payée', async () => {
      mockRetrieve.mockResolvedValue({
        payment_status: 'unpaid',
        status: 'open',
      });

      const result = await provider.confirmPayment('cs_test_1');

      expect(result.status).toBe('PENDING');
    });
  });

  describe('refundPayment', () => {
    it('rembourse via le payment_intent lié à la session', async () => {
      mockRetrieve.mockResolvedValue({ payment_intent: 'pi_123' });
      mockRefundsCreate.mockResolvedValue({ status: 'succeeded', id: 're_1' });

      const result = await provider.refundPayment('cs_test_1');

      expect(mockRefundsCreate).toHaveBeenCalledWith({
        payment_intent: 'pi_123',
      });
      expect(result).toEqual({ success: true, refundId: 're_1' });
    });

    it('ne tente aucun remboursement si la session n’a jamais été payée', async () => {
      mockRetrieve.mockResolvedValue({ payment_intent: null });

      const result = await provider.refundPayment('cs_test_1');

      expect(mockRefundsCreate).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });

  describe('constructWebhookEvent', () => {
    it('refuse une signature absente sans appeler Stripe', () => {
      expect(() =>
        provider.constructWebhookEvent(Buffer.from('{}'), undefined, 'whsec_x'),
      ).toThrow(BadRequestException);
      expect(mockConstructEvent).not.toHaveBeenCalled();
    });

    it('refuse une signature invalide', () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      expect(() =>
        provider.constructWebhookEvent(
          Buffer.from('{}'),
          'bad-signature',
          'whsec_x',
        ),
      ).toThrow(BadRequestException);
    });

    it('décode un événement correctement signé', () => {
      const fakeEvent = {
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_1' } },
      };
      mockConstructEvent.mockReturnValue(fakeEvent);

      const event = provider.constructWebhookEvent(
        Buffer.from('{}'),
        'good-signature',
        'whsec_x',
      );

      expect(event).toBe(fakeEvent);
    });
  });
});
