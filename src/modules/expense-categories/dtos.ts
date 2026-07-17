export type ExpenseGroup = 'WAREHOUSE' | 'EXTERNAL';

export interface ExpenseCategory {
  id: string;
  name: string;
  group?: ExpenseGroup;
  addsToGoods?: boolean;
}

export interface CategoryDto {
  name: string;
  group?: ExpenseGroup;
  addsToGoods?: boolean;
}
