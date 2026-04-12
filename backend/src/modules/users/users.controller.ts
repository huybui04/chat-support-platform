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
    const currentUser = await this.usersService.findByKeycloakId(user.sub);
    return apiSuccess(currentUser);
  }

  @Get()
  async findAll(@Query() query: ListUsersQueryDto) {
    const result = await this.usersService.findAll(query);
    return apiSuccess(result.items, result.meta);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    return apiSuccess(user);
  }

  @Post()
  async create(@Body() payload: CreateUserDto) {
    const user = await this.usersService.create(payload);
    return apiSuccess(user);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() payload: UpdateUserDto) {
    const user = await this.usersService.update(id, payload);
    return apiSuccess(user);
  }

  @Delete(':id')
  async deactivate(@Param('id') id: string) {
    const user = await this.usersService.deactivate(id);
    return apiSuccess(user);
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
