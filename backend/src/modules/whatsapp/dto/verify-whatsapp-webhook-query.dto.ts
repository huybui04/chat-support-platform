import { Transform } from 'class-transformer';
import { Allow, IsNotEmpty, IsOptional, IsString } from 'class-validator';

function pickStringValue(
  obj: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string') {
      return value;
    }
  }

  return undefined;
}

export class VerifyWhatsappWebhookQueryDto {
  @Transform(({ value, obj }) => {
    if (typeof value === 'string') {
      return value;
    }

    return pickStringValue(obj as Record<string, unknown>, [
      'hub.mode',
      'hub_mode',
    ]);
  })
  @IsString()
  @IsNotEmpty()
  mode!: string;

  @Transform(({ value, obj }) => {
    if (typeof value === 'string') {
      return value;
    }

    return pickStringValue(obj as Record<string, unknown>, [
      'hub.challenge',
      'hub_challenge',
    ]);
  })
  @IsString()
  @IsNotEmpty()
  challenge!: string;

  @Transform(({ value, obj }) => {
    if (typeof value === 'string') {
      return value;
    }

    return pickStringValue(obj as Record<string, unknown>, [
      'hub.verify_token',
      'hub_verify_token',
      'verify_token',
    ]);
  })
  @IsString()
  @IsNotEmpty()
  verifyToken!: string;

  @Allow()
  @IsOptional()
  'hub.mode'?: string;

  @Allow()
  @IsOptional()
  hub_mode?: string;

  @Allow()
  @IsOptional()
  'hub.challenge'?: string;

  @Allow()
  @IsOptional()
  hub_challenge?: string;

  @Allow()
  @IsOptional()
  'hub.verify_token'?: string;

  @Allow()
  @IsOptional()
  hub_verify_token?: string;

  @Allow()
  @IsOptional()
  verify_token?: string;
}
