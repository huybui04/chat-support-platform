import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import type { AuthUser } from '../../common/auth/auth-user.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities';
import { apiSuccess } from '../../common/utils/api-response.util';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@Roles(UserRole.SUPERVISOR)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @Roles(UserRole.AGENT, UserRole.SUPERVISOR)
  async me(@CurrentUser() user: AuthUser) {
    const currentUser = await this.usersService.ensureFromAuthUser(user);
    return apiSuccess(currentUser);
  }

  @Get()
  async findAll(
    @Query() query: ListUsersQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.usersService.findAll(query, user.tenantId || 'chat-support-platform');
    return apiSuccess(result.items, result.meta);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const dbUser = await this.usersService.findByIdAndTenant(id, user.tenantId || 'chat-support-platform');
    return apiSuccess(dbUser);
  }

  @Post()
  async create(
    @Body() payload: CreateUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    const dbUser = await this.usersService.create(payload, user.tenantId || 'chat-support-platform');
    return apiSuccess(dbUser);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() payload: UpdateUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    const dbUser = await this.usersService.update(id, payload, user.tenantId || 'chat-support-platform');
    return apiSuccess(dbUser);
  }

  @Delete(':id')
  async deactivate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const dbUser = await this.usersService.deactivate(id, user.tenantId || 'chat-support-platform');
    return apiSuccess(dbUser);
  }

  @Patch(':id/status')
  @Roles(UserRole.AGENT, UserRole.SUPERVISOR)
  async updateStatus(
    @CurrentUser() currentUser: AuthUser,
    @Param('id') id: string,
    @Body() payload: UpdateUserStatusDto,
  ) {
    const user = await this.usersService.updateStatus(id, payload, currentUser);
    return apiSuccess(user);
  }
}
