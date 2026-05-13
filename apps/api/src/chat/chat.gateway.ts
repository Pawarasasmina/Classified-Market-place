import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

type ChatJwtPayload = {
  sub: string;
  email: string;
  role: string;
};

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
  namespace: 'chat',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const user = await this.authenticateSocket(client);
      client.data.user = user;
      await client.join(this.chatService.getUserRoom(user.id));
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('conversation.create')
  async createConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: CreateConversationDto,
  ) {
    const user = this.requireSocketUser(client);
    const conversation = await this.chatService.createConversation(
      user.id,
      payload,
    );
    await client.join(this.chatService.getConversationRoom(conversation.id));
    const snapshot = await this.chatService.getConversationSnapshot(
      conversation.id,
    );

    this.broadcastConversationSnapshot(snapshot);

    return conversation;
  }

  @SubscribeMessage('conversation.join')
  async joinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { conversationId?: string },
  ) {
    const user = this.requireSocketUser(client);
    const conversationId = payload?.conversationId;

    if (!conversationId) {
      throw new WsException('conversationId is required');
    }

    const conversation = await this.chatService.findOneForUser(
      user.id,
      conversationId,
    );
    await client.join(this.chatService.getConversationRoom(conversationId));

    return conversation;
  }

  @SubscribeMessage('conversation.leave')
  async leaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { conversationId?: string },
  ) {
    const conversationId = payload?.conversationId;

    if (!conversationId) {
      throw new WsException('conversationId is required');
    }

    await client.leave(this.chatService.getConversationRoom(conversationId));

    return {
      left: true,
      conversationId,
    };
  }

  @SubscribeMessage('message.send')
  async sendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { conversationId?: string; body?: string },
  ) {
    const user = this.requireSocketUser(client);
    const conversationId = payload?.conversationId;
    const body = payload?.body;

    if (!conversationId || typeof body !== 'string') {
      throw new WsException('conversationId and body are required');
    }

    const conversation = await this.chatService.sendMessage(
      user.id,
      conversationId,
      {
        body,
      } satisfies SendMessageDto,
    );
    const snapshot =
      await this.chatService.getConversationSnapshot(conversationId);

    this.server
      .to(this.chatService.getConversationRoom(conversationId))
      .emit('message.created', snapshot.latestMessage);
    this.broadcastConversationSnapshot(snapshot);

    return conversation;
  }

  @SubscribeMessage('conversation.read')
  async markConversationRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { conversationId?: string },
  ) {
    const user = this.requireSocketUser(client);
    const conversationId = payload?.conversationId;

    if (!conversationId) {
      throw new WsException('conversationId is required');
    }

    const conversation = await this.chatService.markConversationRead(
      user.id,
      conversationId,
    );
    const snapshot =
      await this.chatService.getConversationSnapshot(conversationId);

    this.server
      .to(this.chatService.getConversationRoom(conversationId))
      .emit('conversation.read', {
        conversationId,
        participants: snapshot.participants,
      });
    this.broadcastConversationSnapshot(snapshot);

    return conversation;
  }

  private async authenticateSocket(client: AuthenticatedSocket) {
    const token = this.extractToken(client);

    if (!token) {
      throw new WsException('Missing authorization token');
    }

    const payload = await this.jwtService.verifyAsync<ChatJwtPayload>(token);
    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub,
      },
    });

    if (!user) {
      throw new WsException('User no longer exists');
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  }

  private broadcastConversationSnapshot(snapshot: {
    id: string;
    participants: Array<{ user: { id: string } }>;
  }) {
    for (const participant of snapshot.participants) {
      this.server
        .to(this.chatService.getUserRoom(participant.user.id))
        .emit('conversation.updated', snapshot);
    }
  }

  private extractToken(client: AuthenticatedSocket) {
    const authToken = client.handshake.auth?.token;

    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }

    const authorizationHeader = client.handshake.headers.authorization;
    const headerValue = Array.isArray(authorizationHeader)
      ? authorizationHeader[0]
      : authorizationHeader;

    if (!headerValue) {
      return null;
    }

    const [scheme, token] = headerValue.split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return null;
    }

    return token;
  }

  private requireSocketUser(client: AuthenticatedSocket) {
    const user = client.data.user;

    if (!user) {
      throw new WsException('Socket is not authenticated');
    }

    return user;
  }
}
