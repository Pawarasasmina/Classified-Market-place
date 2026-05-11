import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  async notifyInactiveRecipient(input: {
    recipientId: string;
    conversationId: string;
    senderName: string;
    preview: string;
  }) {
    this.logger.log(
      `Push fallback queued for user ${input.recipientId} in conversation ${input.conversationId}: ${input.senderName} - ${input.preview}`,
    );
  }
}
