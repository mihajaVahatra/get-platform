import { Injectable } from '@nestjs/common';
import { PaymentProvider } from './payment-provider.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  private readonly DELAY_MS = 2000;
  private readonly FAILURE_RATE = 0.1;

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
    await this.delay(500);

    const providerReference = `MOCK-${uuidv4().slice(0, 8)}`;

    const redirectUrl = `https://mock-payment.get.mg/confirm?ref=${providerReference}`;

    return {
      providerReference,
      redirectUrl,
      status: 'PENDING',
    };
  }

  async confirmPayment(providerReference: string): Promise<{
    status: 'COMPLETED' | 'FAILED' | 'PENDING';
    providerTransactionId?: string;
    rawData?: any;
  }> {
    await this.delay(this.DELAY_MS);

    const isSuccess = Math.random() > this.FAILURE_RATE;

    if (isSuccess) {
      return {
        status: 'COMPLETED',
        providerTransactionId: `TX-${uuidv4().slice(0, 12)}`,
        rawData: { mock: true, confirmedAt: new Date().toISOString() },
      };
    } else {
      return {
        status: 'FAILED',
        rawData: { error: 'Insufficient funds' },
      };
    }
  }

  async refundPayment(
    providerReference: string,
  ): Promise<{ success: boolean; refundId?: string }> {
    await this.delay(1000);
    return {
      success: true,
      refundId: `REF-${uuidv4().slice(0, 8)}`,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
