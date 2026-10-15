export interface AppConfig {
  id: number;
  orderEmail: string;
  delayGraceDays: number;
  delayFeePerDay: number;
  /** نصيب نشاط الشحن % من المصاريف المشتركة (المرتبات) */
  salaryShippingPct: number;
}

export interface UpdateConfigDto {
  orderEmail?: string;
  delayGraceDays?: number;
  delayFeePerDay?: number;
  salaryShippingPct?: number;
}
