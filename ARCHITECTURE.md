# Frontend System Design (دفاتر web)

Next.js 14 (App Router) + TypeScript + TanStack Query + axios, RTL Arabic.

## Layers (dependencies point downward only)

```
app/            Routing only. Pages are thin: they render a module <View/>.
  ├─ (app)/     Authenticated area — layout guards auth + renders nav
  ├─ login/     → modules/auth
  └─ order/     Public order form → modules/orders

modules/<feature>/        One self-contained feature each:
  ├─ dtos.ts              Types + request DTOs (the feature's contract)
  ├─ api.ts              Raw endpoint calls (typed, via lib/api)
  ├─ hooks.ts           TanStack useQuery/useMutation + query keys
  └─ components/         Feature UI (e.g. InvoicesView, InvoiceEditor)

components/common/        SHARED UI library (used by many modules)
  PageTitle, DataTable, Pagination, StatCard/StatsGrid,
  SegmentedControl, SearchInput, Field, EmptyState, Spinner

lib/                      Cross-cutting infrastructure
  api.ts (axios instance + interceptors), auth.tsx (auth context),
  query-provider.tsx, list-params.ts, useTableState.ts, format.ts, types.ts
```

**Rule of thumb:** a component lives in `modules/<feature>/components` until it is
needed by a *second* feature — then it moves to `components/common` and both
import it. `app/` never contains logic; `modules/` never import each other's
`components` except through well-known shared pieces.

## Data flow

```
Component → module hook (useX) → module api (axios) → NestJS
                  ↑                         │
            TanStack cache  ◄──────────────┘  (keyed by query key)
```

- **Reads**: `useQuery` with a structured key (`['invoices','list',params]`).
  Cached 30s (`staleTime`); identical keys dedupe automatically.
- **Writes**: `useMutation`; on success it invalidates the affected query keys.
  Because server balances are *derived*, a mutation invalidates every view it
  can affect — e.g. `useCreateInvoice` invalidates
  `invoices, parties, treasury, warehouses, dashboard`.
- **Pagination**: `useTableState` holds `page/pageSize/search`; hooks pass them
  to the API; `DataTable` renders rows + the `Pagination` footer.
- **`?all=true`**: dropdowns use `useAllX()` variants that fetch the full list
  (bypassing pagination) instead of a page.

## Shared component contracts

- `DataTable<T>` — `columns: Column<T>[]` (`{header, cell, className?}`),
  `rows`, `rowKey`, optional `loading/emptyText/onRowClick` and
  `meta/onPage/pageSize/onPageSize` to render pagination inside the card.
  Replaces the repeated `card > tbl-wrap > table > … > Pagination` block.
- `PageTitle` — `{title, subtitle?, actions?}`.
- `SegmentedControl<V>` — pill toggle (`options/value/onChange`).
- `StatsGrid` + `StatCard` — KPI cards.
- `Field` — `label + control` inside `.form-grid`.
- `SearchInput`, `EmptyState`, `Spinner`.

## Conventions
- Module hooks are the ONLY place components touch the server.
- Query keys are defined once per module (`xKeys`) and reused for invalidation.
- DTOs are the single source of truth for a feature's shapes; cross-feature
  shared types (`Paginated`, `PageMeta`, `AuthUser`) live in `lib/types.ts`.
