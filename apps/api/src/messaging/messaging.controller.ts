import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { rolesForPermission } from '../common/admin-permissions';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { VerifiedPhoneGuard } from '../common/guards/verified-phone.guard';
import { BlockConversationCounterpartDto } from './dto/block-conversation-counterpart.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ReportEntityDto } from './dto/report-entity.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateConversationPreferencesDto } from './dto/update-conversation-preferences.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { MessagingService } from './messaging.service';

@Controller('messaging')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('conversations')
  findConversations(
    @CurrentUser() user: { id: string },
    @Query('archived') archived?: string,
  ) {
    return this.messagingService.findConversations(
      user.id,
      archived === 'true',
    );
  }

  @Post('conversations')
  @UseGuards(VerifiedPhoneGuard)
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
  @UseGuards(VerifiedPhoneGuard)
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

  @Patch('conversations/:conversationId/preferences')
  updateConversationPreferences(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
    @Body() dto: UpdateConversationPreferencesDto,
  ) {
    return this.messagingService.updateConversationPreferences(
      user.id,
      conversationId,
      dto,
    );
  }

  @Post('conversations/:conversationId/block')
  blockConversationCounterpart(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
    @Body() dto: BlockConversationCounterpartDto,
  ) {
    return this.messagingService.blockConversationCounterpart(
      user.id,
      conversationId,
      dto.reason,
    );
  }

  @Post('conversations/:conversationId/report')
  reportConversation(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
    @Body() dto: ReportEntityDto,
  ) {
    return this.messagingService.reportConversation(
      user.id,
      conversationId,
      dto,
    );
  }

  @Post('messages/:messageId/report')
  reportMessage(
    @CurrentUser() user: { id: string },
    @Param('messageId') messageId: string,
    @Body() dto: ReportEntityDto,
  ) {
    return this.messagingService.reportMessage(user.id, messageId, dto);
  }

  @Patch('messages/:messageId/offer')
  updateOffer(
    @CurrentUser() user: { id: string },
    @Param('messageId') messageId: string,
    @Body() dto: UpdateOfferDto,
  ) {
    return this.messagingService.updateOffer(user.id, messageId, dto);
  }

  @Get('admin/reports')
  @UseGuards(RolesGuard)
  @Roles(...rolesForPermission('SUPPORT_READ'))
  listOpenReports(@CurrentUser() user: { id: string; role: string }) {
    return this.messagingService.listOpenReports(user);
  }

  @Delete('messages/:messageId')
  deleteMessage(
    @CurrentUser() user: { id: string },
    @Param('messageId') messageId: string,
    @Query('scope') scope?: string,
  ) {
    return this.messagingService.deleteMessage(
      user.id,
      messageId,
      scope === 'me' ? 'me' : 'everyone',
    );
  }
}
