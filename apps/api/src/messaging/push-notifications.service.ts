import { Injectable, Logger } from '@nestjs/common';
import { MessageType } from '@prisma/client';

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  async notifyInactiveRecipient(input: {
    recipientId: string;
    conversationId: string;
    senderName: string;
    preview: string;
    deepLink: string;
    listingTitle: string | null;
    messageType: MessageType;
  }) {
    this.logger.log(
      `Push fallback queued for user ${input.recipientId} in conversation ${input.conversationId}: ${input.senderName} - ${input.preview} (${input.messageType}) ${input.listingTitle ? `listing=${input.listingTitle} ` : ''}link=${input.deepLink}`,
    );
  }
}
