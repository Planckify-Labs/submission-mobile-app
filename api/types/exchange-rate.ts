export type TExchangeRate = {
  id: number;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  sourceProvider: Record<string, unknown>;
  region: string;
  provider: string;
  markup: number;
  isActive: boolean;
  createdAt: string;
  cursor: string;
};

export type TExchangeRateParams = {
  fromCurrency?: string;
  toCurrency?: string;
};
