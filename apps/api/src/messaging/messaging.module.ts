import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MessagingController } from './messaging.controller';
import { MessagingEncryptionService } from './messaging-encryption.service';
import { MessagingGateway } from './messaging.gateway';
import { MessagingPresenceService } from './messaging-presence.service';
import { MessagingService } from './messaging.service';
import { PushNotificationsService } from './push-notifications.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [MessagingController],
  providers: [
    MessagingService,
    MessagingGateway,
    MessagingEncryptionService,
    MessagingPresenceService,
    PushNotificationsService,
  ],
  exports: [MessagingService],
})
export class MessagingModule {}
