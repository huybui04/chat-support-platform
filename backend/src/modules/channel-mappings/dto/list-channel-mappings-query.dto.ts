import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ExternalChannel } from '../../../database/entities';

export enum ChannelMappingsSortBy {
  CREATED_AT = 'createdAt',
  PRIORITY = 'priority',
}

export enum ChannelMappingsSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListChannelMappingsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ExternalChannel)
  channel?: ExternalChannel;

  @IsOptional()
  @IsString()
  externalAccountId?: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') {
        return true;
      }
      if (normalized === 'false' || normalized === '0') {
        return false;
      }
    }

    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(ChannelMappingsSortBy)
  sortBy?: ChannelMappingsSortBy = ChannelMappingsSortBy.CREATED_AT;

  @IsOptional()
  @IsEnum(ChannelMappingsSortOrder)
  sortOrder?: ChannelMappingsSortOrder = ChannelMappingsSortOrder.DESC;
}
