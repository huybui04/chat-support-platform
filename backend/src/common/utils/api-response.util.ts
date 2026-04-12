export interface ApiResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
}

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: ApiResponseMeta;
}

export function apiSuccess<T>(data: T, meta?: ApiResponseMeta): ApiResponse<T> {
  if (meta) {
    return { success: true, data, meta };
  }

  return { success: true, data };
}
