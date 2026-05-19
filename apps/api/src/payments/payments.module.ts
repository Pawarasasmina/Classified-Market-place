import { Module } from '@nestjs/common';
import { DevPaymentProvider } from './dev-payment.provider';
import { PAYMENT_PROVIDER } from './payment-provider';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    DevPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      useExisting: DevPaymentProvider,
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
