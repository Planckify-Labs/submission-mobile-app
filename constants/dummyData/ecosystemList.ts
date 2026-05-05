import {
  Coins,
  Globe,
  Rocket,
  ShoppingBag,
  TrendingUp,
  Zap,
} from "lucide-react-native";
import React from "react";

export interface TDApp {
  id: string;
  name: string;
  description: string;
  url: string;
  logoUrl: string;
  isPopular?: boolean;
}

export interface TPromotionalItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  url: string;
  imageUrl: string;
  backgroundColor: string;
  textColor: string;
  isSponsored?: boolean;
}

export interface TDAppCategory {
  id: string;
  title: string;
  description: string;
  icon: (isActive: boolean) => React.ReactNode;
  color: string;
  dapps: TDApp[];
}

export const getPromotionalItems = (): TPromotionalItem[] => [
  {
    id: "uniswap-promo",
    title: "Trade on Uniswap",
    subtitle: "#1 DEX on Ethereum",
    description: "Swap tokens with the best liquidity and lowest fees",
    url: "https://app.uniswap.org",
    imageUrl: "https://cryptologos.cc/logos/uniswap-uni-logo.png",
    backgroundColor: "#FF007A",
    textColor: "#FFFFFF",
    isSponsored: true,
  },
  {
    id: "aave-promo",
    title: "Earn with Aave",
    subtitle: "Leading DeFi Protocol",
    description: "Lend, borrow, and earn interest on your crypto assets",
    url: "https://app.aave.com",
    imageUrl: "https://cryptologos.cc/logos/aave-aave-logo.png",
    backgroundColor: "#B6509E",
    textColor: "#FFFFFF",
    isSponsored: true,
  },
  {
    id: "axie-promo",
    title: "Play Axie Infinity",
    subtitle: "Play-to-Earn Gaming",
    description: "Battle, breed, and earn in the most popular NFT game",
    url: "https://axieinfinity.com",
    imageUrl: "https://cryptologos.cc/logos/axie-infinity-axs-logo.png",
    backgroundColor: "#4285F4",
    textColor: "#FFFFFF",
  },
  {
    id: "opensea-promo",
    title: "Discover NFTs",
    subtitle: "OpenSea Marketplace",
    description: "Buy, sell, and discover exclusive digital items",
    url: "https://opensea.io",
    imageUrl:
      "https://storage.googleapis.com/opensea-static/Logomark/Logomark-Blue.png",
    backgroundColor: "#2081E2",
    textColor: "#FFFFFF",
  },
  {
    id: "pancakeswap-promo",
    title: "PancakeSwap",
    subtitle: "Top BSC DEX",
    description: "Trade, earn, and win crypto on the most popular DEX",
    url: "https://pancakeswap.finance",
    imageUrl: "https://cryptologos.cc/logos/pancakeswap-cake-logo.png",
    backgroundColor: "#1FC7D4",
    textColor: "#FFFFFF",
  },
  {
    id: "jupiter-promo",
    title: "Swap on Jupiter",
    subtitle: "Best routes on Solana",
    description: "Aggregated liquidity across every Solana DEX in one click",
    url: "https://jup.ag",
    imageUrl: "https://jup.ag/favicon.ico",
    backgroundColor: "#14F195",
    textColor: "#000000",
    isSponsored: true,
  },
  {
    id: "magiceden-promo",
    title: "Magic Eden",
    subtitle: "Multi-chain NFT marketplace",
    description: "The #1 NFT marketplace on Solana, also on Bitcoin & EVM",
    url: "https://magiceden.io",
    imageUrl: "https://magiceden.io/favicon.ico",
    backgroundColor: "#E42575",
    textColor: "#FFFFFF",
  },
  {
    id: "cetus-promo",
    title: "Trade on Cetus",
    subtitle: "Top Sui DEX & CLMM",
    description: "Concentrated liquidity AMM with the deepest pools on Sui",
    url: "https://app.cetus.zone",
    imageUrl: "https://app.cetus.zone/favicon.ico",
    backgroundColor: "#2BC9C8",
    textColor: "#FFFFFF",
    isSponsored: true,
  },
  {
    id: "suilend-promo",
    title: "Earn with Suilend",
    subtitle: "Lending on Sui",
    description: "Borrow, lend, and farm interest on Sui-native assets",
    url: "https://suilend.fi",
    imageUrl: "https://suilend.fi/favicon.ico",
    backgroundColor: "#101116",
    textColor: "#FFFFFF",
  },
];

