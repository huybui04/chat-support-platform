import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

import { ExternalChannel } from '../../../database/entities';

export class UpdateChannelMappingDto {
  @IsOptional()
  @IsEnum(ExternalChannel)
  channel?: ExternalChannel;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  externalAccountId?: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
