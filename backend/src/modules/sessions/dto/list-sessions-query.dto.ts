import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ChatSessionStatus, SessionChannel } from '../../../database/entities';

export enum SessionVisibilityScope {
  TEAM = 'team',
  AGENT = 'agent',
}

export class ListSessionsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ChatSessionStatus)
  status?: ChatSessionStatus;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsUUID()
  agentId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    return Array.isArray(value) ? value : [value];
  })
  @IsArray()
  @IsEnum(SessionChannel, { each: true })
  channels?: SessionChannel[];

  @IsOptional()
  @IsEnum(SessionVisibilityScope)
  visibilityScope?: SessionVisibilityScope;
}
