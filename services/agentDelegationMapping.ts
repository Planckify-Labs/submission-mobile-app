/**
 * Bridge: local `PermissionGrant` intent → ERC-7710 scope + caveats
 * (spec Phase 2 §4.1, goal G3).
 *
 * Pure + SDK-free so it is unit-testable under `node:test` and importable
 * from both the settings UI and (later) the agent dispatcher. The EVM
 * `WalletKitAdapter.createDelegation` consumes the `DelegationScope` /
 * `CaveatConfig[]` this module emits and translates them into the
 * MetaMask SDK shapes at the port boundary.
 *
 * Design note — *which* local settings become onchain delegations:
 * only the **spending allowance** does. Read auto-approve and
 * the always-ask / agent-decides / full-auto mode are off-chain UX
 * policy (nothing onchain to constrain), so they stay local-only in
 * `PermissionGrantStore`. A bounded USDC allowance is the one surface
 * where an onchain caveat adds real, enforced security — the cap holds
 * even if the agent (or its key) misbehaves. See `app/agent-permissions`.
 */

import type { CaveatConfig, DelegationScope } from "./walletKit/types.ts";

/** Lifetime shapes the allowance UI offers. Mirrors `GrantLifetime`. */
export type AllowanceLifetime =
  | { type: "timed"; expiresAtMs: number }
  | { type: "once" }
  | { type: "session" }
  | { type: "permanent" };

export interface BuildErc20AllowanceArgs {
  /** ERC-20 token (USDC) address on the target chain. */
  tokenAddress: string;
  /** Hard cap in raw token units (6-decimal micros for USDC). */
  maxAmount: bigint;
  lifetime: AllowanceLifetime;
  /**
   * Optional explicit call-cap. When omitted, `once`/`session` default
   * to a single call (`limitedCalls: 1`) per the §4.1 mapping table.
   */
  callLimit?: number;
}

export interface DelegationConfig {
  scope: DelegationScope;
  caveats: CaveatConfig[];
}

/**
 * Map a bounded USDC allowance to an `erc20TransferAmount` scope plus the
 * lifetime-appropriate caveat:
 *
 *   - `timed`     → `timestamp` caveat (`expiresAt` in Unix **seconds**).
 *   - `once`      → `limitedCalls` caveat (`limit: 1`).
 *   - `session`   → `limitedCalls` caveat (`limit: callLimit ?? 1`).
 *   - `permanent` → no bounding caveat (amount cap still applies).
 *
 * SI-2: the emitted scope is a strict representation of the user's
 * selection — it never widens the cap. SI-3: the `timestamp` caveat
 * carries a positive `expiresAt`; the kit re-asserts this before signing.
 */
export function buildErc20AllowanceConfig(
  args: BuildErc20AllowanceArgs,
): DelegationConfig {
  const scope: DelegationScope = {
    type: "erc20TransferAmount",
    tokenAddress: args.tokenAddress,
    maxAmount: args.maxAmount,
  };

  const caveats: CaveatConfig[] = [];
  switch (args.lifetime.type) {
    case "timed":
      caveats.push({
        type: "timestamp",
        expiresAt: Math.floor(args.lifetime.expiresAtMs / 1000),
      });
      break;
    case "once":
      caveats.push({ type: "limitedCalls", limit: args.callLimit ?? 1 });
      break;
    case "session":
      caveats.push({ type: "limitedCalls", limit: args.callLimit ?? 1 });
      break;
    case "permanent":
      // Amount cap is the only bound — no timestamp / call limit.
      break;
  }

  return { scope, caveats };
}

/**
 * Hand-written, user-facing summary of an allowance for the approval
 * sheet (SI-2 surfaces the exact onchain bounds). Never embeds raw
 * machine strings — friendly copy only, per the user-facing-errors rule.
 */
export function describeErc20Allowance(args: {
  amountLabel: string;
  lifetime: AllowanceLifetime;
  nowMs?: number;
}): string {
  const base = `Authorize the agent to spend up to ${args.amountLabel}`;
  switch (args.lifetime.type) {
    case "timed": {
      const days = Math.max(
        1,
        Math.round(
          (args.lifetime.expiresAtMs - (args.nowMs ?? Date.now())) /
            (1000 * 60 * 60 * 24),
        ),
      );
      return `${base}, expiring in ${days} day${days === 1 ? "" : "s"}.`;
    }
    case "once":
      return `${base}, for a single payment.`;
    case "session":
      return `${base} during this session.`;
    case "permanent":
      return `${base}, until you revoke it.`;
  }
}

/**
 * Parse a human-entered, token-denominated amount into raw token units
 * (bigint) given the token's `decimals`. Pure + overflow-safe (string
 * math, no float) so a 18-decimal cap never loses precision. Invalid or
 * negative input resolves to `0n`, which the UI treats as "not yet
 * valid" and the SDK would reject anyway.
 */
export function parseTokenAmount(human: string, decimals: number): bigint {
  const trimmed = human.trim();
  if (!trimmed || !/^\d*\.?\d*$/.test(trimmed)) return 0n;
  const [intPart = "", fracRaw = ""] = trimmed.split(".");
  const frac = fracRaw.slice(0, decimals).padEnd(decimals, "0");
  const digits = `${intPart}${frac}`.replace(/^0+(?=\d)/, "");
  try {
    return BigInt(digits || "0");
  } catch {
    return 0n;
  }
}

/**
 * Inverse of {@link parseTokenAmount} for display — formats raw token
 * units back to a trimmed decimal string. Used by the settings list to
 * render a stored allowance cap.
 */
export function formatTokenAmount(raw: bigint, decimals: number): string {
  if (decimals === 0) return raw.toString();
  const negative = raw < 0n;
  const digits = (negative ? -raw : raw).toString().padStart(decimals + 1, "0");
  const intPart = digits.slice(0, digits.length - decimals);
  const frac = digits.slice(digits.length - decimals).replace(/0+$/, "");
  const body = frac ? `${intPart}.${frac}` : intPart;
  return negative ? `-${body}` : body;
}

/**
 * Display variant of {@link formatTokenAmount}: groups the integer part
 * with thousands separators (e.g. `1000000` → `1,000,000`) and keeps the
 * trimmed fractional part. For human-facing labels only — never feed the
 * result back to `parseTokenAmount` (the separators would be rejected).
 */
export function formatTokenAmountDisplay(
  raw: bigint,
  decimals: number,
): string {
  const plain = formatTokenAmount(raw, decimals);
  const negative = plain.startsWith("-");
  const body = negative ? plain.slice(1) : plain;
  const [intPart, fracPart] = body.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const out = fracPart ? `${grouped}.${fracPart}` : grouped;
  return negative ? `-${out}` : out;
}

/**
 * 32-byte random salt (`0x`-prefixed hex) for replay protection (SI-4).
 * Uses the same global `crypto.getRandomValues` the wallet keygen relies
 * on (polyfilled by `react-native-get-random-values` on device; native
 * in Node ≥ 18 for tests).
 */
export function randomDelegationSalt(): `0x${string}` {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  let hex = "0x";
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, "0");
  }
  return hex as `0x${string}`;
}
