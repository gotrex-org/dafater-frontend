export interface ExpenseCategory {
  id: string;
  name: string;
  addsToGoods?: boolean;
}

export interface CategoryDto {
  name: string;
  addsToGoods?: boolean;
}
