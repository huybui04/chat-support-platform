import { Transform } from 'class-transformer';
import { IsObject, IsOptional } from 'class-validator';

export class ImportCampaignContactsDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    try {
      const parsed = JSON.parse(value) as unknown;
      return typeof parsed === 'object' && parsed !== null ? parsed : value;
    } catch {
      return value;
    }
  })
  @IsObject()
  mapping?: Record<string, string>;
}
