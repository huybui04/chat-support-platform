import { IsOptional, IsString } from 'class-validator';

export class AuthLogoutDto {
  @IsString()
  @IsOptional()
  refreshToken?: string;
}
