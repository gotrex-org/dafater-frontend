/** بند شحن على الفواتير (نولون/تحميل/شفتنة…) — قائمة تتعدّل من الإعدادات. */
export interface ChargeType {
  id: string;
  name: string;
  sortOrder: number;
  hidden: boolean;
  _count?: { charges: number };
}

export interface ChargeTypeDto {
  name?: string;
  sortOrder?: number;
  hidden?: boolean;
}
