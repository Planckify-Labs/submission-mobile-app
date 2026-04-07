export type TCreateAddressBookDto = {
  label: string;
  address: string;
  ensName?: string;
  notes?: string;
  chainName?: string;
  isEvm?: boolean;
};

export type TUpdateAddressBookDto = Partial<TCreateAddressBookDto>;
