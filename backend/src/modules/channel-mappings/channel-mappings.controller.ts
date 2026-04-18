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
  async findAll(@Query() query: ListChannelMappingsQueryDto) {
    const result = await this.channelMappingsService.findAll(query);
    return apiSuccess(result.items, result.meta);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const mapping = await this.channelMappingsService.findById(id);
    return apiSuccess(mapping);
  }

  @Post()
  async create(@Body() payload: CreateChannelMappingDto) {
    const mapping = await this.channelMappingsService.create(payload);
    return apiSuccess(mapping);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() payload: UpdateChannelMappingDto,
  ) {
    const mapping = await this.channelMappingsService.update(id, payload);
    return apiSuccess(mapping);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.channelMappingsService.remove(id);
    return apiSuccess({ id });
  }
}
