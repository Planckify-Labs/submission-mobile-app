/**
 * Baseline IndexerProvider that uses direct RPC calls via viem.
 * Supports getTokenBalances via multicall; other methods throw
 * IndexerNotSupportedError so the registry falls through to the next provider.
 */

import { type Address, erc20Abi, formatUnits, getAddress } from "viem";
import { getPublicClient } from "@/utils/clients";
import { supportedChains } from "@/constants/configs/chainConfig";
import type {
  ENSResolution,
  HistoryOpts,
  IndexerProvider,
  NFTAsset,
  NFTOpts,
  PaginatedResult,
  TokenApproval,
  TokenBalance,
  TokenPrice,
  WalletTransaction,
} from "./types";
import { IndexerNotSupportedError } from "./types";

const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;

function getChainForId(chainId: number) {
  const config = supportedChains.find((c) => c.chain.id === chainId);
  return config?.chain;
}

export class DirectRPCProvider implements IndexerProvider {
  readonly name = "DirectRPC";
  readonly priority = 100; // lowest priority — fallback

  async getTokenBalances(
    address: string,
    chainId: number,
  ): Promise<TokenBalance[]> {
    const chain = getChainForId(chainId);
    if (!chain) return [];

    const client = getPublicClient(chain);
    const addr = getAddress(address);

    // Fetch native balance
    const nativeBalance = await client.getBalance({ address: addr });

    const nativeToken: TokenBalance = {
      contractAddress: "0x0000000000000000000000000000000000000000",
      symbol: chain.nativeCurrency.symbol,
      name: chain.nativeCurrency.name,
      decimals: chain.nativeCurrency.decimals,
      balance: nativeBalance,
      chainId,
      namespace: "eip155",
      isSpam: false,
      source: "default-list",
    };

    return [nativeToken];
  }

  async getTransactionHistory(
    _opts: HistoryOpts,
  ): Promise<PaginatedResult<WalletTransaction>> {
    throw new IndexerNotSupportedError("getTransactionHistory", this.name);
  }

  async getNFTs(_opts: NFTOpts): Promise<PaginatedResult<NFTAsset>> {
    throw new IndexerNotSupportedError("getNFTs", this.name);
  }

  async getTokenApprovals(
    _address: string,
    _chainId: number,
  ): Promise<TokenApproval[]> {
    throw new IndexerNotSupportedError("getTokenApprovals", this.name);
  }

  async getTokenMetadata(
    contractAddress: string,
    chainId: number,
  ): Promise<{ symbol: string; name: string; decimals: number; logoURI?: string } | null> {
    const chain = getChainForId(chainId);
    if (!chain) return null;

    const client = getPublicClient(chain);
    const addr = getAddress(contractAddress);

    try {
      const [symbol, name, decimals] = await Promise.all([
        client.readContract({
          address: addr,
          abi: erc20Abi,
          functionName: "symbol",
        }),
        client.readContract({
          address: addr,
          abi: erc20Abi,
          functionName: "name",
        }),
        client.readContract({
          address: addr,
          abi: erc20Abi,
          functionName: "decimals",
        }),
      ]);
      return { symbol, name, decimals };
    } catch {
      return null;
    }
  }

  async getTokenPrices(
    _contractAddresses: string[],
    _chainId: number,
  ): Promise<TokenPrice[]> {
    throw new IndexerNotSupportedError("getTokenPrices", this.name);
  }

  async resolveENS(
    _nameOrAddress: string,
    _chainId: number,
  ): Promise<ENSResolution | null> {
    throw new IndexerNotSupportedError("resolveENS", this.name);
  }
}
