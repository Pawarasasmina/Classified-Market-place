import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SellerProfilesController } from './seller-profiles.controller';
import { SellerProfilesService } from './seller-profiles.service';

@Module({
  imports: [NotificationsModule],
  controllers: [SellerProfilesController],
  providers: [SellerProfilesService],
  exports: [SellerProfilesService],
})
export class SellerProfilesModule {}