export const getPopularDApps = (): TDApp[] => [
  {
    id: "uniswap",
    name: "Uniswap",
    description: "The largest DEX on Ethereum",
    url: "https://app.uniswap.org",
    logoUrl: "https://cryptologos.cc/logos/uniswap-uni-logo.png",
    isPopular: true,
  },
  {
    id: "aave",
    name: "Aave",
    description: "Decentralized lending protocol",
    url: "https://app.aave.com",
    logoUrl: "https://cryptologos.cc/logos/aave-aave-logo.png",
    isPopular: true,
  },
  {
    id: "opensea",
    name: "OpenSea",
    description: "The largest NFT marketplace",
    url: "https://opensea.io",
    logoUrl:
      "https://storage.googleapis.com/opensea-static/Logomark/Logomark-Blue.png",
    isPopular: true,
  },
  {
    id: "1inch",
    name: "1inch",
    description: "DEX aggregator for best prices",
    url: "https://app.1inch.io",
    logoUrl: "https://cryptologos.cc/logos/1inch-1inch-logo.png",
    isPopular: true,
  },
  {
    id: "pancakeswap",
    name: "PancakeSwap",
    description: "Leading DEX on BSC",
    url: "https://pancakeswap.finance",
    logoUrl: "https://cryptologos.cc/logos/pancakeswap-cake-logo.png",
    isPopular: true,
  },
  {
    id: "curve",
    name: "Curve Finance",
    description: "Stablecoin exchange",
    url: "https://curve.fi",
    logoUrl: "https://cryptologos.cc/logos/curve-dao-token-crv-logo.png",
    isPopular: true,
  },
  {
    id: "blur",
    name: "Blur",
    description: "Pro NFT marketplace",
    url: "https://blur.io",
    logoUrl: "https://blur.io/favicon.ico",
    isPopular: true,
  },
  {
    id: "dextools",
    name: "DEXTools",
    description: "Trading analytics platform",
    url: "https://www.dextools.io",
    logoUrl: "https://www.dextools.io/favicon.ico",
    isPopular: true,
  },
  {
    id: "jupiter",
    name: "Jupiter",
    description: "Aggregator for the best Solana swap routes",
    url: "https://jup.ag",
    logoUrl: "https://jup.ag/favicon.ico",
    isPopular: true,
  },
  {
    id: "raydium",
    name: "Raydium",
    description: "Leading AMM and liquidity provider on Solana",
    url: "https://raydium.io",
    logoUrl: "https://raydium.io/favicon.ico",
    isPopular: true,
  },
  {
    id: "magiceden",
    name: "Magic Eden",
    description: "The #1 NFT marketplace on Solana",
    url: "https://magiceden.io",
    logoUrl: "https://magiceden.io/favicon.ico",
    isPopular: true,
  },
  {
    id: "marinade",
    name: "Marinade",
    description: "Liquid staking for SOL",
    url: "https://marinade.finance",
    logoUrl: "https://marinade.finance/favicon.ico",
    isPopular: true,
  },
  {
    id: "cetus",
    name: "Cetus",
    description: "Top CLMM-based DEX on Sui",
    url: "https://app.cetus.zone",
    logoUrl: "https://app.cetus.zone/favicon.ico",
    isPopular: true,
  },
  {
    id: "suilend",
    name: "Suilend",
    description: "Lending and borrowing on Sui",
    url: "https://suilend.fi",
    logoUrl: "https://suilend.fi/favicon.ico",
    isPopular: true,
  },
  {
    id: "navi",
    name: "Navi Protocol",
    description: "One-stop liquidity protocol on Sui",
    url: "https://app.naviprotocol.io",
    logoUrl: "https://app.naviprotocol.io/favicon.ico",
    isPopular: true,
  },
];

