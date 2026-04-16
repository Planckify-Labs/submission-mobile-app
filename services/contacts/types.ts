export interface Contact {
  id: string;
  label: string;
  addresses: ContactAddress[];
  notes?: string;
  createdAt: number;
  lastUsedAt: number;
}

export interface ContactAddress {
  namespace: string;
  address: string;
  chainIds?: number[];
  ensName?: string;
}
