import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MessagingEncryptionService } from '../messaging/messaging-encryption.service';
import { MessagingModule } from '../messaging/messaging.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

@Module({
  imports: [AuthModule, MessagingModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, MessagingEncryptionService],
  exports: [ChatService],
})
export class ChatModule {}
