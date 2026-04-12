import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  ChatMessage,
  ChatSession,
  ChatSessionStatus,
  MessageSenderType,
  MessageType,
} from '../../database/entities';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatSession)
    private readonly sessionsRepository: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly messagesRepository: Repository<ChatMessage>,
  ) {}

  async ensureSessionExists(sessionId: string): Promise<ChatSession> {
    const session = await this.sessionsRepository.findOne({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  async saveIncomingMessage(payload: SendMessageDto): Promise<ChatMessage> {
    await this.ensureSessionExists(payload.sessionId);

    const message = this.messagesRepository.create({
      sessionId: payload.sessionId,
      senderType: MessageSenderType.AGENT,
      senderId: null,
      content: payload.content,
      messageType: payload.messageType ?? MessageType.TEXT,
      attachmentUrl: null,
      isRead: false,
    });

    return this.messagesRepository.save(message);
  }

  async endSession(sessionId: string): Promise<ChatSession> {
    const session = await this.ensureSessionExists(sessionId);
    session.status = ChatSessionStatus.COMPLETED;
    session.endedAt = new Date();

    return this.sessionsRepository.save(session);
  }
}
