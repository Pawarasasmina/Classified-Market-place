import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { MessagingService } from './messaging.service';

@Controller('messaging')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('conversations')
  findConversations(@CurrentUser() user: { id: string }) {
    return this.messagingService.findConversations(user.id);
  }

  @Post('conversations')
  createConversation(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateConversationDto,
  ) {
    return this.messagingService.createConversation(user.id, dto);
  }

  @Get('conversations/:conversationId/messages')
  findMessages(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
  ) {
    return this.messagingService.findMessages(user.id, conversationId);
  }

  @Post('conversations/:conversationId/messages')
  sendMessage(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagingService.sendMessage(user.id, conversationId, dto);
  }

  @Post('conversations/:conversationId/read')
  markRead(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
  ) {
    return this.messagingService.markRead(user.id, conversationId);
  }

  @Patch('messages/:messageId/offer')
  updateOffer(
    @CurrentUser() user: { id: string },
    @Param('messageId') messageId: string,
    @Body() dto: UpdateOfferDto,
  ) {
    return this.messagingService.updateOffer(user.id, messageId, dto);
  }
}
