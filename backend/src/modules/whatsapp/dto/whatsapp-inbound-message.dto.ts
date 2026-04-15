import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class WhatsappInboundMessageDto {
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  phoneNumberId?: string;

  @ValidateIf((payload: WhatsappInboundMessageDto) => !payload.entry?.length)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  from?: string;

  @ValidateIf((payload: WhatsappInboundMessageDto) => !payload.entry?.length)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  object?: string;

  @IsOptional()
  @IsArray()
  entry?: Array<Record<string, unknown>>;
}
