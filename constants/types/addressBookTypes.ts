export type TAddressBookEntry = {
  id: string;
  userId?: string;
  label: string;
  address: string;
  ensName?: string | null;
  notes?: string | null;
  chainName?: string | null;
  isEvm: boolean;
  createdAt: string;
  updatedAt: string;
};
