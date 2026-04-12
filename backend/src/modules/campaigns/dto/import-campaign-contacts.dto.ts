import { IsObject, IsOptional } from 'class-validator';

export class ImportCampaignContactsDto {
  @IsOptional()
  @IsObject()
  mapping?: Record<string, string>;
}
