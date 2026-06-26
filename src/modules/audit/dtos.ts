export interface AuditDiffEntry { from: string | number | null; to: string | number | null; }

export interface AuditLog {
  id: string;
  userName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: string;
  summary?: string | null;
  diff?: Record<string, AuditDiffEntry> | null;
  createdAt: string;
}
