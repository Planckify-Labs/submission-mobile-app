import {
  type Chain as ViemChain,
  bsc,
  goerli,
  mainnet,
  polygon,
  polygonMumbai,
} from "viem/chains";

export interface Chain extends Omit<ViemChain, "rpcUrls"> {
  id: number;
  name: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: {
    default: {
      http: string[];
    };
    public?: {
      http: string[];
    };
  };
  blockExplorers?: {
    default: {
      name: string;
      url: string;
    };
  };
  iconUrl?: string;
  isTestnet?: boolean;
}

export const supportedChains: Chain[] = [
  {
    ...mainnet,
    rpcUrls: {
      default: {
        http: [...mainnet.rpcUrls.default.http],
      },
      public: {
        http: [...mainnet.rpcUrls.default.http],
      },
    },
    iconUrl:
      "https://ethereum.org/static/6b935ac0e6194247347855dc3d328e83/13c43/eth-diamond-black.png",
  },
  {
    ...polygon,
    rpcUrls: {
      default: {
        http: [...polygon.rpcUrls.default.http],
      },
      public: {
        http: [...polygon.rpcUrls.default.http],
      },
    },
    iconUrl: "https://polygon.technology/favicon.ico",
  },
  {
    ...bsc,
    rpcUrls: {
      default: {
        http: [...bsc.rpcUrls.default.http],
      },
      public: {
        http: [...bsc.rpcUrls.default.http],
      },
    },
    iconUrl: "https://bscscan.com/images/svg/brands/bnb.svg",
  },
  {
    ...goerli,
    rpcUrls: {
      default: {
        http: [...goerli.rpcUrls.default.http],
      },
      public: {
        http: [...goerli.rpcUrls.default.http],
      },
    },
    iconUrl:
      "https://ethereum.org/static/6b935ac0e6194247347855dc3d328e83/13c43/eth-diamond-black.png",
    isTestnet: true,
  },
  {
    ...polygonMumbai,
    rpcUrls: {
      default: {
        http: [...polygonMumbai.rpcUrls.default.http],
      },
      public: {
        http: [...polygonMumbai.rpcUrls.default.http],
      },
    },
    iconUrl: "https://polygon.technology/favicon.ico",
    isTestnet: true,
  },
];
