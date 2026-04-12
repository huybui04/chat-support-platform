import { IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListTeamsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  createdById?: string;
}
