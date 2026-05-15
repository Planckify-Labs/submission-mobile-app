/**
 * `installSuiSigner` — wires the dApp-bridge's `SuiAdapter` scaffold to
 * the first-party `SuiWalletKit` so in-WebView Sui dApps (Wallet Standard)
 * can `signPersonalMessage`, `signTransaction`, and
 * `signAndExecuteTransaction` through the same key dwell site the mobile
 * UI uses.
 *
 * Spec reference: `docs/sui-dapp-bridge-spec.md` §10, §11; analogue of
 * `services/chains/solana/signer.ts`.
 *
 * Security gate (TWV-2026-YYY — see
 * `docs/wallet-security-task/66_sui_dapp_bridge_design_note.md`):
 *   - Single kit source of truth: `walletKitRegistry.get("sui")` is
 *     resolved ONCE at install time. Per-request resolution would
 *     widen the window during which a boot-order bug surfaces mid-
 *     session, and pay the map lookup cost on every bridge RPC.
 *   - The signer reaches the keypair through the kit's
 *     `getSignerForWallet` — the dwell site introduced by the
 *     wallet-kit spec (TWV-2026-XXX). No keystore reads in this file.
 *   - No private material logged. On error, only a bounded `__DEV__`
 *     breadcrumb is emitted; signature bytes / tx body / signer
 *     internals are never surfaced.
 *
 * Any PR that adds a sign code path bypassing `getSignerForWallet`
 * MUST cite TWV-2026-YYY in the PR description.
 */

import { SuiJsonRpcClient as SuiClient } from "@mysten/sui/jsonRpc";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

import type { TWallet } from "@/constants/types/walletTypes";
import { walletKitRegistry } from "@/services/walletKit/registry";
import type { SuiNetwork } from "./payloads";
import { registerSuiSigner, type SuiSignerFns } from "./SuiAdapter";

export interface SuiBridgeRpc {
  client: SuiClient;
}

export interface InstallSuiSignerDeps {
  /**
   * Resolve the `TWallet` row for an address the dApp passed in. The
   * adapter does this lookup so the signer can stay address-agnostic
   * (no per-namespace knowledge of how rows are keyed).
   */
  getWalletByAddress: (addr: string) => TWallet | undefined;
  /**
   * Build / cache a `SuiClient` per network. Default mainnet/testnet/
   * devnet endpoints are public Sui Foundation full nodes; private
   * endpoints can ride here when the project provisions them.
   */
  getRpcForNetwork: (network: SuiNetwork) => SuiBridgeRpc;
}

/**
 * Install the kit-backed Sui signer into `SuiAdapter`. Idempotent at the
 * registration seam (`registerSuiSigner` overwrites), but the intent is
 * to call this exactly once after `createSuiAdapter()` in
 * `services/bridge/boot.ts`. Short-circuits silently when the Sui kit
 * is not registered — the bridge boot path warns + auto-retries on the
 * next mount, mirroring the Solana pattern.
 */
/**
 * Last-mile sanity check. Resolves the wallet row for the requested
 * address, fetches its keypair via the kit's `getSignerForWallet`, then
 * verifies the keypair actually derives to the requested address before
 * returning it. Any divergence (wallet row whose `address` field is
 * inconsistent with its `privateKey`, stale cache surviving Fast
 * Refresh, etc.) throws here rather than silently producing a
 * wrong-wallet signature — the symptom dApps surface as "Wallet
 * address mismatch! Connected X, Expected Y".
 */
async function resolveCheckedSigner(
  deps: InstallSuiSignerDeps,
  kit: ReturnType<typeof walletKitRegistry.get>,
  requestedAddress: string,
): Promise<Ed25519Keypair> {
  const wallet = deps.getWalletByAddress(requestedAddress);
  if (!wallet) throw new Error("Unknown wallet");
  const signer = (await kit.getSignerForWallet(
    wallet,
  )) as Ed25519Keypair | null;
  if (!signer) throw new Error("No Sui signer");

  const signerAddress = signer.toSuiAddress();
  if (signerAddress.toLowerCase() !== requestedAddress.toLowerCase()) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.error(
        `[Sui bridge signer] address/keypair mismatch — requested=${requestedAddress}, signer derives to=${signerAddress}`,
      );
    }
    throw new Error(
      `Sui signer/address mismatch: requested ${requestedAddress}, signer derives to ${signerAddress}`,
    );
  }
  return signer;
}

export function installSuiSigner(deps?: InstallSuiSignerDeps): void {
  if (!deps) return;
  if (!walletKitRegistry.has("sui")) return;
  const kit = walletKitRegistry.get("sui");

  const handlers: SuiSignerFns = {
    signPersonalMessage: async (
      address: string,
      messageB64: string,
    ): Promise<{ bytes: string; signature: string }> => {
      try {
        const signer = await resolveCheckedSigner(deps, kit, address);

        const bytes = base64ToBytes(messageB64);
        // `signPersonalMessage` on `Ed25519Keypair` applies the
        // `[0x03, 0x00, 0x00]` PersonalMessage intent prefix and returns
        // `{ signature: <base64 97-byte> }`. Echo `bytes` (in base64)
        // so the dApp can verify against the message it sent.
        const r = await signer.signPersonalMessage(bytes);
        return { bytes: messageB64, signature: r.signature };
      } catch (err) {
        if (typeof __DEV__ !== "undefined" && __DEV__)
          console.error("[Sui bridge signer] signPersonalMessage failed");
        throw err;
      }
    },

    signTransaction: async (
      address: string,
      txBase64: string,
      _network: SuiNetwork,
    ): Promise<{ bytes: string; signature: string }> => {
      void _network;
      try {
        const signer = await resolveCheckedSigner(deps, kit, address);

        const bytes = base64ToBytes(txBase64);
        // `Ed25519Keypair.signTransaction` applies the `TransactionData`
        // intent prefix and returns `{ bytes: <base64>, signature:
        // <base64 97-byte> }`. Bytes are echoed by Wallet Standard.
        const r = await signer.signTransaction(bytes);
        return { bytes: r.bytes, signature: r.signature };
      } catch (err) {
        if (typeof __DEV__ !== "undefined" && __DEV__)
          console.error("[Sui bridge signer] signTransaction failed");
        throw err;
      }
    },

    signAndExecuteTransaction: async (
      address: string,
      txBase64: string,
      network: SuiNetwork,
      options?: Record<string, unknown>,
    ): Promise<{
      digest: string;
      rawEffects?: number[] | string;
      rawTransaction?: string;
      effects?: unknown;
      [k: string]: unknown;
    }> => {
      try {
        const signer = await resolveCheckedSigner(deps, kit, address);

        const { client } = deps.getRpcForNetwork(network);

        const bytes = base64ToBytes(txBase64);
        const signed = await signer.signTransaction(bytes);

        // The `options` passed in here are the dApp's request options
        // (showEffects / showRawEffects / etc.). Default `showEffects:
        // false` per spec §4.4 — agents that want effects must opt in.
        const result = await client.executeTransactionBlock({
          transactionBlock: txBase64,
          signature: signed.signature,
          options: (options ?? {}) as never,
        });

        return result as never;
      } catch (err) {
        if (typeof __DEV__ !== "undefined" && __DEV__)
          console.error("[Sui bridge signer] signAndExecuteTransaction failed");
        throw err;
      }
    },
  };

  registerSuiSigner(handlers);
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}
