import { Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  Ack,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { MessagingPresenceService } from './messaging-presence.service';
import { MessagingService } from './messaging.service';

type AuthenticatedSocket = Socket & {
  data: {
    user?: {
      id: string;
      email: string;
      displayName: string;
      role: string;
    };
  };
};

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/messaging',
})
export class MessagingGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  private readonly logger = new Logger(MessagingGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly messagingService: MessagingService,
    private readonly presence: MessagingPresenceService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    if (this.configService.get<string>('REDIS_URL')) {
      this.logger.log(
        'REDIS_URL is configured. Install @socket.io/redis-adapter and redis to enable horizontal Socket.IO pub/sub.',
      );
    }
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        typeof client.handshake.auth.token === 'string'
          ? client.handshake.auth.token
          : undefined;

      if (!token) {
        throw new UnauthorizedException('Missing socket auth token');
      }

      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        role: string;
      }>(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User no longer exists');
      }

      client.data.user = {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      };
      this.presence.markOnline(user.id, client.id);
      this.server.emit('presence:update', {
        userId: user.id,
        online: true,
        onlineUserIds: this.presence.onlineUserIds(),
      });
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const user = client.data.user;

    if (!user) {
      return;
    }

    this.presence.markOffline(user.id, client.id);
    this.server.emit('presence:update', {
      userId: user.id,
      online: this.presence.isOnline(user.id),
      onlineUserIds: this.presence.onlineUserIds(),
    });
  }

  @SubscribeMessage('conversation:join')
  async joinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    const user = this.requireSocketUser(client);
    await this.messagingService.findMessages(user.id, body.conversationId);
    await client.join(this.roomName(body.conversationId));
    return { conversationId: body.conversationId };
  }

  @SubscribeMessage('message:send')
  async sendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    body: {
      conversationId: string;
      message: SendMessageDto;
    },
    @Ack() ack?: (message: unknown) => void,
  ) {
    const user = this.requireSocketUser(client);
    const message = await this.messagingService.sendMessage(
      user.id,
      body.conversationId,
      body.message,
    );
    this.server.to(this.roomName(body.conversationId)).emit('message:new', message);
    ack?.(message);
    return message;
  }

  @SubscribeMessage('message:read')
  async markRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    const user = this.requireSocketUser(client);
    const result = await this.messagingService.markRead(user.id, body.conversationId);
    this.server.to(this.roomName(body.conversationId)).emit('message:read', {
      conversationId: body.conversationId,
      userId: user.id,
    });
    return result;
  }

  @SubscribeMessage('typing:start')
  typingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    const user = this.requireSocketUser(client);
    client.to(this.roomName(body.conversationId)).emit('typing:update', {
      conversationId: body.conversationId,
      userId: user.id,
      displayName: user.displayName,
      typing: true,
    });
  }

  @SubscribeMessage('typing:stop')
  typingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    const user = this.requireSocketUser(client);
    client.to(this.roomName(body.conversationId)).emit('typing:update', {
      conversationId: body.conversationId,
      userId: user.id,
      displayName: user.displayName,
      typing: false,
    });
  }

  @SubscribeMessage('offer:update')
  async updateOffer(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    body: {
      messageId: string;
      conversationId: string;
      update: UpdateOfferDto;
    },
    @Ack() ack?: (message: unknown) => void,
  ) {
    const user = this.requireSocketUser(client);
    const message = await this.messagingService.updateOffer(
      user.id,
      body.messageId,
      body.update,
    );
    this.server.to(this.roomName(body.conversationId)).emit('offer:updated', message);
    ack?.(message);
    return message;
  }

  private requireSocketUser(client: AuthenticatedSocket) {
    if (!client.data.user) {
      throw new UnauthorizedException('Socket is not authenticated');
    }

    return client.data.user;
  }

  private roomName(conversationId: string) {
    return `conversation:${conversationId}`;
  }
}
