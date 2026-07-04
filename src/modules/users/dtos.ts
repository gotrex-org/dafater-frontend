export interface User {
  id: string;
  username?: string | null;
  name: string;
  admin: boolean;
  views: string[];
  ledgerPartyIds: string[];
  treasuryIds: string[];
  role: 'STAFF' | 'CUSTOMER';
  party?: { id: string; name: string } | null;
  createdAt?: string;
}

export interface CreateUserDto {
  name: string;
  username?: string;
  pin: string;
  admin?: boolean;
  views?: string[];
  ledgerPartyIds?: string[];
  treasuryIds?: string[];
  role?: 'STAFF' | 'CUSTOMER';
  partyId?: string;
}

export type UpdateUserDto = Partial<CreateUserDto>;
