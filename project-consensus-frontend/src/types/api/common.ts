// MARK: ============ Common list and pagination ============

// DRF paginated response
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Common error response
export interface ErrorResponse {
  message?: string;
  detail?: string;
  // DRF validation errors (field-specific errors)
  // DRF 验证错误（字段特定错误）
  [key: string]: string | string[] | undefined;
}
