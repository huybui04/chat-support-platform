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
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { apiSuccess } from '../../common/utils/api-response.util';
import { UserRole } from '../../database/entities';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Controller('contacts')
@Roles(UserRole.SUPERVISOR)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  async findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.contactsService.findAll(query, user.tenantId || 'chat-support-platform');
    return apiSuccess(result.items, result.meta);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const contact = await this.contactsService.findById(id, user.tenantId || 'chat-support-platform');
    return apiSuccess(contact);
  }

  @Post()
  async create(
    @Body() payload: CreateContactDto,
    @CurrentUser() user: AuthUser,
  ) {
    const contact = await this.contactsService.create(payload, user.tenantId || 'chat-support-platform');
    return apiSuccess(contact);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() payload: UpdateContactDto,
    @CurrentUser() user: AuthUser,
  ) {
    const contact = await this.contactsService.update(id, payload, user.tenantId || 'chat-support-platform');
    return apiSuccess(contact);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.contactsService.remove(id, user.tenantId || 'chat-support-platform');
    return apiSuccess({ id });
  }
}

