import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CreatePaymentIntentInput,
  PaymentIntent,
  PaymentProvider,
  PaymentWebhookEvent,
} from './payment-provider';

function getPublicApiBaseUrl() {
  const configured =
    process.env.API_PUBLIC_URL ?? process.env.PUBLIC_API_URL ?? undefined;

  if (configured) {
    return configured.replace(/\/$/, '');
  }

  return `http://127.0.0.1:${process.env.PORT || 3001}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

@Injectable()
export class DevPaymentProvider implements PaymentProvider {
  readonly name = 'dev';

  async createPaymentIntent(
    input: CreatePaymentIntentInput,
  ): Promise<PaymentIntent> {
    const providerRef = `dev_${randomUUID()}`;

    return {
      provider: this.name,
      providerRef,
      checkoutUrl: `${getPublicApiBaseUrl()}/payments/dev/checkout/${providerRef}`,
      metadata: {
        boostId: input.boostId ?? null,
        transactionId: input.transactionId,
        listingId: input.listingId ?? null,
      },
    };
  }

  async parseWebhook(payload: unknown): Promise<PaymentWebhookEvent> {
    if (!isRecord(payload)) {
      throw new BadRequestException('Invalid dev payment webhook payload');
    }

    const providerRef = payload.providerRef;
    const status = payload.status;

    if (typeof providerRef !== 'string' || !providerRef.trim()) {
      throw new BadRequestException('Dev payment webhook requires providerRef');
    }

    if (
      status !== 'succeeded' &&
      status !== 'failed' &&
      status !== 'cancelled' &&
      status !== 'refunded'
    ) {
      throw new BadRequestException('Dev payment webhook status is invalid');
    }

    return {
      provider: this.name,
      providerRef: providerRef.trim(),
      status,
      startsAt:
        typeof payload.startsAt === 'string' ? payload.startsAt : undefined,
      endsAt: typeof payload.endsAt === 'string' ? payload.endsAt : undefined,
      durationDays:
        typeof payload.durationDays === 'number'
          ? payload.durationDays
          : undefined,
      raw: payload,
    };
  }
}
