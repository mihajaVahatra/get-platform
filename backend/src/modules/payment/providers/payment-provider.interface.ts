export interface PaymentProvider {
  initiatePayment(data: {
    amount: number;
    currency: string;
    studentId: string;
    reference: string;
    description?: string;
  }): Promise<{
    providerReference: string;
    redirectUrl?: string;
    status: 'PENDING' | 'PROCESSING';
  }>;

  confirmPayment(providerReference: string): Promise<{
    status: 'COMPLETED' | 'FAILED' | 'PENDING';
    providerTransactionId?: string;
    rawData?: any;
  }>;

  refundPayment(providerReference: string): Promise<{
    success: boolean;
    refundId?: string;
  }>;
}
