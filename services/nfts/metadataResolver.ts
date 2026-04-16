/**
 * NFT metadata resolution chain:
 * 1. Indexer response (primary)
 * 2. tokenURI on-chain call (fallback)
 * 3. IPFS gateway resolution
 * 4. Arweave gateway
 */

import * as SQLite from "expo-sqlite";
// expo-file-system used for image caching
import { getPublicClient } from "@/utils/clients";
import { supportedChains } from "@/constants/configs/chainConfig";
import { getAddress } from "viem";

const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://w3s.link/ipfs/",
];

const ARWEAVE_GATEWAY = "https://arweave.net/";

const ERC721_TOKEN_URI_ABI = [
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "tokenURI",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const ERC1155_URI_ABI = [
  {
    inputs: [{ name: "id", type: "uint256" }],
    name: "uri",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync("nft_metadata.db");
    db.execSync(
      "CREATE TABLE IF NOT EXISTS metadata (" +
        "contract_address TEXT NOT NULL, " +
        "token_id TEXT NOT NULL, " +
        "chain_id INTEGER NOT NULL, " +
        "name TEXT, " +
        "description TEXT, " +
        "image_url TEXT, " +
        "animation_url TEXT, " +
        "attributes TEXT, " +
        "cached_at INTEGER NOT NULL, " +
        "PRIMARY KEY (contract_address, token_id, chain_id)" +
        ");"
    );
  }
  return db;
}

export interface NFTMetadata {
  name: string;
  description?: string;
  imageUrl?: string;
  animationUrl?: string;
  attributes: Array<{ traitType: string; value: string | number; displayType?: string }>;
}

export async function resolveMetadata(
  contractAddress: string,
  tokenId: string,
  chainId: number,
  tokenType: "ERC-721" | "ERC-1155",
): Promise<NFTMetadata | null> {
  const cached = getCachedMetadata(contractAddress, tokenId, chainId);
  if (cached) return cached;

  const uri = await fetchTokenURI(contractAddress, tokenId, chainId, tokenType);
  if (uri) {
    const metadata = await fetchMetadataFromURI(uri);
    if (metadata) {
      cacheMetadata(contractAddress, tokenId, chainId, metadata);
      return metadata;
    }
  }

  return null;
}

async function fetchTokenURI(
  contractAddress: string,
  tokenId: string,
  chainId: number,
  tokenType: "ERC-721" | "ERC-1155",
): Promise<string | null> {
  const chain = supportedChains.find((c) => c.chain.id === chainId)?.chain;
  if (!chain) return null;

  const client = getPublicClient(chain);

  try {
    const abi = tokenType === "ERC-721" ? ERC721_TOKEN_URI_ABI : ERC1155_URI_ABI;
    const functionName = tokenType === "ERC-721" ? "tokenURI" : "uri";

    const result = await client.readContract({
      address: getAddress(contractAddress),
      abi,
      functionName,
      args: [BigInt(tokenId)],
    });

    return result as string;
  } catch {
    return null;
  }
}

async function fetchMetadataFromURI(uri: string): Promise<NFTMetadata | null> {
  const resolvedUrl = resolveURI(uri);
  if (!resolvedUrl) return null;

  try {
    const response = await fetch(resolvedUrl, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;

    const json = await response.json();
    return {
      name: json.name ?? "Unknown",
      description: json.description,
      imageUrl: resolveURI(json.image ?? json.image_url),
      animationUrl: resolveURI(json.animation_url),
      attributes: (json.attributes ?? []).map((a: Record<string, unknown>) => ({
        traitType: a.trait_type ?? a.traitType ?? "",
        value: a.value ?? "",
        displayType: a.display_type ?? a.displayType,
      })),
    };
  } catch {
    return null;
  }
}

function resolveURI(uri: string | undefined | null): string | undefined {
  if (!uri) return undefined;
  if (uri.startsWith("ipfs://")) return `${IPFS_GATEWAYS[0]}${uri.replace("ipfs://", "")}`;
  if (uri.startsWith("ar://")) return `${ARWEAVE_GATEWAY}${uri.replace("ar://", "")}`;
  if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;
  if (uri.startsWith("data:")) return uri;
  return undefined;
}

function getCachedMetadata(contractAddress: string, tokenId: string, chainId: number): NFTMetadata | null {
  const database = getDb();
  const row = database.getFirstSync<{
    name: string; description: string | null; image_url: string | null;
    animation_url: string | null; attributes: string; cached_at: number;
  }>(
    "SELECT * FROM metadata WHERE contract_address = ? AND token_id = ? AND chain_id = ?",
    [contractAddress, tokenId, chainId],
  );
  if (!row || Date.now() - row.cached_at > 86_400_000) return null;
  return {
    name: row.name,
    description: row.description ?? undefined,
    imageUrl: row.image_url ?? undefined,
    animationUrl: row.animation_url ?? undefined,
    attributes: JSON.parse(row.attributes || "[]"),
  };
}

function cacheMetadata(contractAddress: string, tokenId: string, chainId: number, metadata: NFTMetadata): void {
  const database = getDb();
  database.runSync(
    "INSERT OR REPLACE INTO metadata (contract_address, token_id, chain_id, name, description, image_url, animation_url, attributes, cached_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [contractAddress, tokenId, chainId, metadata.name, metadata.description ?? null,
     metadata.imageUrl ?? null, metadata.animationUrl ?? null, JSON.stringify(metadata.attributes), Date.now()],
  );
}

export async function cacheImage(_imageUrl: string, _key: string): Promise<string | null> {
  // Image caching deferred — will use expo-image's built-in cache
  // which handles download + disk persistence automatically.
  // Returning the original URL for now; expo-image caches it internally.
  return _imageUrl || null;
}
