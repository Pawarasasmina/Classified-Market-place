import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { SellerProfilesModule } from '../seller-profiles/seller-profiles.module';
import { BoostExpirationService } from './boost-expiration.service';
import { BoostsController } from './boosts.controller';
import { BoostsService } from './boosts.service';

@Module({
  imports: [PaymentsModule, NotificationsModule, SellerProfilesModule],
  controllers: [BoostsController],
  providers: [BoostsService, BoostExpirationService],
  exports: [BoostsService],
})
export class BoostsModule {}
