import { IsNotEmpty, IsString, IsUrl } from 'class-validator';
import { Transform } from 'class-transformer';

export class AuthLoginDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  codeVerifier: string;

  @IsUrl({ require_tld: false })
  @Transform(({ obj }) => obj.redirectUri ?? obj.redirect_uri)
  redirectUri: string;
}
