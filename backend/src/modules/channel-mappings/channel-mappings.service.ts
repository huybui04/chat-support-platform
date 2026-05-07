import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Campaign, ChannelCampaignMapping } from '../../database/entities';
import { CreateChannelMappingDto } from './dto/create-channel-mapping.dto';
import {
  ChannelMappingsSortBy,
  ChannelMappingsSortOrder,
  ListChannelMappingsQueryDto,
} from './dto/list-channel-mappings-query.dto';
import { UpdateChannelMappingDto } from './dto/update-channel-mapping.dto';

@Injectable()
export class ChannelMappingsService {
  constructor(
    @InjectRepository(ChannelCampaignMapping)
    private readonly mappingsRepository: Repository<ChannelCampaignMapping>,
    @InjectRepository(Campaign)
    private readonly campaignsRepository: Repository<Campaign>,
  ) {}

  async findAll(query: ListChannelMappingsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? ChannelMappingsSortBy.CREATED_AT;
    const sortOrder =
      query.sortOrder?.toUpperCase() ===
      ChannelMappingsSortOrder.ASC.toUpperCase()
        ? 'ASC'
        : 'DESC';

    const sortColumn =
      sortBy === ChannelMappingsSortBy.PRIORITY
        ? 'mapping.priority'
        : 'mapping.createdAt';

    const qb = this.mappingsRepository
      .createQueryBuilder('mapping')
      .orderBy(sortColumn, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    if (query.channel) {
      qb.andWhere('mapping.channel = :channel', { channel: query.channel });
    }

    if (query.externalAccountId) {
      qb.andWhere('mapping.externalAccountId = :externalAccountId', {
        externalAccountId: query.externalAccountId,
      });
    }

    if (query.campaignId) {
      qb.andWhere('mapping.campaignId = :campaignId', {
        campaignId: query.campaignId,
      });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('mapping.isActive = :isActive', { isActive: query.isActive });
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: { page, limit, total },
    };
  }

  async findById(id: string): Promise<ChannelCampaignMapping> {
    const mapping = await this.mappingsRepository.findOne({ where: { id } });

    if (!mapping) {
      throw new NotFoundException('Channel mapping not found');
    }

    return mapping;
  }

  async create(
    payload: CreateChannelMappingDto,
  ): Promise<ChannelCampaignMapping> {
    await this.ensureCampaignExists(payload.campaignId);

    const mapping = this.mappingsRepository.create({
      channel: payload.channel,
      externalAccountId: payload.externalAccountId.trim(),
      campaignId: payload.campaignId,
      priority: payload.priority ?? 1,
      isActive: payload.isActive ?? true,
    });

    return this.mappingsRepository.save(mapping);
  }

  async update(
    id: string,
    payload: UpdateChannelMappingDto,
  ): Promise<ChannelCampaignMapping> {
    const mapping = await this.findById(id);

    if (payload.campaignId) {
      await this.ensureCampaignExists(payload.campaignId);
    }

    const merged = this.mappingsRepository.merge(mapping, {
      channel: payload.channel ?? mapping.channel,
      externalAccountId:
        payload.externalAccountId?.trim() ?? mapping.externalAccountId,
      campaignId: payload.campaignId ?? mapping.campaignId,
      priority: payload.priority ?? mapping.priority,
      isActive: payload.isActive ?? mapping.isActive,
    });

    return this.mappingsRepository.save(merged);
  }

  async remove(id: string): Promise<void> {
    const result = await this.mappingsRepository.delete({ id });

    if (!result.affected) {
      throw new NotFoundException('Channel mapping not found');
    }
  }

  private async ensureCampaignExists(campaignId: string): Promise<void> {
    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
      select: { id: true },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
  }
}
