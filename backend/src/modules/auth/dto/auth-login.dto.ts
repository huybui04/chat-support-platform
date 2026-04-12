import { IsNotEmpty, IsString, IsUrl } from 'class-validator';
import { Transform } from 'class-transformer';

type RedirectUriCarrier = {
  redirectUri?: unknown;
  redirect_uri?: unknown;
};

export class AuthLoginDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  codeVerifier: string;

  @IsUrl({ require_tld: false })
  @Transform(({ value, obj }: { value: unknown; obj: unknown }) => {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }

    if (obj && typeof obj === 'object') {
      const carrier = obj as RedirectUriCarrier;
      const candidate = carrier.redirectUri ?? carrier.redirect_uri;
      if (typeof candidate === 'string') {
        return candidate;
      }
    }

    return value;
  })
  redirectUri: string;
}
