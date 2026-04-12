import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Contact } from '../../database/entities';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact)
    private readonly contactsRepository: Repository<Contact>,
  ) {}

  async findAll(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.contactsRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items,
      meta: { page, limit, total },
    };
  }

  async findById(id: string): Promise<Contact> {
    const contact = await this.contactsRepository.findOne({ where: { id } });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return contact;
  }

  async create(payload: CreateContactDto): Promise<Contact> {
    const contact = this.contactsRepository.create({
      fullName: payload.fullName,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      whatsappId: payload.whatsappId ?? null,
      metadata: payload.metadata ?? null,
    });

    return this.contactsRepository.save(contact);
  }

  async update(id: string, payload: UpdateContactDto): Promise<Contact> {
    const contact = await this.findById(id);

    const merged = this.contactsRepository.merge(contact, {
      ...payload,
      phone: payload.phone !== undefined ? payload.phone : contact.phone,
      email: payload.email !== undefined ? payload.email : contact.email,
      whatsappId:
        payload.whatsappId !== undefined
          ? payload.whatsappId
          : contact.whatsappId,
      metadata:
        payload.metadata !== undefined ? payload.metadata : contact.metadata,
    });

    return this.contactsRepository.save(merged);
  }
}
