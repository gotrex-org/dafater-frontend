import { api } from '@/lib/api';
import type {
  CapitalMovementInput, CapitalState, CreatePriceListDto, FixedItem, ItemRef, ItemSearchInvoice, Partner, PartnerUpsertDto,
  PaymentInput, PaymentsState, PriceList, SettlementOverview, SettlementReport, Statement, SupplierProduct,
  UpdatePriceListDto, UpdateVehicleDto, Vehicle, VehicleDetail,
} from './dtos';

const BASE = '/settlement';

export const settlementApi = {
  // الأسماء
  partners: () => api.get<Partner[]>(`${BASE}/partners`),
  // تقرير التصفيات: رأس مال كل اسم ومستحقه وما سحبه ورصيده
  report: () => api.get<SettlementReport>(`${BASE}/report`),
  createPartner: (dto: PartnerUpsertDto & { name: string }) => api.post<Partner>(`${BASE}/partners`, dto),
  updatePartner: (id: string, dto: PartnerUpsertDto) => api.patch<Partner>(`${BASE}/partners/${id}`, dto),
  deletePartner: (id: string) => api.del<void>(`${BASE}/partners/${id}`),

  // تصفية اسم واحد
  overview: (p: string) => api.get<SettlementOverview>(`${BASE}/${p}/overview`),
  statement: (p: string) => api.get<Statement>(`${BASE}/${p}/statement`),
  priceLists: (p: string) => api.get<PriceList[]>(`${BASE}/${p}/price-lists`),
  products: (p: string, supplierId?: string) =>
    api.get<SupplierProduct[]>(`${BASE}/${p}/products${supplierId ? `?supplierId=${supplierId}` : ''}`),
  createPriceList: (p: string, dto: CreatePriceListDto) => api.post(`${BASE}/${p}/price-lists`, dto),
  updatePriceList: (p: string, id: string, dto: UpdatePriceListDto) =>
    api.patch(`${BASE}/${p}/price-lists/${id}`, dto),

  // رأس المال: الرصيد الحالي وحركات الإضافة والنقص
  capital: (p: string) => api.get<CapitalState>(`${BASE}/${p}/capital`),
  addCapital: (p: string, dto: CapitalMovementInput) =>
    api.post<CapitalState>(`${BASE}/${p}/capital`, dto),
  deleteCapital: (p: string, id: string) => api.del<CapitalState>(`${BASE}/${p}/capital/${id}`),

  // الدفعات: ما تسلّمه الاسم من مستحقه
  payments: (p: string) => api.get<PaymentsState>(`${BASE}/${p}/payments`),
  addPayment: (p: string, dto: PaymentInput) =>
    api.post<PaymentsState>(`${BASE}/${p}/payments`, dto),
  deletePayment: (p: string, id: string) => api.del<PaymentsState>(`${BASE}/${p}/payments/${id}`),

  // التصفية الثابتة: أصناف من فواتير الشراء، ولكل صنف مبلغ للوحدة أو نسبة
  fixed: (p: string) => api.get<FixedItem[]>(`${BASE}/${p}/fixed`),
  searchItems: (p: string, q: string, from?: string, to?: string) => {
    const qs = new URLSearchParams({ q, ...(from ? { from } : {}), ...(to ? { to } : {}) });
    return api.get<ItemSearchInvoice[]>(`${BASE}/${p}/items/search?${qs}`);
  },
  addItems: (p: string, items: ItemRef[]) => api.post(`${BASE}/${p}/items`, { items }),
  removeItem: (p: string, ref: ItemRef) => api.del<void>(`${BASE}/${p}/items/${ref.invoiceId}/${ref.productId}`),
  setItemRate: (p: string, ref: ItemRef, body: { rate: number } | { percent: number }) =>
    api.put<FixedItem>(`${BASE}/${p}/items/${ref.invoiceId}/${ref.productId}`, body),

  // اختيار فواتير البيع للتصفية برأس المال
  candidates: (p: string) => api.get<Vehicle[]>(`${BASE}/${p}/candidates`),
  vehicle: (p: string, id: string) => api.get<VehicleDetail>(`${BASE}/${p}/vehicles/${id}`),
  select: (p: string, invoiceIds: string[]) => api.post(`${BASE}/${p}/vehicles`, { invoiceIds }),
  selectAll: (p: string) => api.post(`${BASE}/${p}/vehicles-all`, {}),
  unselect: (p: string, id: string) => api.del<void>(`${BASE}/${p}/vehicles/${id}`),
  updateVehicle: (p: string, id: string, dto: UpdateVehicleDto) =>
    api.patch<VehicleDetail>(`${BASE}/${p}/vehicles/${id}`, dto),
  setItemWeek: (p: string, invoiceId: string, productId: string, priceListId: string | null) =>
    api.put(`${BASE}/${p}/vehicles/${invoiceId}/week`, { productId, priceListId }),
};
