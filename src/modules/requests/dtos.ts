export interface RequestItem {
  id?: string;
  name: string;
  qty: number;
  received?: number;
}

export interface ReceiveItem {
  id: string;
  received: number;
}

export interface ClientRequest {
  id: string;
  date: string;
  clientId: string;
  note?: string | null;
  done: boolean;
  client?: { name: string };
  items: RequestItem[];
}

export interface CreateRequestDto {
  date: string;
  clientId: string;
  note?: string;
  items: RequestItem[];
}
