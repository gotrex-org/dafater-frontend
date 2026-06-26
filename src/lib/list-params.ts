export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  from?: string;
  to?: string;
  all?: boolean;
  [key: string]: unknown;
}

/** Build a `?a=1&b=2` query string, skipping empty values. */
export function toQuery(params: Record<string, unknown> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}