export const getWeb3EcosystemCategories = (): TDAppCategory[] => [
  {
    id: "dex",
    title: "Decentralized Exchange",
    description: "Trade tokens directly from your wallet",
    icon: (isActive: boolean) =>
      React.createElement(Coins, {
        color: isActive ? "white" : "#c71c4b",
        size: 24,
      }),
    color: "bg-light-primary-red/10",
    dapps: [
      {
        id: "uniswap",
        name: "Uniswap",
        description: "The largest DEX on Ethereum",
        url: "https://app.uniswap.org",
        logoUrl: "https://cryptologos.cc/logos/uniswap-uni-logo.png",
        isPopular: true,
      },
      {
        id: "1inch",
        name: "1inch",
        description: "DEX aggregator for best prices",
        url: "https://app.1inch.io",
        logoUrl: "https://cryptologos.cc/logos/1inch-1inch-logo.png",
        isPopular: true,
      },
      {
        id: "sushiswap",
        name: "SushiSwap",
        description: "Community-driven DEX",
        url: "https://www.sushi.com/swap",
        logoUrl: "https://cryptologos.cc/logos/sushiswap-sushi-logo.png",
      },
      {
        id: "pancakeswap",
        name: "PancakeSwap",
        description: "Leading DEX on BSC",
        url: "https://pancakeswap.finance",
        logoUrl: "https://cryptologos.cc/logos/pancakeswap-cake-logo.png",
      },
      {
        id: "curve",
        name: "Curve Finance",
        description: "Stablecoin exchange",
        url: "https://curve.fi",
        logoUrl: "https://cryptologos.cc/logos/curve-dao-token-crv-logo.png",
      },
      {
        id: "jupiter",
        name: "Jupiter",
        description: "Solana swap aggregator — best prices across DEXs",
        url: "https://jup.ag",
        logoUrl: "https://jup.ag/favicon.ico",
        isPopular: true,
      },
      {
        id: "raydium",
        name: "Raydium",
        description: "Top AMM on Solana",
        url: "https://raydium.io",
        logoUrl: "https://raydium.io/favicon.ico",
      },
      {
        id: "orca",
        name: "Orca",
        description: "User-friendly DEX on Solana",
        url: "https://www.orca.so",
        logoUrl: "https://www.orca.so/favicon.ico",
      },
      {
        id: "cetus",
        name: "Cetus",
        description: "Top CLMM-based DEX on Sui",
        url: "https://app.cetus.zone",
        logoUrl: "https://app.cetus.zone/favicon.ico",
        isPopular: true,
      },
      {
        id: "aftermath",
        name: "Aftermath",
        description: "Multi-pool AMM and aggregator on Sui",
        url: "https://aftermath.finance",
        logoUrl: "https://aftermath.finance/favicon.ico",
      },
      {
        id: "bluefin",
        name: "Bluefin",
        description: "On-chain derivatives + spot on Sui",
        url: "https://trade.bluefin.io",
        logoUrl: "https://trade.bluefin.io/favicon.ico",
      },
    ],
  },
  {
    id: "defi",
    title: "DeFi Protocols",
    description: "Lending, borrowing, and yield farming",
    icon: (isActive: boolean) =>
      React.createElement(TrendingUp, {
        color: isActive ? "white" : "#c71c4b",
        size: 24,
      }),
    color: "bg-light-primary-red/10",
    dapps: [
      {
        id: "aave",
        name: "Aave",
        description: "Decentralized lending protocol",
        url: "https://app.aave.com",
        logoUrl: "https://cryptologos.cc/logos/aave-aave-logo.png",
        isPopular: true,
      },
      {
        id: "compound",
        name: "Compound",
        description: "Algorithmic money markets",
        url: "https://app.compound.finance",
        logoUrl: "https://cryptologos.cc/logos/compound-comp-logo.png",
      },
      {
        id: "yearn",
        name: "Yearn Finance",
        description: "Yield optimization strategies",
        url: "https://yearn.fi",
        logoUrl: "https://cryptologos.cc/logos/yearn-finance-yfi-logo.png",
      },
      {
        id: "makerdao",
        name: "MakerDAO",
        description: "Decentralized stablecoin platform",
        url: "https://makerdao.com",
        logoUrl: "https://cryptologos.cc/logos/maker-mkr-logo.png",
      },
      {
        id: "marinade",
        name: "Marinade",
        description: "Liquid staking for SOL (mSOL)",
        url: "https://marinade.finance",
        logoUrl: "https://marinade.finance/favicon.ico",
        isPopular: true,
      },
      {
        id: "kamino",
        name: "Kamino",
        description: "Lending and borrowing on Solana",
        url: "https://app.kamino.finance",
        logoUrl: "https://app.kamino.finance/favicon.ico",
      },
      {
        id: "drift",
        name: "Drift",
        description: "Decentralized perpetuals on Solana",
        url: "https://app.drift.trade",
        logoUrl: "https://app.drift.trade/favicon.ico",
      },
      {
        id: "suilend",
        name: "Suilend",
        description: "Lending and borrowing on Sui",
        url: "https://suilend.fi",
        logoUrl: "https://suilend.fi/favicon.ico",
        isPopular: true,
      },
      {
        id: "navi",
        name: "Navi Protocol",
        description: "One-stop liquidity protocol on Sui",
        url: "https://app.naviprotocol.io",
        logoUrl: "https://app.naviprotocol.io/favicon.ico",
        isPopular: true,
      },
      {
        id: "scallop",
        name: "Scallop",
        description: "Money market protocol on Sui",
        url: "https://app.scallop.io",
        logoUrl: "https://app.scallop.io/favicon.ico",
      },
    ],
  },
  {
    id: "launchpad",
    title: "Launchpads",
    description: "Discover and invest in new projects",
    icon: (isActive: boolean) =>
      React.createElement(Rocket, {
        color: isActive ? "white" : "#c71c4b",
        size: 24,
      }),
    color: "bg-light-primary-red/10",
    dapps: [
      {
        id: "pinksale",
        name: "PinkSale",
        description: "Decentralized launchpad",
        url: "https://www.pinksale.finance",
        logoUrl: "https://www.pinksale.finance/favicon.ico",
        isPopular: true,
      },
      {
        id: "dxsale",
        name: "DxSale",
        description: "Token launch platform",
        url: "https://dxsale.app",
        logoUrl: "https://dxsale.app/favicon.ico",
      },
      {
        id: "gempad",
        name: "GemPad",
        description: "Multi-chain launchpad",
        url: "https://gempad.app",
        logoUrl: "https://gempad.app/favicon.ico",
      },
    ],
  },
  {
    id: "nft",
    title: "NFT Marketplaces",
    description: "Buy, sell, and trade NFTs",
    icon: (isActive: boolean) =>
      React.createElement(ShoppingBag, {
        color: isActive ? "white" : "#c71c4b",
        size: 24,
      }),
    color: "bg-light-primary-red/10",
    dapps: [
      {
        id: "opensea",
        name: "OpenSea",
        description: "The largest NFT marketplace",
        url: "https://opensea.io",
        logoUrl:
          "https://storage.googleapis.com/opensea-static/Logomark/Logomark-Blue.png",
        isPopular: true,
      },
      {
        id: "blur",
        name: "Blur",
        description: "Pro NFT marketplace",
        url: "https://blur.io",
        logoUrl: "https://blur.io/favicon.ico",
        isPopular: true,
      },
      {
        id: "rarible",
        name: "Rarible",
        description: "Community-owned NFT marketplace",
        url: "https://rarible.com",
        logoUrl: "https://rarible.com/favicon.ico",
      },
      {
        id: "foundation",
        name: "Foundation",
        description: "Curated NFT platform",
        url: "https://foundation.app",
        logoUrl: "https://foundation.app/favicon.ico",
      },
      {
        id: "magiceden",
        name: "Magic Eden",
        description: "#1 NFT marketplace on Solana",
        url: "https://magiceden.io",
        logoUrl: "https://magiceden.io/favicon.ico",
        isPopular: true,
      },
      {
        id: "tensor",
        name: "Tensor",
        description: "Pro NFT trading on Solana",
        url: "https://www.tensor.trade",
        logoUrl: "https://www.tensor.trade/favicon.ico",
        isPopular: true,
      },
      {
        id: "tradeport",
        name: "TradePort",
        description: "Multi-chain NFT marketplace (Sui + Aptos)",
        url: "https://www.tradeport.xyz",
        logoUrl: "https://www.tradeport.xyz/favicon.ico",
      },
      {
        id: "bluemove",
        name: "BlueMove",
        description: "Sui-native NFT marketplace",
        url: "https://sui.bluemove.net",
        logoUrl: "https://sui.bluemove.net/favicon.ico",
      },
    ],
  },
  {
    id: "gaming",
    title: "Gaming & Metaverse",
    description: "Play-to-earn games and virtual worlds",
    icon: (isActive: boolean) =>
      React.createElement(Zap, {
        color: isActive ? "white" : "#c71c4b",
        size: 24,
      }),
    color: "bg-light-primary-red/10",
    dapps: [
      {
        id: "decentraland",
        name: "Decentraland",
        description: "Virtual reality platform",
        url: "https://play.decentraland.org",
        logoUrl: "https://cryptologos.cc/logos/decentraland-mana-logo.png",
        isPopular: true,
      },
      {
        id: "sandbox",
        name: "The Sandbox",
        description: "Gaming metaverse",
        url: "https://www.sandbox.game/en/",
        logoUrl: "https://cryptologos.cc/logos/the-sandbox-sand-logo.png",
      },
      {
        id: "axie",
        name: "Axie Infinity",
        description: "Play-to-earn NFT game",
        url: "https://axieinfinity.com",
        logoUrl: "https://cryptologos.cc/logos/axie-infinity-axs-logo.png",
        isPopular: true,
      },
      {
        id: "stepn",
        name: "STEPN",
        description: "Move-to-earn fitness app",
        url: "https://stepn.com",
        logoUrl: "https://stepn.com/favicon.ico",
      },
      {
        id: "illuvium",
        name: "Illuvium",
        description: "Open-world RPG game",
        url: "https://illuvium.io",
        logoUrl: "https://cryptologos.cc/logos/illuvium-ilv-logo.png",
      },
    ],
  },
  {
    id: "tools",
    title: "Web3 Tools",
    description: "Analytics, portfolio tracking, and utilities",
    icon: (isActive: boolean) =>
      React.createElement(Globe, {
        color: isActive ? "white" : "#c71c4b",
        size: 24,
      }),
    color: "bg-light-primary-red/10",
    dapps: [
      {
        id: "dextools",
        name: "DEXTools",
        description: "Trading analytics platform",
        url: "https://www.dextools.io",
        logoUrl: "https://www.dextools.io/favicon.ico",
        isPopular: true,
      },
      {
        id: "debank",
        name: "DeBank",
        description: "DeFi portfolio tracker",
        url: "https://debank.com",
        logoUrl: "https://debank.com/favicon.ico",
      },
      {
        id: "etherscan",
        name: "Etherscan",
        description: "Ethereum block explorer",
        url: "https://etherscan.io",
        logoUrl: "https://etherscan.io/favicon.ico",
      },
      {
        id: "zapper",
        name: "Zapper",
        description: "DeFi portfolio manager",
        url: "https://zapper.xyz",
        logoUrl: "https://zapper.xyz/favicon.ico",
      },
      {
        id: "solscan",
        name: "Solscan",
        description: "Solana block explorer",
        url: "https://solscan.io",
        logoUrl: "https://solscan.io/favicon.ico",
      },
      {
        id: "birdeye",
        name: "Birdeye",
        description: "Multi-chain DEX analytics (Solana-first)",
        url: "https://birdeye.so",
        logoUrl: "https://birdeye.so/favicon.ico",
      },
      {
        id: "step-finance",
        name: "Step Finance",
        description: "Solana portfolio tracker",
        url: "https://app.step.finance",
        logoUrl: "https://app.step.finance/favicon.ico",
      },
      {
        id: "suivision",
        name: "SuiVision",
        description: "Sui block explorer + portfolio",
        url: "https://suivision.xyz",
        logoUrl: "https://suivision.xyz/favicon.ico",
      },
      {
        id: "suiscan",
        name: "Suiscan",
        description: "Sui block explorer",
        url: "https://suiscan.xyz",
        logoUrl: "https://suiscan.xyz/favicon.ico",
      },
      {
        id: "suins",
        name: "SuiNS",
        description: "Naming service for Sui addresses",
        url: "https://suins.io",
        logoUrl: "https://suins.io/favicon.ico",
      },
    ],
  },
];
