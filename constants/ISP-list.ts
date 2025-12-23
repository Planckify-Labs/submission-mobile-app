export type ProviderKey =
  | "TELKOMSEL"
  | "XL"
  | "INDOSAT"
  | "TRI"
  | "AXIS"
  | "SMARTFREN"
  | "BYU";

export interface ProviderConfig {
  name: string;
  prefixes: string[];
  productId: string;
}

const PROVIDER_PRODUCT_IDS = {
  XL: process.env.EXPO_PUBLIC_PROVIDER_XL || "",
  TELKOMSEL: process.env.EXPO_PUBLIC_PROVIDER_TELKOMSEL || "",
  INDOSAT: process.env.EXPO_PUBLIC_PROVIDER_INDOSAT || "",
  SMARTFREN: process.env.EXPO_PUBLIC_PROVIDER_SMARTFREN || "",
  AXIS: process.env.EXPO_PUBLIC_PROVIDER_AXIS || "",
  TRI: process.env.EXPO_PUBLIC_PROVIDER_TRI || "",
  BYU: process.env.EXPO_PUBLIC_PROVIDER_BYU || "",
};

export const PROVIDER_CONFIG: Record<ProviderKey, ProviderConfig> = {
  TELKOMSEL: {
    name: "Telkomsel",
    prefixes: [
      "0811",
      "0812",
      "0813",
      "0821",
      "0822",
      "0823",
      "0851",
      "0852",
      "0853",
    ],
    productId: PROVIDER_PRODUCT_IDS.TELKOMSEL,
  },
  XL: {
    name: "XL",
    prefixes: ["0817", "0818", "0819", "0859", "0877", "0878"],
    productId: PROVIDER_PRODUCT_IDS.XL,
  },
  INDOSAT: {
    name: "Indosat",
    prefixes: ["0814", "0815", "0816", "0855", "0856", "0857", "0858"],
    productId: PROVIDER_PRODUCT_IDS.INDOSAT,
  },
  TRI: {
    name: "Tri",
    prefixes: ["0895", "0896", "0897", "0898", "0899"],
    productId: PROVIDER_PRODUCT_IDS.TRI,
  },
  AXIS: {
    name: "Axis",
    prefixes: ["0831", "0832", "0833", "0838"],
    productId: PROVIDER_PRODUCT_IDS.AXIS,
  },
  SMARTFREN: {
    name: "Smartfren",
    prefixes: [
      "0881",
      "0882",
      "0883",
      "0884",
      "0885",
      "0886",
      "0887",
      "0888",
      "0889",
    ],
    productId: PROVIDER_PRODUCT_IDS.SMARTFREN,
  },
  BYU: {
    name: "by.U",
    prefixes: ["0851", "0852", "0853"],
    productId: PROVIDER_PRODUCT_IDS.BYU,
  },
};

export const detectProvider = (phoneNumber: string): ProviderKey | null => {
  const cleanNumber = phoneNumber.replace(/\D/g, "");

  for (const [key, config] of Object.entries(PROVIDER_CONFIG)) {
    for (const prefix of config.prefixes) {
      if (cleanNumber.startsWith(prefix)) {
        return key as ProviderKey;
      }
    }
  }

  return null;
};

export const formatPhoneNumber = (value: string): string => {
  const cleaned = value.replace(/\D/g, "");

  if (cleaned.length <= 4) return cleaned;
  if (cleaned.length <= 8) return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8, 12)}`;
};

export const getProviderByProductId = (
  productId: string,
): ProviderConfig | null => {
  for (const config of Object.values(PROVIDER_CONFIG)) {
    if (config.productId === productId) {
      return config;
    }
  }
  return null;
};
