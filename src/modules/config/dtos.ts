export interface AppConfig {
  id: number;
  orderEmail: string;
  delayGraceDays: number;
  delayFeePerDay: number;
}

export interface UpdateConfigDto {
  orderEmail?: string;
  delayGraceDays?: number;
  delayFeePerDay?: number;
}
