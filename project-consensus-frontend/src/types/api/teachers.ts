// MARK: ============ Teacher API types ============

// GET /api/teachers/ query parameters
export interface FetchTeachersParams {
  q?: string;           // Search query (name, department)
  page?: number;        // Page number (default: 1)
  pageSize?: number;    // Items per page (default: 20, max: 100)
  ordering?: string;    // Sort field (e.g., 'name', '-rating_overall', 'department')
}
