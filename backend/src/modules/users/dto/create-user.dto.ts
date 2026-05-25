import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { UserRole } from '../../../database/entities';

export class CreateUserDto {
  @IsString()
  @MaxLength(255)
  @MinLength(1)
  username: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MaxLength(255)
  fullName: string;

  @IsString()
  @MinLength(1)
  password: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requirePasswordChange?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  lastName?: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isOnline?: boolean;
}
