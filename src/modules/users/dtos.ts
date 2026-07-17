export interface User {
  id: string;
  username?: string | null;
  name: string;
  admin: boolean;
  isPrimary?: boolean;
  views: string[];
  ledgerPartyIds: string[];
  treasuryIds: string[];
  role: 'STAFF' | 'CUSTOMER';
  party?: { id: string; name: string } | null;
  createdAt?: string;
  lastSeenAt?: string | null;
  online?: boolean;
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
