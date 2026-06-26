'use client';

import { useState } from 'react';

/** Local UI state for a paginated table (page / pageSize / search). */
export function useTableState(initialPageSize = 20) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(initialPageSize);
  const [search, setSearchRaw] = useState('');

  const setPageSize = (s: number) => { setPageSizeRaw(s); setPage(1); };
  const setSearch = (s: string) => { setSearchRaw(s); setPage(1); };

  return { page, setPage, pageSize, setPageSize, search, setSearch };
}
