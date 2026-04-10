export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function parsePage(query: Record<string, unknown>): { page: number; pageSize: number; offset: number } {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize as string) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}
