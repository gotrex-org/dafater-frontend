'use client';

import type { PageMeta } from '@/lib/types';

interface Props {
  meta: PageMeta;
  onPage: (page: number) => void;
  pageSize?: number;
  onPageSize?: (size: number) => void;
}

const SIZES = [10, 20, 50, 100];

export function Pagination({ meta, onPage, pageSize, onPageSize }: Props) {
  const { page, totalPages, total, hasPrev, hasNext } = meta;
  const from = total === 0 ? 0 : (page - 1) * meta.pageSize + 1;
  const to = Math.min(page * meta.pageSize, total);

  return (
    <div className="pager">
      <span className="muted pager-info">{from}–{to} من {total}</span>

      {onPageSize && (
        <select
          className="pager-size"
          value={pageSize ?? meta.pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
        >
          {SIZES.map((s) => <option key={s} value={s}>{s} / صفحة</option>)}
        </select>
      )}

      <div className="pager-btns">
        <button className="btn btn-ghost btn-sm" disabled={!hasPrev} onClick={() => onPage(1)}>«</button>
        <button className="btn btn-ghost btn-sm" disabled={!hasPrev} onClick={() => onPage(page - 1)}>السابق</button>
        <span className="num" style={{ padding: '0 8px', fontWeight: 700 }}>{page} / {totalPages}</span>
        <button className="btn btn-ghost btn-sm" disabled={!hasNext} onClick={() => onPage(page + 1)}>التالي</button>
        <button className="btn btn-ghost btn-sm" disabled={!hasNext} onClick={() => onPage(totalPages)}>»</button>
      </div>
    </div>
  );
}
