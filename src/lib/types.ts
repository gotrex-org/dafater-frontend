// Shared, cross-module types only. Entity DTOs live in each module's dtos.ts.

export interface PageMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface AuthUser {
  id: string;
  name: string;
  admin: boolean;
  views: string[];
  ledgerPartyIds: string[];   // empty = all; otherwise restricted to these party UIDs
  treasuryIds: string[];      // empty = all; otherwise restricted to these treasury UIDs
  role: 'STAFF' | 'CUSTOMER';
  partyId?: string;
  partyName?: string;
}
