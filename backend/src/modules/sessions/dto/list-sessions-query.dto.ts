import { IsEnum, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ChatSessionStatus } from '../../../database/entities';

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
  @IsEnum(SessionVisibilityScope)
  visibilityScope?: SessionVisibilityScope;
}
