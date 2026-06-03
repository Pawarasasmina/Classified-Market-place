import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  imports: [NotificationsModule],
  controllers: [RatingsController],
  providers: [RatingsService, RolesGuard],
  exports: [RatingsService],
})
export class RatingsModule {}
