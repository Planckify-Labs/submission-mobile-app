/**
 * Sui Wallet-Standard adapter.
 *
 * Spec references:
 *   - `docs/sui-dapp-bridge-spec.md` §4 (adapter contract).
 *   - `docs/sui-dapp-bridge-spec.md` §11 (security invariants — TWV-2026-YYY).
 *
 * Security gate (TWV-2026-YYY — see
 * `docs/wallet-security-task/66_sui_dapp_bridge_design_note.md`):
 *   - The bridge sign path goes through `SuiSignerFns` ONLY; the keypair
 *     is reached through `getSuiSignerForWallet` (single dwell site,
 *     TWV-2026-XXX).
 *   - The injected script never sees keys (§2.2 of design note).
 *   - Cross-namespace trust is forbidden in `executeApproval` — an EVM
 *     grant for the same origin does NOT silently authorise Sui access.
 *
 * Any PR that adds a new sign path outside `installSuiSigner` →
 * `getSuiSignerForWallet`, returns Sui keypair material from a public
 * helper, or adds cross-namespace fallback to `pickSuiWalletForOrigin`,
 * MUST cite TWV-2026-YYY in the PR description.
 */

import { takumipayLogoBase64 } from "@/constants/takumipay";
import type {
  ApprovalDecision,
  ApprovalIntent,
} from "@/services/bridge/approval";
import type {
  AdapterContext,
  ChainAdapter,
  ChainRequest,
  ChainResult,
} from "@/services/chains/types";
import { originKey } from "@/services/permissions/caip";
import { PermissionStore } from "@/services/permissions/store";
import { assertSuiErrorCode } from "./errorCodes";
import { getSuiInjectedScript } from "./injectedScript";
import {
  canonicalizeSuiChain,
  chainToNetwork,
  isSuiNetwork,
  networkToChain,
  type SuiConnectPayload,
  type SuiNetwork,
  type SuiSignInPayload,
  type SuiSignPersonalMessagePayload,
  type SuiSignTxPayload,
  type SuiSwitchNetworkPayload,
} from "./payloads";

// ── Signer registration ────────────────────────────────────────────────

export interface SuiSignerFns {
  /**
   * Sign a base64-encoded message via the Sui `PersonalMessage` intent.
   * Returns base64 `flag(1) || sig(64) || pubkey(32)` — the 97-byte
   * Wallet Standard wire signature.
   */
  signPersonalMessage: (
    address: string,
    messageB64: string,
  ) => Promise<{ bytes: string; signature: string }>;
  /**
   * Sign a base64-encoded BCS transaction. Returns the same bytes
   * (echoed) plus the 97-byte base64 signature. The kit applies the
   * `TransactionData` intent prefix internally.
   */
  signTransaction: (
    address: string,
    txBase64: string,
    network: SuiNetwork,
  ) => Promise<{ bytes: string; signature: string }>;
  /**
   * Sign + submit via `client.executeTransactionBlock`. Returns the
   * Mysten SDK's effects/digest envelope (the `options` field is
   * threaded through unchanged — `showEffects` / `showRawEffects` etc.).
   */
  signAndExecuteTransaction: (
    address: string,
    txBase64: string,
    network: SuiNetwork,
    options?: Record<string, unknown>,
  ) => Promise<{
    digest: string;
    rawEffects?: number[] | string;
    rawTransaction?: string;
    effects?: unknown;
    [k: string]: unknown;
  }>;
}

let signerImpl: SuiSignerFns | null = null;

export function registerSuiSigner(signer: SuiSignerFns): void {
  signerImpl = signer;
}

/** Test-only escape hatch — clears the registered signer. */
export function __clearSuiSignerForTesting(): void {
  signerImpl = null;
}

// ── Dispatch helpers ───────────────────────────────────────────────────

function rpcError(code: number, message: string, data?: unknown): ChainResult {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    assertSuiErrorCode(code);
  }
  return { status: "error", code, message, data };
}

function codedError(code: number, message: string): Error {
  return Object.assign(new Error(message), { code });
}

function asString(x: unknown): string {
  return typeof x === "string" ? x : "";
}

