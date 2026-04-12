export type ApiMeta = {
  page?: number;
  limit?: number;
  total?: number;
};

export type ApiResponse<T> = {
  success: true;
  data: T;
  meta?: ApiMeta;
};

export type PaginatedResult<T> = {
  items: T[];
  meta?: ApiMeta;
};
