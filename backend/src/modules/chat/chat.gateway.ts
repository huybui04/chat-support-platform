import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Server, Socket } from 'socket.io';

import type { AuthUser } from '../../common/auth/auth-user.type';
import { ChatService } from './chat.service';
import {
  parseBearerToken,
  verifyAndBuildAuthUser,
} from '../../common/auth/jwt.util';
import { UserRole } from '../../database/entities';
import { EndSessionDto } from './dto/end-session.dto';
import { JoinSessionDto } from './dto/join-session.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { TypingDto } from './dto/typing.dto';
import { ChatMessage } from '../../database/entities';

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

  async handleConnection(client: Socket) {
    const bearerFromHeader = client.handshake.headers.authorization;
    const tokenFromAuth =
      typeof client.handshake.auth?.token === 'string'
        ? client.handshake.auth.token
        : undefined;
    const tokenFromHeader = parseBearerToken(bearerFromHeader);
    const token = tokenFromAuth ?? tokenFromHeader;

    if (!token) {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect();
      return;
    }

    let user: AuthUser | null = null;
    try {
      user = await verifyAndBuildAuthUser(token);
    } catch {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect();
      return;
    }

    if (!user || user.roles.length === 0) {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect();
      return;
    }

    const hasSupportedRole = user.roles.some(
      (role) => role === UserRole.AGENT || role === UserRole.SUPERVISOR,
    );
    if (!hasSupportedRole) {
      client.emit('error', { message: 'Forbidden' });
      client.disconnect();
      return;
    }

    client.emit('connected', { socketId: client.id });
  }

  handleDisconnect() {}

  emitSessionAssigned(session: { id: string; agentId: string | null }) {
    if (!this.server) {
      return;
    }
    this.server.emit('session_assigned', { session });
  }

  emitNewSessionPending(session: { id: string; status: string }) {
    if (!this.server) {
      return;
    }
    this.server.emit('new_session_pending', { session });
  }

  emitAgentStatusChanged(payload: { agentId: string; isOnline: boolean }) {
    if (!this.server) {
      return;
    }
    this.server.emit('agent_status_changed', payload);
  }

  emitSessionMessage(sessionId: string, message: ChatMessage) {
    if (!this.server) {
      return;
    }
    this.server.to(sessionId).emit('new_message', { message });
  }

  emitSessionEnded(sessionId: string) {
    if (!this.server) {
      return;
    }
    this.server.to(sessionId).emit('session_ended', { sessionId });
  }

  @SubscribeMessage('join_session')
  async joinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinSessionDto,
  ) {
    await this.validatePayload(payload, JoinSessionDto);
    await this.chatService.ensureSessionExists(payload.sessionId);
    await client.join(payload.sessionId);
  }

  @SubscribeMessage('leave_session')
  async leaveSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinSessionDto,
  ) {
    await this.validatePayload(payload, JoinSessionDto);
    await client.leave(payload.sessionId);
  }

  @SubscribeMessage('send_message')
  async sendMessage(@MessageBody() payload: SendMessageDto) {
    await this.validatePayload(payload, SendMessageDto);

    const message = await this.chatService.saveIncomingMessage(payload);
    this.server.to(payload.sessionId).emit('new_message', { message });
  }

  @SubscribeMessage('typing_start')
  async typingStart(@MessageBody() payload: TypingDto) {
    await this.validatePayload(payload, TypingDto);
    this.server.to(payload.sessionId).emit('user_typing', {
      sessionId: payload.sessionId,
      senderType: 'agent',
      isTyping: true,
    });
  }

  @SubscribeMessage('typing_stop')
  async typingStop(@MessageBody() payload: TypingDto) {
    await this.validatePayload(payload, TypingDto);
    this.server.to(payload.sessionId).emit('user_typing', {
      sessionId: payload.sessionId,
      senderType: 'agent',
      isTyping: false,
    });
  }

  @SubscribeMessage('end_session')
  async endSession(@MessageBody() payload: EndSessionDto) {
    await this.validatePayload(payload, EndSessionDto);

    await this.chatService.endSession(payload.sessionId);
    this.emitSessionEnded(payload.sessionId);
  }

  private async validatePayload<T extends object>(
    payload: unknown,
    cls: new () => T,
  ): Promise<void> {
    const instance = plainToInstance(cls, payload);
    const errors = await validate(instance);
    if (errors.length > 0) {
      throw new Error('Invalid websocket payload');
    }
  }
}