/**
 * UTF-8 displayability check shared with Solana `isUtf8Displayable`. If
 * the base64 bytes round-trip through ASCII / printable Latin-1, treat
 * as UTF-8; otherwise show as base64.
 */
function isUtf8Displayable(base64: string): boolean {
  try {
    const bin =
      typeof globalThis.atob === "function"
        ? globalThis.atob(base64)
        : Buffer.from(base64, "base64").toString("binary");
    for (let i = 0; i < bin.length; i++) {
      const c = bin.charCodeAt(i);
      if (c === 0) return false;
      if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function makeIntent<P>(
  req: ChainRequest,
  kind: ApprovalIntent["kind"],
  payload: P,
  wallet: ApprovalIntent["wallet"],
): ApprovalIntent<P> {
  return {
    id: req.id,
    namespace: "sui",
    kind,
    origin: req.origin,
    wallet,
    payload,
    annotations: [],
    createdAt: Date.now(),
  };
}

/**
 * Find the Sui wallet that was granted to this origin on this network.
 * Falls back to the first Sui wallet if no grant exists yet.
 *
 * §11 carryover: cross-namespace isolation. Grants for `eip155:*` /
 * `solana:*` chainIds are skipped — only `sui:*` grants surface a
 * candidate wallet. A reviewer who folds the predicate across
 * namespaces fails TWV-2026-YYY (§2.3 of design note).
 */
function pickSuiWalletForOrigin(
  ctx: AdapterContext,
  origin: string,
  network?: SuiNetwork,
): AdapterContext["activeWallet"] | null {
  const sui = ctx.wallets.filter((w) => w.namespace === "sui");
  if (sui.length === 0) return null;
  const targetChain = network ? networkToChain(network) : null;
  const grants = PermissionStore.listByOrigin(origin).filter((g) => {
    if (typeof g.chainId !== "string") return false;
    if (!g.chainId.startsWith("sui:")) return false;
    return targetChain === null || g.chainId === targetChain;
  });
  for (const g of grants) {
    const m = sui.find(
      (w) => w.address.toLowerCase() === g.walletAddress.toLowerCase(),
    );
    if (m) return m;
  }
  return sui[0];
}

function resolveNetwork(req: ChainRequest): SuiNetwork {
  const params = (req.params as unknown[]) ?? [];
  const first = (params[0] ?? {}) as { chain?: unknown };
  let chainRaw: string | undefined;
  if (typeof first.chain === "string") chainRaw = first.chain;
  if (!chainRaw && Array.isArray(params[0])) {
    const inner = (params[0] as unknown[])[0] as { chain?: string } | undefined;
    if (inner?.chain) chainRaw = inner.chain;
  }
  if (chainRaw) {
    const canon = canonicalizeSuiChain(chainRaw);
    const net = chainToNetwork(canon);
    if (net) return net;
  }
  return "mainnet";
}

// ── Legacy alias bookkeeping (one-warn-per-session) ────────────────────

const warnedLegacy = new Set<string>();
function warnLegacyOnce(legacyMethod: string, currentMethod: string): void {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;
  if (warnedLegacy.has(legacyMethod)) return;
  warnedLegacy.add(legacyMethod);
  console.warn(
    `[sui] legacy method '${legacyMethod}' — use '${currentMethod}'`,
  );
}

/** Test-only escape hatch — clear the legacy-warn dedupe set. */
export function __clearLegacyWarnSetForTesting(): void {
  warnedLegacy.clear();
}

// ── Adapter ────────────────────────────────────────────────────────────

class SuiAdapter implements ChainAdapter {
  readonly namespace = "sui" as const;

  getInjectedScript(ctx: AdapterContext): string {
    const suiWallet = ctx.wallets.find((w) => w.namespace === "sui");
    return getSuiInjectedScript({
      activeAddress: suiWallet?.address ?? null,
      sessionNonce: ctx.sessionNonce,
      iconDataUrl: takumipayLogoBase64,
    });
  }

  onStateChange(ctx: AdapterContext): { injectedJs: string } | null {
    const active =
      ctx.activeWallet && ctx.activeWallet.namespace === "sui"
        ? ctx.activeWallet
        : ctx.wallets.find((w) => w.namespace === "sui");
    const addr = active?.address ?? null;
    return {
      injectedJs: `try{window._updateSuiWallet&&window._updateSuiWallet({accounts:${addr ? `[{address:${JSON.stringify(addr)}}]` : "[]"}});}catch(e){}`,
    };
  }

  async handleRequest(
    req: ChainRequest,
    ctx: AdapterContext,
  ): Promise<ChainResult> {
    try {
      // Legacy alias rewrite — adapter handles `*Block` variants by
      // dispatching to the same arm as the current method, with a
      // one-warn-per-session dev breadcrumb.
      let method = req.method;
      if (method === "sui:signTransactionBlock") {
        warnLegacyOnce(method, "sui:signTransaction");
        method = "sui:signTransaction";
      } else if (method === "sui:signAndExecuteTransactionBlock") {
        warnLegacyOnce(method, "sui:signAndExecuteTransaction");
        method = "sui:signAndExecuteTransaction";
      }

      switch (method) {
        case "standard:connect":
          return this.handleConnect(req, ctx);
        case "standard:disconnect":
          return await this.handleDisconnect(req, ctx);
        case "sui:signPersonalMessage":
          return this.handleSignMessage(req, ctx);
        case "sui:signTransaction":
          return this.handleSignTransaction(req, ctx, "sign-only");
        case "sui:signAndExecuteTransaction":
          return this.handleSignTransaction(req, ctx, "sign-and-execute");
        case "sui:signIn":
          return this.handleSignIn(req, ctx);
        case "sui:reportTransactionEffects":
          return this.handleReportEffects(req, ctx);
        case "takumi:switchNetwork":
          return this.handleSwitchNetwork(req, ctx);
        default:
          return rpcError(-32601, `method ${req.method} not supported`);
      }
    } catch (e) {
      const code = (e as Error & { code?: number }).code ?? -32603;
      return rpcError(code, (e as Error).message);
    }
  }

  private async handleDisconnect(
    req: ChainRequest,
    _ctx: AdapterContext,
  ): Promise<ChainResult> {
    void _ctx;
    await PermissionStore.revoke({ origin: req.origin.url });
    return { status: "resolved", value: null };
  }

  private async handleReportEffects(
    _req: ChainRequest,
    _ctx: AdapterContext,
  ): Promise<ChainResult> {
    void _req;
    void _ctx;
    return { status: "resolved", value: { ok: true } };
  }

  private handleConnect(req: ChainRequest, ctx: AdapterContext): ChainResult {
    const params = (req.params as unknown[]) ?? [];
    const opts = (params[0] ?? {}) as {
      silent?: boolean;
      onlyIfTrusted?: boolean;
      chain?: string;
    };
    const silent = !!(opts.silent ?? opts.onlyIfTrusted);

    let network: SuiNetwork = "mainnet";
    if (typeof opts.chain === "string") {
      const net = chainToNetwork(opts.chain);
      if (net) network = net;
    }
    const suiWallet = pickSuiWalletForOrigin(ctx, req.origin.url, network);

    if (silent) {
      if (!suiWallet) return rpcError(4100, "no Sui wallet available");
      const granted = PermissionStore.isGranted(
        req.origin.url,
        suiWallet.address,
        networkToChain(network),
      );
      if (!granted) return rpcError(4100, "not authorized");
      return {
        status: "resolved",
        value: {
          accounts: [{ address: suiWallet.address }],
          chain: networkToChain(network),
        },
      };
    }

    if (!suiWallet) return rpcError(4100, "no Sui wallet available");

    // §11 / TWV-2026-YYY: NO cross-namespace trust extension. An EVM
    // grant for this origin does NOT imply consent to expose the user's
    // Sui wallet — they're different identities.
    return {
      status: "needs-approval",
      intent: makeIntent<SuiConnectPayload>(
        req,
        "connect",
        { network, onlyIfTrusted: silent },
        suiWallet,
      ),
    };
  }

  private handleSignMessage(
    req: ChainRequest,
    ctx: AdapterContext,
  ): ChainResult {
    const suiWallet = pickSuiWalletForOrigin(ctx, req.origin.url);
    if (!suiWallet) return rpcError(4100, "no Sui wallet available");
    const params = (req.params as unknown[]) ?? [];
    const first = (params[0] ?? {}) as {
      account?: { address?: string };
      address?: string;
      message?: string;
    };
    const message = asString(first.message);
    const display: "utf8" | "base64" = isUtf8Displayable(message)
      ? "utf8"
      : "base64";
    const address =
      asString(first.account?.address ?? first.address) || suiWallet.address;
    return {
      status: "needs-approval",
      intent: makeIntent<SuiSignPersonalMessagePayload>(
        req,
        "signMessage",
        { address, message, display },
        suiWallet,
      ),
    };
  }

  private handleSignIn(req: ChainRequest, ctx: AdapterContext): ChainResult {
    const suiWallet = pickSuiWalletForOrigin(ctx, req.origin.url);
    if (!suiWallet) return rpcError(4100, "no Sui wallet available");
    const params = (req.params as unknown[]) ?? [];
    const input = (params[0] ?? {}) as Partial<SuiSignInPayload>;
    const domain =
      typeof input.domain === "string"
        ? input.domain
        : originKey(req.origin.url);
    if (input.address && input.address !== suiWallet.address) {
      return rpcError(4100, "address mismatch");
    }
    const payload: SuiSignInPayload = {
      domain,
      address: suiWallet.address,
      statement: input.statement,
      uri: input.uri,
      version: input.version,
      chainId: input.chainId,
      nonce: input.nonce,
      issuedAt: input.issuedAt,
      expirationTime: input.expirationTime,
      notBefore: input.notBefore,
      requestId: input.requestId,
      resources: input.resources,
    };
    return {
      status: "needs-approval",
      intent: makeIntent<SuiSignInPayload>(req, "signIn", payload, suiWallet),
    };
  }

  private handleSignTransaction(
    req: ChainRequest,
    ctx: AdapterContext,
    mode: "sign-only" | "sign-and-execute",
  ): ChainResult {
    const suiWallet = pickSuiWalletForOrigin(ctx, req.origin.url);
    if (!suiWallet) return rpcError(4100, "no Sui wallet available");

    const params = (req.params as unknown[]) ?? [];
    const first = (params[0] ?? {}) as {
      account?: { address?: string };
      address?: string;
      chain?: string;
      transaction?: string;
      options?: SuiSignTxPayload["options"];
    };
    const tx = asString(first.transaction);
    if (!tx) return rpcError(-32602, "missing transaction");

    let network: SuiNetwork;
    try {
      network = resolveNetwork(req);
    } catch (e) {
      return rpcError(
        (e as Error & { code?: number }).code ?? -32602,
        (e as Error).message,
      );
    }

    return {
      status: "needs-approval",
      intent: makeIntent<SuiSignTxPayload>(
        req,
        "signTransaction",
        {
          mode,
          address: suiWallet.address,
          network,
          transaction: tx,
          options: first.options,
        },
        suiWallet,
      ),
    };
  }

  private handleSwitchNetwork(
    req: ChainRequest,
    ctx: AdapterContext,
  ): ChainResult {
    const suiWallet = pickSuiWalletForOrigin(ctx, req.origin.url);
    if (!suiWallet) return rpcError(4100, "no Sui wallet available");
    const params = (req.params as unknown[]) ?? [];
    const first = (params[0] ?? {}) as { to?: SuiNetwork; from?: SuiNetwork };
    if (!isSuiNetwork(first.to)) return rpcError(-32602, "invalid network");
    const from: SuiNetwork = isSuiNetwork(first.from) ? first.from : "mainnet";
    return {
      status: "needs-approval",
      intent: makeIntent<SuiSwitchNetworkPayload>(
        req,
        "switchNetwork",
        { from, to: first.to },
        suiWallet,
      ),
    };
  }

  // ── Approval execution ────────────────────────────────────────────

  async executeApproval(
    intent: ApprovalIntent,
    decision: ApprovalDecision,
    ctx: AdapterContext,
  ): Promise<unknown> {
    if (decision.outcome === "reject") {
      throw codedError(4001, "user rejected");
    }

    switch (intent.kind) {
      case "connect": {
        const payload = intent.payload as SuiConnectPayload;
        const pickedIndex =
          decision.data &&
          typeof decision.data === "object" &&
          "walletIndex" in decision.data
            ? (decision.data as { walletIndex?: number }).walletIndex
            : undefined;
        let wallet = intent.wallet;
        if (typeof pickedIndex === "number" && ctx.wallets[pickedIndex]) {
          const picked = ctx.wallets[pickedIndex];
          if (picked.namespace === "sui") {
            wallet = picked;
          }
        }
        if (wallet) {
          await PermissionStore.grant({
            origin: intent.origin.url,
            walletAddress: wallet.address,
            chainId: networkToChain(payload.network),
          });
        }
        return {
          accounts: wallet
            ? [
                {
                  address: wallet.address,
                  chains: [networkToChain(payload.network)],
                  features: [
                    "standard:connect",
                    "standard:disconnect",
                    "standard:events",
                    "sui:signTransaction",
                    "sui:signAndExecuteTransaction",
                    "sui:signPersonalMessage",
                    "sui:reportTransactionEffects",
                  ],
                  label: "TakumiPay",
                },
              ]
            : [],
          chain: networkToChain(payload.network),
        };
      }
      case "signMessage": {
        if (!signerImpl) throw codedError(-32603, "no Sui signer registered");
        const p = intent.payload as SuiSignPersonalMessagePayload;
        const r = await signerImpl.signPersonalMessage(p.address, p.message);
        return { bytes: r.bytes ?? p.message, signature: r.signature };
      }
      case "signIn": {
        if (!signerImpl) throw codedError(-32603, "no Sui signer registered");
        const p = intent.payload as SuiSignInPayload;
        if (!p.address) throw codedError(4100, "no address");
        const canonicalMessage =
          typeof (intent as { payload: { message?: string } }).payload
            .message === "string"
            ? (intent as { payload: { message?: string } }).payload.message!
            : JSON.stringify(p);
        const messageB64 = bytesToBase64(
          new TextEncoder().encode(canonicalMessage),
        );
        const r = await signerImpl.signPersonalMessage(p.address, messageB64);
        return {
          account: {
            address: p.address,
            chains: p.chainId ? [networkToChain(p.chainId)] : ["sui:mainnet"],
            features: [
              "standard:connect",
              "standard:disconnect",
              "standard:events",
              "sui:signTransaction",
              "sui:signAndExecuteTransaction",
              "sui:signPersonalMessage",
              "sui:reportTransactionEffects",
            ],
            label: "TakumiPay",
          },
          signedMessage: messageB64,
          signature: r.signature,
        };
      }
      case "signTransaction": {
        if (!signerImpl) throw codedError(-32603, "no Sui signer registered");
        const p = intent.payload as SuiSignTxPayload;
        if (p.mode === "sign-and-execute") {
          const out = await signerImpl.signAndExecuteTransaction(
            p.address,
            p.transaction,
            p.network,
            (p.options as Record<string, unknown> | undefined) ?? undefined,
          );
          return out;
        }
        const r = await signerImpl.signTransaction(
          p.address,
          p.transaction,
          p.network,
        );
        return { bytes: r.bytes ?? p.transaction, signature: r.signature };
      }
      case "switchNetwork": {
        const p = intent.payload as SuiSwitchNetworkPayload;
        if (intent.wallet) {
          await PermissionStore.grant({
            origin: intent.origin.url,
            walletAddress: intent.wallet.address,
            chainId: networkToChain(p.to),
          });
        }
        return { ok: true, chain: networkToChain(p.to) };
      }
      default:
        throw codedError(4200, `unsupported intent kind: ${intent.kind}`);
    }
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  return Buffer.from(bytes).toString("base64");
}

export { SuiAdapter };

export function createSuiAdapter(): ChainAdapter {
  return new SuiAdapter();
}
