import type { Activity } from '@/lib/activity';

export type ExpenseGroup = 'WAREHOUSE' | 'EXTERNAL';

export interface ExpenseCategory {
  id: string;
  name: string;
  group?: ExpenseGroup;
  addsToGoods?: boolean;
  /** النشاط اللي البند بيتحسب عليه — المشترك بيتقسم بنسبة الإعدادات */
  activity?: Activity;
  /** البند بيتربط بعربية (تحميل/شفتنة) */
  vehicleLink?: boolean;
}

export interface CategoryDto {
  name: string;
  group?: ExpenseGroup;
  addsToGoods?: boolean;
  activity?: Activity;
  vehicleLink?: boolean;
}
