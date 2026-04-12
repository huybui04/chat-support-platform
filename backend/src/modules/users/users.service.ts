import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import { User } from '../../database/entities';
import type { AuthUser } from '../../common/auth/auth-user.type';
import { UserRole } from '../../database/entities';
import { ChatGateway } from '../chat/chat.gateway';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly chatGateway: ChatGateway,
  ) {}

  async findAll(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: FindOptionsWhere<User> = {};
    if (query.role) {
      where.role = query.role;
    }

    const [items, total] = await this.usersRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      items,
      meta: { page, limit, total },
    };
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByKeycloakId(keycloakId: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { keycloakId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async create(payload: CreateUserDto): Promise<User> {
    const user = this.usersRepository.create({
      keycloakId: payload.keycloakId,
      email: payload.email,
      fullName: payload.fullName,
      role: payload.role,
      isActive: payload.isActive ?? true,
      isOnline: payload.isOnline ?? false,
    });

    return this.usersRepository.save(user);
  }

  async update(id: string, payload: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    const merged = this.usersRepository.merge(user, payload);

    return this.usersRepository.save(merged);
  }

  async deactivate(id: string): Promise<User> {
    const user = await this.findById(id);
    user.isActive = false;

    return this.usersRepository.save(user);
  }

  async updateStatus(
    id: string,
    payload: UpdateUserStatusDto,
    currentUser: AuthUser,
  ): Promise<User> {
    if (!currentUser.roles.includes(UserRole.SUPERVISOR)) {
      const requester = await this.findByKeycloakId(currentUser.sub);
      if (requester.id !== id) {
        throw new ForbiddenException(
          'Agents can only update their own status.',
        );
      }
    }

    const user = await this.findById(id);
    user.isOnline = payload.isOnline;
    const updatedUser = await this.usersRepository.save(user);

    this.chatGateway.emitAgentStatusChanged({
      agentId: updatedUser.id,
      isOnline: updatedUser.isOnline,
    });

    return updatedUser;
  }
}
