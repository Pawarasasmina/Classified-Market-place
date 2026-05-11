import { Injectable } from '@nestjs/common';

@Injectable()
export class MessagingPresenceService {
  private readonly userSockets = new Map<string, Set<string>>();

  markOnline(userId: string, socketId: string) {
    const sockets = this.userSockets.get(userId) ?? new Set<string>();
    sockets.add(socketId);
    this.userSockets.set(userId, sockets);
  }

  markOffline(userId: string, socketId: string) {
    const sockets = this.userSockets.get(userId);

    if (!sockets) {
      return;
    }

    sockets.delete(socketId);

    if (sockets.size === 0) {
      this.userSockets.delete(userId);
    }
  }

  isOnline(userId: string) {
    return this.userSockets.has(userId);
  }

  onlineUserIds() {
    return [...this.userSockets.keys()];
  }
}
