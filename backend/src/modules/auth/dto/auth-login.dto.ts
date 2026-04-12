import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class AuthLoginDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  codeVerifier: string;

  @IsUrl({ require_tld: false })
  redirectUri: string;
}
