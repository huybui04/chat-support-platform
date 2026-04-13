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
  async findAll(@Query() query: PaginationQueryDto) {
    const result = await this.contactsService.findAll(query);
    return apiSuccess(result.items, result.meta);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const contact = await this.contactsService.findById(id);
    return apiSuccess(contact);
  }

  @Post()
  async create(@Body() payload: CreateContactDto) {
    const contact = await this.contactsService.create(payload);
    return apiSuccess(contact);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() payload: UpdateContactDto) {
    const contact = await this.contactsService.update(id, payload);
    return apiSuccess(contact);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.contactsService.remove(id);
    return apiSuccess({ id });
  }
}
