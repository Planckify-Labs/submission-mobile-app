/**
 * Pure receipt decoder — maps raw transaction receipts + events into
 * decoded WalletTransaction fields. No network calls.
 *
 * Uses viem's decodeEventLog for structured event parsing.
 */

import {
  type Hex,
  type Log,
  decodeEventLog,
  decodeAbiParameters,
  getAddress,
  parseAbi,
  erc20Abi,
} from "viem";
import type {
  TxType,
  TokenTransfer,
  NFTTransfer,
} from "@/services/indexer/types";

// ─── ABIs for event decoding ─────────────────────────────────────────

const erc721Abi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);

const erc1155Abi = parseAbi([
  "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
  "event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)",
]);

// ─── Known function selectors ────────────────────────────────────────

const SWAP_SELECTORS = new Set([
  "0x38ed1739", // swapExactTokensForTokens (Uniswap V2)
  "0x8803dbee", // swapTokensForExactTokens (V2)
  "0x7ff36ab5", // swapExactETHForTokens (V2)
  "0x18cbafe5", // swapExactTokensForETH (V2)
  "0x04e45aaf", // exactInputSingle (V3)
  "0xb858183f", // exactInput (V3)
  "0x5023b4df", // exactOutputSingle (V3)
  "0x09b81346", // exactOutput (V3)
  "0x3593564c", // execute (Universal Router)
  "0x24856bc3", // execute (Universal Router v2)
]);

const APPROVE_SELECTOR = "0x095ea7b3";

// ─── Types ───────────────────────────────────────────────────────────

export interface RawLog {
  address: string;
  topics: string[];
  data: string;
}

export interface DecoderInput {
  to: string | null;
  from: string;
  value: bigint;
  input: string;
  logs: RawLog[];
  contractCreated?: boolean;
}

export interface DecoderOutput {
  type: TxType;
  functionName?: string;
  tokenTransfers: TokenTransfer[];
  nftTransfers: NFTTransfer[];
}

// ─── Decoder ─────────────────────────────────────────────────────────

export function decodeTx(tx: DecoderInput): DecoderOutput {
  const tokenTransfers: TokenTransfer[] = [];
  const nftTransfers: NFTTransfer[] = [];

  for (const log of tx.logs) {
    if (!log.topics[0]) continue;

    const viemLog = {
      address: getAddress(log.address),
      topics: log.topics as [Hex, ...Hex[]],
      data: log.data as Hex,
    };

    // Try ERC-20 Transfer (3 topics: event sig + from + to)
    if (log.topics.length === 3) {
      try {
        const decoded = decodeEventLog({
          abi: erc20Abi,
          ...viemLog,
          strict: false,
        });
        if (decoded.eventName === "Transfer") {
          const args = decoded.args as { from: string; to: string; value: bigint };
          tokenTransfers.push({
            contractAddress: log.address,
            from: args.from.toLowerCase(),
            to: args.to.toLowerCase(),
            value: args.value,
          });
          continue;
        }
      } catch {
        // Not an ERC-20 Transfer
      }
    }

    // Try ERC-721 Transfer (4 topics: event sig + from + to + tokenId)
    if (log.topics.length === 4) {
      try {
        const decoded = decodeEventLog({
          abi: erc721Abi,
          ...viemLog,
          strict: false,
        });
        if (decoded.eventName === "Transfer") {
          const args = decoded.args as { from: string; to: string; tokenId: bigint };
          nftTransfers.push({
            contractAddress: log.address,
            from: args.from.toLowerCase(),
            to: args.to.toLowerCase(),
            tokenId: args.tokenId.toString(),
            amount: 1,
            tokenType: "ERC-721",
          });
          continue;
        }
      } catch {
        // Not an ERC-721 Transfer
      }
    }

    // Try ERC-1155 TransferSingle
    try {
      const decoded = decodeEventLog({
        abi: erc1155Abi,
        ...viemLog,
        strict: false,
      });
      if (decoded.eventName === "TransferSingle") {
        const args = decoded.args as {
          operator: string; from: string; to: string;
          id: bigint; value: bigint;
        };
        nftTransfers.push({
          contractAddress: log.address,
          from: args.from.toLowerCase(),
          to: args.to.toLowerCase(),
          tokenId: args.id.toString(),
          amount: Number(args.value),
          tokenType: "ERC-1155",
        });
        continue;
      }
      if (decoded.eventName === "TransferBatch") {
        const args = decoded.args as {
          operator: string; from: string; to: string;
          ids: readonly bigint[]; values: readonly bigint[];
        };
        for (let i = 0; i < args.ids.length; i++) {
          nftTransfers.push({
            contractAddress: log.address,
            from: args.from.toLowerCase(),
            to: args.to.toLowerCase(),
            tokenId: args.ids[i].toString(),
            amount: Number(args.values[i]),
            tokenType: "ERC-1155",
          });
        }
        continue;
      }
    } catch {
      // Not an ERC-1155 event
    }
  }

  const type = classifyTx(tx, tokenTransfers, nftTransfers);
  const functionName = extractFunctionName(tx.input);

  return { type, functionName, tokenTransfers, nftTransfers };
}

function classifyTx(
  tx: DecoderInput,
  tokenTransfers: TokenTransfer[],
  nftTransfers: NFTTransfer[],
): TxType {
  if (tx.contractCreated || !tx.to) return "contract-deploy";

  const selector = tx.input.slice(0, 10).toLowerCase();

  if (SWAP_SELECTORS.has(selector)) return "swap";
  if (selector === APPROVE_SELECTOR) return "token-approve";
  if (nftTransfers.length > 0 && tokenTransfers.length === 0) return "nft-transfer";
  if (tokenTransfers.length > 0 && nftTransfers.length === 0) {
    if (tokenTransfers.length >= 2) return "swap";
    return "token-transfer";
  }
  if (tx.value > 0n && tx.input === "0x") return "native-transfer";
  if (tx.input.length > 2) return "contract-interaction";

  return tx.value > 0n ? "native-transfer" : "unknown";
}

function extractFunctionName(input: string): string | undefined {
  if (!input || input === "0x" || input.length < 10) return undefined;
  return input.slice(0, 10);
}
