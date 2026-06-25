/**
 * UX treatment resolver for the Takumi Agent.
 *
 * Translates the server's factual `capability` into the concrete UX
 * treatment the mobile app will apply for a tool invocation. This sits
 * at the exact boundary between "what the action does" (server) and
 * "how much friction to apply" (wallet + user).
 *
 * Spec: `AGENT_PROTOCOL.md` §5 "Mobile-Side: Wallet Approval Policy"
 *       and §6 "Combining Grant + ApprovalPolicy → UX Treatment".
 *
 * Paired with `permissionGrantStore.ts`: grants (task 11) override
 * policies, and this file is the single place where they combine.
 */

import {
  type PermissionGrantStore,
  resolveGrant,
  type ToolCapability,
} from "./permissionGrantStore.ts";

// --- Types ------------------------------------------------------------------

/**
 * The four possible UX treatments a tool invocation can receive.
 *
 * - `silent`:  execute immediately, show a small status label
 * - `preview`: summary card, auto-proceed after a short delay
 * - `confirm`: hard stop, explicit user tap required
 * - `blocked`: immediate rejection (e.g. watch-only wallet cannot write)
 *
 * NOTE: `preview` is retained as a treatment value a custom policy may
 * set, but no shipped policy produces it — the USD "Fund Thresholds" that
 * used to downgrade `confirm → preview` were removed (on-device USD caps
 * are oracle-dependent and only enforce friction, not a real cap; the
 * hard cap is the on-chain ERC-7710 delegation). `authorizeToolCall`
 * still maps any `preview` to `authorized`.
 */
export type UXTreatment = "silent" | "preview" | "confirm" | "blocked";

/**
 * A per-wallet approval policy. Drives UX treatment when no explicit
 * grant is active (or when the active grant is `once`).
 *
 * `tool_overrides` lets a policy pin a specific tool to a treatment
 * regardless of capability — e.g. always `confirm` on `approve_erc20`
 * even for hot wallets that would otherwise preview writes.
 */
export interface ApprovalPolicy {
  read: UXTreatment;
  write: UXTreatment;
  defi_read: UXTreatment;
  defi_write: UXTreatment;
  tool_overrides?: Record<string, UXTreatment>;
}

/**
 * Lightweight wallet shape passed to `resolveUXTreatment()`.
 *
 * This is deliberately NOT the full `TWallet` type from
 * `constants/types/walletTypes.ts`: that type is the on-device
 * persistence model (name, seed phrase, balance, etc.) and does not
 * carry runtime concepts like the live grant store or approval policy.
 * Keeping a separate shape means callers can construct a
 * `ConnectedWallet` from any source (a signed-in account, a hardware
 * bridge, a watch-only address) without extending the storage model.
 */
export interface ConnectedWallet {
  address: `0x${string}`;
  approvalPolicy: ApprovalPolicy;
  grantStore: PermissionGrantStore;
}

// --- Built-in policies ------------------------------------------------------

/**
 * Default for software hot wallets: reads are free, writes require
 * explicit confirmation. `approve_erc20` is pinned to `confirm` because
 * approvals are the most common attack vector — we never want to silently
 * raise an allowance.
 */
export const HOT_WALLET_POLICY: ApprovalPolicy = {
  read: "silent",
  write: "confirm",
  defi_read: "silent",
  defi_write: "confirm",
  // `approve_erc20` → confirm: approvals are the top attack vector.
  // `x402_fetch` → silent: agent-initiated x402 micropayments settle
  // silently WITHIN the user's pre-signed allowance (spec Phase 5 §6.2,
  // acceptance #1 "no user prompt"). The on-chain caveat is the hard
  // ceiling and the executor self-escalates over-budget calls
  // (`paid:false, over_budget`) instead of spending — so no ad-hoc
  // approval sheet is needed here.
  tool_overrides: { approve_erc20: "confirm", x402_fetch: "silent" },
};

/**
 * Hardware wallets already gate every write on the device itself, so
 * the mobile UI does not need to add extra friction beyond `confirm`.
 */
export const HARDWARE_WALLET_POLICY: ApprovalPolicy = {
  read: "silent",
  write: "confirm",
  defi_read: "silent",
  defi_write: "confirm",
  tool_overrides: { x402_fetch: "silent" },
};

/**
 * Watch-only wallets have no signing key; writes are impossible and
 * are rejected at the policy layer.
 */
export const WATCH_ONLY_POLICY: ApprovalPolicy = {
  read: "silent",
  write: "blocked",
  defi_read: "silent",
  defi_write: "blocked",
};

/**
 * Multisig wallets behave like hot wallets from the mobile's
 * perspective — the co-signer flow happens out-of-band.
 */
export const MULTISIG_POLICY: ApprovalPolicy = {
  read: "silent",
  write: "confirm",
  defi_read: "silent",
  defi_write: "confirm",
  tool_overrides: { x402_fetch: "silent" },
};

// --- Resolver ---------------------------------------------------------------

/**
 * Resolve the concrete UX treatment for a tool invocation.
 *
 * Priority:
 *   1. Active grant from the wallet's grant store takes precedence.
 *      - `always_ask` → hard `confirm` (user locked the tool down)
 *      - `permanent` | `session` | `timed` → `silent` (user pre-approved)
 *   2. Otherwise (`once` — the fall-through default), delegate to the
 *      wallet's `ApprovalPolicy`.
 *
 * The signature matches what task 09's dispatcher will call. The
 * dispatcher passes the wallet object (not the policy directly) so the
 * resolver has access to the grant store.
 */
export function resolveUXTreatment(
  capability: ToolCapability,
  toolName: string,
  wallet: ConnectedWallet,
  sessionId: string,
): UXTreatment {
  const grant = resolveGrant(
    toolName,
    capability,
    wallet.address,
    sessionId,
    wallet.grantStore,
  );

  switch (grant.type) {
    case "always_deny":
      // Hard deny (the `Never` rule, deny-layer spec §6.2). Surfaces as
      // `blocked` so the legacy resolver fails closed; `authorizeToolCall`
      // distinguishes this from a watch-only block via `resolveGrant`.
      return "blocked";

    case "always_ask":
      // Hard override: even a global permanent grant cannot loosen this.
      return "confirm";

    case "permanent":
    case "session":
    case "timed":
      // User has an active pre-approval that covers this call.
      return "silent";

    case "once":
      // No active grant — fall through to the wallet's policy.
      return resolveFromPolicy(wallet.approvalPolicy, capability, toolName);
  }
}

/**
 * Pure policy resolver: a tool override wins over the capability base.
 *
 *   1. `tool_overrides[toolName]` — absolute win if set.
 *   2. `policy[capability]` — the base treatment.
 *
 * (The USD "auto-approve below $X" downgrade that used to live here was
 * removed with the Fund Thresholds feature — see the note on
 * `UXTreatment`.)
 */
export function resolveFromPolicy(
  policy: ApprovalPolicy,
  capability: ToolCapability,
  toolName: string,
): UXTreatment {
  return policy.tool_overrides?.[toolName] ?? policy[capability];
}
