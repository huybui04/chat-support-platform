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

export class CreateChannelMappingDto {
  @IsEnum(ExternalChannel)
  channel: ExternalChannel;

  @IsString()
  @MaxLength(150)
  externalAccountId: string;

  @IsUUID()
  campaignId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
