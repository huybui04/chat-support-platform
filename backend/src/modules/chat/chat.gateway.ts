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

  private readonly socketToAgentId = new Map<string, string>();
  private readonly agentOnlineSocketCount = new Map<string, number>();
  private readonly tenantToOnlineAgentIds = new Map<string, Set<string>>();

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

    const tenantId = user.tenantId || 'chat-support-platform';
    (client as any).tenantId = tenantId;
    (client as any).userId = user.sub;
    await client.join(`tenant:${tenantId}`);

    if (user.roles.includes(UserRole.AGENT)) {
      this.markAgentConnected(user.sub, client.id, tenantId);
    }

    client.emit('connected', { socketId: client.id });
  }

  handleDisconnect(client: Socket) {
    this.markAgentDisconnected(client.id, (client as any).tenantId || 'chat-support-platform');
  }

  emitSessionAssigned(session: {
    id: string;
    agentId: string | null;
    agentName?: string | null;
    campaignName?: string | null;
  }, tenantId: string) {
    if (!this.server) {
      return;
    }
    this.server.to(`tenant:${tenantId}`).emit('session_assigned', { session });
  }

  emitNewSessionPending(session: {
    id: string;
    status: string;
    campaignName?: string | null;
  }, tenantId: string) {
    if (!this.server) {
      return;
    }
    this.server.to(`tenant:${tenantId}`).emit('new_session_pending', { session });
  }

  emitAgentStatusChanged(payload: { agentId: string; isOnline: boolean }, tenantId: string) {
    if (!this.server) {
      return;
    }
    this.server.to(`tenant:${tenantId}`).emit('agent_status_changed', payload);
  }

  private emitAgentsOnlineSnapshot(tenantId: string) {
    if (!this.server) {
      return;
    }

    const tenantAgents = this.tenantToOnlineAgentIds.get(tenantId);
    this.server.to(`tenant:${tenantId}`).emit('agents_online_snapshot', {
      agentIds: tenantAgents ? [...tenantAgents] : [],
    });
  }

  private markAgentConnected(agentId: string, socketId: string, tenantId: string) {
    this.socketToAgentId.set(socketId, agentId);

    const current = this.agentOnlineSocketCount.get(agentId) ?? 0;
    const next = current + 1;
    this.agentOnlineSocketCount.set(agentId, next);

    let tenantAgents = this.tenantToOnlineAgentIds.get(tenantId);
    if (!tenantAgents) {
      tenantAgents = new Set<string>();
      this.tenantToOnlineAgentIds.set(tenantId, tenantAgents);
    }
    tenantAgents.add(agentId);

    if (next === 1) {
      this.emitAgentStatusChanged({ agentId, isOnline: true }, tenantId);
    }

    this.emitAgentsOnlineSnapshot(tenantId);
  }

  private markAgentDisconnected(socketId: string, tenantId: string) {
    const agentId = this.socketToAgentId.get(socketId);
    if (!agentId) {
      return;
    }

    this.socketToAgentId.delete(socketId);

    const current = this.agentOnlineSocketCount.get(agentId) ?? 0;
    if (current <= 1) {
      this.agentOnlineSocketCount.delete(agentId);
      const tenantAgents = this.tenantToOnlineAgentIds.get(tenantId);
      if (tenantAgents) {
        tenantAgents.delete(agentId);
        if (tenantAgents.size === 0) {
          this.tenantToOnlineAgentIds.delete(tenantId);
        }
      }
      this.emitAgentStatusChanged({ agentId, isOnline: false }, tenantId);
      this.emitAgentsOnlineSnapshot(tenantId);
      return;
    }

    this.agentOnlineSocketCount.set(agentId, current - 1);
    this.emitAgentsOnlineSnapshot(tenantId);
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
    const tenantId = (client as any).tenantId || 'chat-support-platform';
    await this.chatService.ensureSessionExists(payload.sessionId, tenantId);
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
  async sendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessageDto,
  ) {
    try {
      await this.validatePayload(payload, SendMessageDto);
      const tenantId = (client as any).tenantId || 'chat-support-platform';

      const message = await this.chatService.saveIncomingMessage(payload, tenantId);
      this.server.to(payload.sessionId).emit('new_message', { message });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to send message';
      client.emit('message_error', {
        sessionId: payload?.sessionId,
        message,
      });
    }
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
  async endSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: EndSessionDto,
  ) {
    await this.validatePayload(payload, EndSessionDto);
    const tenantId = (client as any).tenantId || 'chat-support-platform';

    await this.chatService.endSession(payload.sessionId, tenantId);
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
