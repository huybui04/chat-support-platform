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
import { apiSuccess } from '../../common/utils/api-response.util';
import { UserRole } from '../../database/entities';
import { ChannelMappingsService } from './channel-mappings.service';
import { CreateChannelMappingDto } from './dto/create-channel-mapping.dto';
import { ListChannelMappingsQueryDto } from './dto/list-channel-mappings-query.dto';
import { UpdateChannelMappingDto } from './dto/update-channel-mapping.dto';

@Controller('channel-mappings')
@Roles(UserRole.SUPERVISOR)
export class ChannelMappingsController {
  constructor(
    private readonly channelMappingsService: ChannelMappingsService,
  ) {}

  @Get()
  async findAll(
    @Query() query: ListChannelMappingsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.channelMappingsService.findAll(query, user.tenantId || 'chat-support-platform');
    return apiSuccess(result.items, result.meta);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const mapping = await this.channelMappingsService.findById(id, user.tenantId || 'chat-support-platform');
    return apiSuccess(mapping);
  }

  @Post()
  async create(
    @Body() payload: CreateChannelMappingDto,
    @CurrentUser() user: AuthUser,
  ) {
    const mapping = await this.channelMappingsService.create(payload, user.tenantId || 'chat-support-platform');
    return apiSuccess(mapping);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() payload: UpdateChannelMappingDto,
    @CurrentUser() user: AuthUser,
  ) {
    const mapping = await this.channelMappingsService.update(id, payload, user.tenantId || 'chat-support-platform');
    return apiSuccess(mapping);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.channelMappingsService.remove(id, user.tenantId || 'chat-support-platform');
    return apiSuccess({ id });
  }
}
