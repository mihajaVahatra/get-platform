export interface PaymentProvider {
  /**
   * `reference` (généré une seule fois par Payment, voir PaymentService) doit
   * être transmis au prestataire comme clé d'idempotence lorsque son API en
   * propose une : un retry réseau côté client (ou une relecture de webhook)
   * doit retomber sur la même transaction prestataire plutôt que d'en créer
   * une seconde pour le même paiement.
   */
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
