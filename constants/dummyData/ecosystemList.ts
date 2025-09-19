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
  icon: React.ReactNode;
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
    imageUrl: "https://app.uniswap.org/favicon.ico",
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
    imageUrl: "https://app.aave.com/favicon.ico",
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
    imageUrl: "https://axieinfinity.com/favicon.ico",
    backgroundColor: "#4285F4",
    textColor: "#FFFFFF",
  },
  {
    id: "opensea-promo",
    title: "Discover NFTs",
    subtitle: "OpenSea Marketplace",
    description: "Buy, sell, and discover exclusive digital items",
    url: "https://opensea.io",
    imageUrl: "https://opensea.io/favicon.ico",
    backgroundColor: "#2081E2",
    textColor: "#FFFFFF",
  },
];

export const getWeb3EcosystemCategories = (): TDAppCategory[] => [
  {
    id: "dex",
    title: "Decentralized Exchange",
    description: "Trade tokens directly from your wallet",
    icon: React.createElement(Coins, { color: "#c71c4b", size: 24 }),
    color: "bg-light-primary-red/10",
    dapps: [
      {
        id: "uniswap",
        name: "Uniswap",
        description: "The largest DEX on Ethereum",
        url: "https://app.uniswap.org",
        logoUrl: "https://app.uniswap.org/favicon.ico",
        isPopular: true,
      },
      {
        id: "1inch",
        name: "1inch",
        description: "DEX aggregator for best prices",
        url: "https://app.1inch.io",
        logoUrl: "https://app.1inch.io/favicon.ico",
        isPopular: true,
      },
      {
        id: "sushiswap",
        name: "SushiSwap",
        description: "Community-driven DEX",
        url: "https://www.sushi.com/swap",
        logoUrl: "https://www.sushi.com/favicon.ico",
      },
    ],
  },
  {
    id: "defi",
    title: "DeFi Protocols",
    description: "Lending, borrowing, and yield farming",
    icon: React.createElement(TrendingUp, { color: "#c71c4b", size: 24 }),
    color: "bg-light-primary-red/10",
    dapps: [
      {
        id: "aave",
        name: "Aave",
        description: "Decentralized lending protocol",
        url: "https://app.aave.com",
        logoUrl: "https://app.aave.com/favicon.ico",
        isPopular: true,
      },
      {
        id: "compound",
        name: "Compound",
        description: "Algorithmic money markets",
        url: "https://app.compound.finance",
        logoUrl: "https://app.compound.finance/favicon.ico",
      },
      {
        id: "yearn",
        name: "Yearn Finance",
        description: "Yield optimization strategies",
        url: "https://yearn.fi",
        logoUrl: "https://yearn.fi/favicon.ico",
      },
    ],
  },
  {
    id: "launchpad",
    title: "Launchpads",
    description: "Discover and invest in new projects",
    icon: React.createElement(Rocket, { color: "#c71c4b", size: 24 }),
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
    ],
  },
  {
    id: "nft",
    title: "NFT Marketplaces",
    description: "Buy, sell, and trade NFTs",
    icon: React.createElement(ShoppingBag, { color: "#c71c4b", size: 24 }),
    color: "bg-light-primary-red/10",
    dapps: [
      {
        id: "opensea",
        name: "OpenSea",
        description: "The largest NFT marketplace",
        url: "https://opensea.io",
        logoUrl: "https://opensea.io/favicon.ico",
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
        id: "foundation",
        name: "Foundation",
        description: "Curated NFT platform",
        url: "https://foundation.app",
        logoUrl: "https://foundation.app/favicon.ico",
      },
    ],
  },
  {
    id: "gaming",
    title: "Gaming & Metaverse",
    description: "Play-to-earn games and virtual worlds",
    icon: React.createElement(Zap, { color: "#c71c4b", size: 24 }),
    color: "bg-light-primary-red/10",
    dapps: [
      {
        id: "decentraland",
        name: "Decentraland",
        description: "Virtual reality platform",
        url: "https://play.decentraland.org",
        logoUrl: "https://decentraland.org/favicon.ico",
        isPopular: true,
      },
      {
        id: "sandbox",
        name: "The Sandbox",
        description: "Gaming metaverse",
        url: "https://www.sandbox.game/en/",
        logoUrl: "https://www.sandbox.game/favicon.ico",
      },
      {
        id: "axie",
        name: "Axie Infinity",
        description: "Play-to-earn NFT game",
        url: "https://axieinfinity.com",
        logoUrl: "https://axieinfinity.com/favicon.ico",
        isPopular: true,
      },
      {
        id: "stepn",
        name: "STEPN",
        description: "Move-to-earn fitness app",
        url: "https://stepn.com",
        logoUrl: "https://stepn.com/favicon.ico",
      },
    ],
  },
  {
    id: "tools",
    title: "Web3 Tools",
    description: "Analytics, portfolio tracking, and utilities",
    icon: React.createElement(Globe, { color: "#c71c4b", size: 24 }),
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
    ],
  },
];
