export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export type CreatePaymentIntentInput = {
  transactionId: string;
  boostId?: string | null;
  userId: string;
  listingId?: string | null;
  amount: string;
  currency: string;
  metadata?: Record<string, unknown>;
};

export type PaymentIntent = {
  provider: string;
  providerRef: string;
  checkoutUrl?: string;
  metadata?: Record<string, unknown>;
};

export type PaymentWebhookEvent = {
  provider: string;
  providerRef: string;
  status: 'succeeded' | 'failed' | 'cancelled' | 'refunded';
  startsAt?: string;
  endsAt?: string;
  durationDays?: number;
  raw?: unknown;
};

export interface PaymentProvider {
  readonly name: string;
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent>;
  parseWebhook(
    payload: unknown,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<PaymentWebhookEvent>;
}
