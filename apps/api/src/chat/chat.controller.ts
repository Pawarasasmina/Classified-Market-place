import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { QueryConversationsDto } from './dto/query-conversations.dto';
import { SendMessageDto } from './dto/send-message.dto';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  findAll(
    @CurrentUser() user: { id: string },
    @Query() query: QueryConversationsDto,
  ) {
    return this.chatService.findAllForUser(user.id, query);
  }

  @Post('conversations')
  createConversation(
    @CurrentUser() user: { id: string },
    @Body() createConversationDto: CreateConversationDto,
  ) {
    return this.chatService.createConversation(user.id, createConversationDto);
  }

  @Get('conversations/:id')
  findOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.chatService.findOneForUser(user.id, id);
  }

  @Post('conversations/:id/messages')
  sendMessage(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(user.id, id, sendMessageDto);
  }

  @Post('conversations/:id/read')
  markRead(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.chatService.markConversationRead(user.id, id);
  }
}
