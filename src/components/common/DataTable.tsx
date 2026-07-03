'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { PageMeta } from '@/lib/types';
import { Pagination } from './Pagination';

export interface Column<T> {
  header: ReactNode;
  /** cell renderer for a row */
  cell: (row: T) => ReactNode;
  /** className applied to each <td> (e.g. "num", "muted", "deb") */
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyText?: string;
  onRowClick?: (row: T) => void;
  /** optional per-row inline style */
  rowStyle?: (row: T) => CSSProperties | undefined;
  /** pass meta + onPage to render the pagination footer inside the card */
  meta?: PageMeta;
  onPage?: (page: number) => void;
  pageSize?: number;
  onPageSize?: (size: number) => void;
}

/**
 * Card-wrapped data table with header, empty state and (optional) pagination.
 * Replaces the repeated `card > tbl-wrap > table > … > Pagination` blocks
 * across every list view.
 */
export function DataTable<T>({
  columns, rows, rowKey, loading, emptyText = 'لا توجد بيانات',
  onRowClick, rowStyle, meta, onPage, pageSize, onPageSize,
}: Props<T>) {
  return (
    <div className="card">
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>{columns.map((c, i) => <th key={i}>{c.header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={{ ...(onRowClick ? { cursor: 'pointer' } : {}), ...(rowStyle?.(row) ?? {}) }}
              >
                {columns.map((c, i) => (
                  <td key={i} className={c.className}>{c.cell(row)}</td>
                ))}
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={columns.length} className="empty">{emptyText}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {meta && onPage && (
        <Pagination meta={meta} onPage={onPage} pageSize={pageSize} onPageSize={onPageSize} />
      )}
    </div>
  );
}
