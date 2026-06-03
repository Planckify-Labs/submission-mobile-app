# Agent-Initiated x402 Micropayments via ERC-7710 — Engineering Spec (Phase 5)

**Status:** Draft
**Owner:** Wallet & AI Agent Team
**Target version:** `takumipay-mobile-app` v2.7.0
**Scope:** EVM wallet core, space-docking ports ([WalletKitAdapter](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/types.ts)), agent execution module, new `services/x402/` orchestrator, cross-repo agent-tool registration
**References:**
* Research Notes: [hackathon-research-notes.md](file:///home/cstralpt/takumipay/mobile-app/docs/hackathon-research-notes.md) §5
* Phase 2 Spec (delegations): [erc7710-delegation-caveats-spec.md](file:///home/cstralpt/takumipay/mobile-app/docs/erc7710-delegation-caveats-spec.md)
* Phase 3 Spec (1Shot relayer): [eip7710-1shot-relayer-spec.md](file:///home/cstralpt/takumipay/mobile-app/docs/eip7710-1shot-relayer-spec.md)
* WalletKit Types: [types.ts](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/types.ts)
* Delegations Impl: [delegations.ts](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/evm/delegations.ts)
* Relayer Impl: [relayer.ts](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/evm/relayer.ts)
* Permission Store: [permissionGrantStore.ts](file:///home/cstralpt/takumipay/mobile-app/services/permissionGrantStore.ts)
* Delegation Mapping: [agentDelegationMapping.ts](file:///home/cstralpt/takumipay/mobile-app/services/agentDelegationMapping.ts)
* Agent Delegate Constant: [agentDelegate.ts](file:///home/cstralpt/takumipay/mobile-app/constants/agentDelegate.ts)
* Existing user-facing x402 (Path C): [pathCRawX402.ts](file:///home/cstralpt/takumipay/mobile-app/services/nanopay/pathCRawX402.ts)
* Companion demo seller (test harness, §9): `takumipay/x402-demo-seller/` (separate repo/folder — not built by this spec)
* Agent executor registry: [agent-executors/index.ts](file:///home/cstralpt/takumipay/mobile-app/services/agent-executors/index.ts)
* Public Relayer Skill: [SKILL.md](file:///home/cstralpt/takumipay/mobile-app/.agents/skills/public-relayer/SKILL.md)
* MetaMask docs — x402 overview: <https://docs.metamask.io/smart-accounts-kit/guides/x402/overview/>
* MetaMask docs — buyer/delegations: <https://docs.metamask.io/smart-accounts-kit/guides/x402/buyer/delegations/>
* MetaMask docs — buyer/recurring-payments: <https://docs.metamask.io/smart-accounts-kit/guides/x402/buyer/recurring-payments/>
* MetaMask docs — seller: <https://docs.metamask.io/smart-accounts-kit/guides/x402/seller/>
* MetaMask docs — execute on user's behalf: <https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/>
* MetaMask docs — supported advanced permissions: <https://docs.metamask.io/smart-accounts-kit/get-started/supported-advanced-permissions/>

---

## 1. Executive Summary

This spec defines **Phase 5: Agent-Initiated x402 Micropayments**. It is the
payload of the previous four phases: the AI agent autonomously settles
`HTTP 402 Payment Required` challenges for premium resources (paid data
feeds, security oracles, premium RPC, gated API endpoints) **within bounds
the user already authorized on-chain** — without ever surfacing a "sign this
transaction" prompt for sub-dollar payments.

The mechanism reuses everything already shipped:

* **Phase 2** gave us biometric-signed ERC-7710 delegations stored in
  [`PermissionGrantStore`](file:///home/cstralpt/takumipay/mobile-app/services/permissionGrantStore.ts)
  (`scope.kind === "delegation"`, carrying `delegation: DelegationStruct` +
  `delegationMeta` with a `maxAmount` cap). This signed allowance **is the
  agent's spending budget.**
* **Phase 3** gave us gas-abstracted execution of those delegations through
  the **1Shot Relayer**
  ([`relayer.ts`](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/evm/relayer.ts):
  `relayerEstimate7710Transaction`, `relayerSend7710Transaction`,
  `relayerGetStatus`), already fee-bounded by
  `RELAYER_FEE_SAFETY_MAX_USDC_ATOMS`.

Phase 5 wires an **x402 client** on top: when the agent fetches a protected
resource and receives a 402 with `extra.assetTransferMethod === "erc7710"`,
the client checks the requested amount against the **remaining delegation
budget**, settles the payment using the stored delegation, and retries the
request with the `X-PAYMENT` proof. The user "never had to click Approve"
(research notes §5.4) — but the on-chain caveat enforces the cap regardless.

Per current direction, **Phase 4 (Venice AI) is dropped**. The reasoning
brain remains **Kimi K2.6** via the existing agent-api. The x402 client is
therefore **provider-neutral** — it pays for *any* x402-speaking resource and
contains no Venice-specific code or endpoints.

As with Phases 2–3, the integration is **space-docking compliant**: all
chain-specific settlement lives behind optional
[`WalletKitAdapter`](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/types.ts)
methods; the agent executor and any UI only check for method presence.
Solana / Sui kits leave the new methods `undefined` and compile unchanged.

---

## 2. Goals & Non-Goals

### Goals
* **G1. Define a chain-agnostic x402 settlement port.** Add optional
  `settleX402Payment` (and supporting types) to
  [`WalletKitAdapter`](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/types.ts).
  EVM implements it; Solana/Sui leave it `undefined`.
* **G2. Implement the EVM x402 settlement** in `services/walletKit/evm/`,
  built on the Phase 2 delegation methods and the Phase 3 relayer methods —
  **no new on-chain primitive is introduced.**
* **G3. Ship a provider-neutral x402 orchestrator** at `services/x402/`: the
  402 challenge loop (probe → parse → budget-gate → settle → retry with
  proof), reusing the challenge parser shape already proven in
  [`pathCRawX402.ts`](file:///home/cstralpt/takumipay/mobile-app/services/nanopay/pathCRawX402.ts).
* **G4. Enforce a local spending budget gate.** Auto-settle **iff** the
  requested amount (plus relayer fee) fits inside the remaining allowance
  recorded by the stored delegation; otherwise escalate to an explicit user
  approval sheet. The on-chain caveat is the hard ceiling; the local ledger
  drives the silent-vs-prompt UX decision.
* **G5. Expose settlement to the agent as a mobile tool.** Register a new
  `x402_fetch` tool (executor `"mobile"`) in
  [`agent-executors`](file:///home/cstralpt/takumipay/mobile-app/services/agent-executors/index.ts)
  and its server counterpart, so the Kimi K2.6 agent loop can call paid
  resources and receive the (sanitized) payload back.
* **G6. Support recurring/periodic budgets.** Map the MetaMask
  `erc20-token-periodic` advanced permission to our existing
  `erc20PeriodTransfer` scope so a "X USDC / week" allowance funds many x402
  calls without re-signing.
* **G7. Keep the brain on Kimi K2.6.** No Venice provider, endpoint, key, or
  package is added anywhere.
* **G8. Preserve non-EVM isolation.** Solana / Sui kits compile cleanly with
  the settlement method `undefined`.

### Non-Goals
* **N1. Venice AI integration.** Explicitly out of scope and not implemented
  (supersedes research-notes Phase 4).
* **N2. New on-chain enforcers.** Phase 5 composes existing caveats
  (`erc20TransferAmount`, `erc20PeriodTransfer`, `timestamp`, `limitedCalls`,
  `allowedTargets`); it does not author new enforcer contracts.
* **N3. Redelegation to sub-agents.** Core Agent sub-delegating to specialist
  agents (Phase 6) is out of scope; Phase 5 settles from the user→agent root
  delegation only. The `services/x402/` provider is written so the parent
  permission context is swappable, leaving the seam for Phase 6.
* **N4. Replacing the user-facing nanopay Path C.**
  [`pathCRawX402.ts`](file:///home/cstralpt/takumipay/mobile-app/services/nanopay/pathCRawX402.ts)
  stays the **user-initiated, per-payment EIP-3009** flow. Phase 5 is the
  **agent-initiated, delegation-budgeted** flow. They share challenge-parsing
  conventions but not the settlement path (see §4.4).

---

## 3. Background: Space-Docking & What Already Exists

### 3.1 The architecture contract
UI screens and the agent loop never branch on chain namespace strings. They
resolve the active chain's `WalletKitAdapter` from the registry and check for
the presence of a capability method before offering or triggering it. Chains
that can't do a thing leave the method `undefined`.

```
                    ┌────────────────────────────┐
                    │  Kimi K2.6 Agent Loop      │
                    │  (server: agent-api)       │
                    └─────────────┬──────────────┘
                                  │ tool_pending: x402_fetch
                                  ▼
                    ┌────────────────────────────┐
                    │  services/x402/ (mobile)   │  ← provider-neutral
                    │  402 loop + budget gate    │
                    └─────────────┬──────────────┘
                                  │ (Is settleX402Payment present?)
                                  ▼
                    ┌────────────────────────────┐
                    │     WalletKitRegistry      │
                    └─────────────┬──────────────┘
               ┌──────────────────┼──────────────────┐
               ▼                  ▼                  ▼
     ┌──────────────────┐ ┌───────────┐ ┌──────────────────┐
     │   EvmWalletKit   │ │ SolanaKit │ │     SuiKit       │
     │ settleX402Payment│ │ (= undef) │ │   (= undefined)  │
     │  (Phase 2 + 3)   │ │           │ │                  │
     └──────────────────┘ └───────────┘ └──────────────────┘
```

### 3.2 Reusable building blocks (do not re-implement)
| Need | Already shipped |
| :--- | :--- |
| Signed user→agent allowance + cap | `PermissionGrantStore` grant with `scope.kind === "delegation"`, `delegation: DelegationStruct`, `delegationMeta.maxAmount` |
| Build scope/caveats from an allowance | `buildErc20AllowanceConfig` in [`agentDelegationMapping.ts`](file:///home/cstralpt/takumipay/mobile-app/services/agentDelegationMapping.ts) |
| Create / sign / encode a delegation | `createDelegation`, `signDelegation`, `encodeDelegations` on the adapter (Phase 2) |
| Redeemer (delegate) address | `AGENT_DELEGATE_ADDRESS` in [`agentDelegate.ts`](file:///home/cstralpt/takumipay/mobile-app/constants/agentDelegate.ts) (1Shot relayer delegate, OTA-rotatable) |
| Gas-abstracted execution + fee bound | `relayerEstimate7710Transaction`, `relayerSend7710Transaction`, `relayerGetStatus`, `assertFeeWithinSafetyBound`, `RELAYER_FEE_SAFETY_MAX_USDC_ATOMS` |
| 402 challenge parsing conventions | `parseX402Challenge` / `accepts[]` handling in [`pathCRawX402.ts`](file:///home/cstralpt/takumipay/mobile-app/services/nanopay/pathCRawX402.ts) |
| Status polling | `services/gasAbstraction/pollTaskStatus.ts` |

---

## 4. Technical Mechanics: x402 + ERC-7710

### 4.1 The HTTP 402 challenge loop (research notes §5.1)
1. **Probe.** Agent calls the protected resource. Server returns
   `402 Payment Required` with payment requirements.
2. **Parse.** Read the `accepts[]` entry whose `scheme === "exact"` and whose
   `network` matches an EVM chain we hold a wallet on. For the ERC-7710 path
   the entry carries `extra.assetTransferMethod === "erc7710"` and names a
   **facilitator** URL.
3. **Budget-gate.** Compare `maxAmountRequired` (+ estimated relayer fee)
   against the remaining budget of the stored allowance delegation.
4. **Settle.** Either (A) attach a signed delegation context the facilitator
   redeems, or (B) execute the transfer through the 1Shot relayer ourselves
   (§4.4). Both yield an `X-PAYMENT` proof.
5. **Retry with proof.** Re-issue the request carrying `X-PAYMENT`. Server
   verifies, returns `200 OK` (+ `PAYMENT-RESPONSE`) with the resource.

### 4.2 The seller contract (what we must satisfy)
Per the MetaMask **seller** guide, a server using `@x402/express`
`paymentMiddleware` advertises, for each protected route, an `accepts[]`
entry shaped:

```jsonc
{
  "scheme": "exact",
  "price": "$0.01",
  "network": "eip155:84532",        // CAIP-2 (Base Sepolia)
  "payTo": "0xSeller…",
  "extra": { "assetTransferMethod": "erc7710" }
}
```

The seller registers an `x402ExactEvmErc7710ServerScheme` against a
**facilitator** (e.g. Base Sepolia
`https://tx-sentinel-base-sepolia.dev-api.cx.metamask.io/platform/v2/x402`).
Headers in play: `PAYMENT-REQUIRED` (challenge) and `PAYMENT-RESPONSE`
(settlement receipt). We are the **buyer**; we only consume this contract.

### 4.3 The buyer contract — MetaMask delegation provider (primary rail)
Per the MetaMask **buyer/delegations** guide, the buyer signs a **delegation**
(not a direct transfer) that the facilitator redeems during settlement. The
SDK building blocks:

```typescript
import { createx402DelegationProvider } from "@metamask/smart-accounts-kit/experimental";
import { x402Erc7710Client } from "@metamask/x402";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";

const erc7710Client = new x402Erc7710Client({
  delegationProvider: createx402DelegationProvider({
    account: buyerSmartAccount,          // MetaMask smart account (EIP-7702 upgraded EOA)
    // parentPermissionContext: <encoded user→agent delegation>  // §4.5 recurring
  }),
});

const coreClient = new x402Client().register("eip155:*", erc7710Client);
const httpClient = new x402HTTPClient(coreClient);
const fetchWithPayment = wrapFetchWithPayment(fetch, httpClient);

const paidResponse = await fetchWithPayment(resourceUrl, { method: "GET" });
```

`createx402DelegationProvider` issues an **open** root delegation (delegate
left unspecified so any facilitator can redeem) and auto-appends `redeemer`,
`allowedTargets`, and `timestamp` caveats. `wrapFetchWithPayment` intercepts
the 402, asks the provider for a signed delegation chain, attaches it, and
retries — exactly the loop in §4.1, with the **facilitator** doing the
on-chain redemption.

> **Signing-isolation invariant (CLAUDE.md dApp-bridge rule, generalized).**
> The `buyerSmartAccount` here MUST be derived from the **paying wallet bound
> to the agent session** (the wallet whose delegation funds the budget), not
> from the home-screen `activeWallet`. The x402 client receives the wallet
> explicitly; it never reads `useWallet` state as a fallback.

### 4.4 The buyer contract — 1Shot relayer (alternative rail, research-notes path)
Research notes §5.1 settle through the **1Shot relayer** and pass the **tx
hash** as proof. We already have this rail from Phase 3. When the 402 names a
facilitator we can't reach, or when the seller accepts an on-chain-settled
proof, the client:

1. Builds a single execution leg: `USDC.transfer(payTo, maxAmountRequired)`.
2. Uses the **stored, already-signed** user→agent delegation as
   `delegationContext` (re-`encodeDelegations` the persisted
   `DelegationStruct`) — delegate = `AGENT_DELEGATE_ADDRESS` = 1Shot delegate.
3. Calls `relayerEstimate7710Transaction` (validates scope + locks fee),
   asserts the fee via `assertFeeWithinSafetyBound`, then
   `relayerSend7710Transaction`.
4. Polls `relayerGetStatus` to a terminal `transactionHash`.
5. Retries the resource with `X-PAYMENT` carrying the tx hash (base64 envelope,
   mirroring `encodeX402Envelope` in
   [`pathCRawX402.ts`](file:///home/cstralpt/takumipay/mobile-app/services/nanopay/pathCRawX402.ts)).

**Rail selection** is a property of the parsed challenge, never a chain-id
branch: if the seller's facilitator advertises delegation redemption → Rail A
(§4.3); else → Rail B (§4.4). The `services/x402/` orchestrator owns this
decision in one place.

### 4.5 Recurring / periodic budgets (MetaMask recurring-payments guide)
For "X USDC per week" budgets the MetaMask flow grants an
`erc20-token-periodic` advanced permission via EIP-7715
`requestExecutionPermissions()`:

```typescript
// MetaMask advanced-permission request (one-time user approval)
"type": "erc20-token-periodic",
"periodAmount": parseUnits("10", 6),   // 10 USDC
"periodDuration": 604800,              // 7 days, seconds
```

This maps **directly** onto our existing `erc20PeriodTransfer` scope already
handled by `buildErc20AllowanceConfig` / `createDelegation` (Phase 2 §5.3).
The `parentPermissionContext` returned by the grant becomes the
`createx402DelegationProvider({ parentPermissionContext })` input (open
redelegation), so every x402 call inside the week reuses the same grant with
no further prompts; the period enforcer resets the allowance each period.
**No new caveat type is needed** — Phase 2 already emits `erc20PeriodTransfer`.

---

## 5. Interface Extensions

### 5.1 New data types in `types.ts`
Plain, serializable shapes (no SDK classes leak across the port):

```typescript
/** Normalised x402 "exact" challenge for the ERC-7710 settlement path.
 *  Superset-compatible with the EIP-3009 `X402Challenge` in nanopay so the
 *  shared parser can emit either; `assetTransferMethod` discriminates. */
export interface X402Erc7710Challenge {
  scheme: "exact";
  network: string;                 // CAIP-2, e.g. "eip155:84532"
  maxAmountRequired: string;       // USDC atoms, decimal string (bigint-safe)
  payTo: `0x${string}`;
  asset: `0x${string}`;            // USDC address on `network`
  resource: string;
  facilitator?: string | null;     // facilitator URL named by the seller
  assetTransferMethod: "erc7710";  // gates the delegation rail
  maxTimeoutSeconds?: number;
}

export interface SettleX402PaymentArgs {
  wallet: TWallet;                 // paying wallet bound to the agent session
  chain: ChainConfig;
  challenge: X402Erc7710Challenge;
  /** Persisted, already-signed user→agent allowance (the budget). */
  delegation: DelegationStruct;
  /** Remaining spendable atoms for this allowance (budget gate, §6.2). */
  remainingBudgetAtoms: bigint;
}

export type SettleX402PaymentResult =
  | { status: "settled"; proof: string; rail: "facilitator" | "relayer"; txHash?: string; spentAtoms: bigint }
  | { status: "over_budget"; requestedAtoms: bigint; remainingBudgetAtoms: bigint }
  | { status: "failed"; reason: string };   // `reason` = friendly copy only
```

### 5.2 `WalletKitAdapter` change
```typescript
export interface WalletKitAdapter {
  // … Phase 2 createDelegation / signDelegation / encodeDelegations …
  // … Phase 3 relayer* methods …

  /**
   * Settle a single x402 "exact" challenge using a pre-signed ERC-7710
   * allowance delegation. Selects the facilitator or 1Shot-relayer rail
   * from the challenge, enforces the budget + fee safety bounds, and
   * returns an `X-PAYMENT` proof. EVM-only; Solana/Sui leave undefined.
   */
  settleX402Payment?(args: SettleX402PaymentArgs): Promise<SettleX402PaymentResult>;
}
```

> A single coarse method keeps the SDK surface (`@metamask/x402`,
> `@x402/*`) entirely inside the EVM kit; the orchestrator and agent loop
> stay SDK-free and chain-agnostic.

### 5.3 EVM implementation sketch (`services/walletKit/evm/x402Settle.ts`)
```typescript
import { AGENT_DELEGATE_ADDRESS } from "../../../constants/agentDelegate.ts";
import {
  assertFeeWithinSafetyBound,
  relayerEstimate7710Transaction,
  relayerSend7710Transaction,
  relayerGetStatus,
} from "./relayer.ts";
// Rail A SDK imports are loaded lazily so non-x402 paths don't pull them in.

export async function settleX402PaymentEvm(
  args: SettleX402PaymentArgs,
): Promise<SettleX402PaymentResult> {
  const { challenge, delegation, remainingBudgetAtoms } = args;
  const requestedAtoms = BigInt(challenge.maxAmountRequired);

  // Budget gate (SI-1). Hard ceiling is still the on-chain caveat.
  if (requestedAtoms > remainingBudgetAtoms) {
    return { status: "over_budget", requestedAtoms, remainingBudgetAtoms };
  }

  // Rail B (1Shot relayer) — reuse Phase 3 verbatim.
  if (!challenge.facilitator /* or facilitator advertises onchain settle */) {
    const transfer = encodeErc20Transfer(challenge.payTo, requestedAtoms);
    const delegationContext = await encodeDelegations({
      chain: args.chain, delegations: [delegation],
    });
    const estimate = await relayerEstimate7710Transaction({
      chainId: args.chain.chain.id,
      delegationContext,
      transactions: [{ to: challenge.asset, value: 0n, data: transfer }],
      feeToken: challenge.asset,
    });
    if (!estimate.success) return { status: "failed", reason: friendlySettlementError() };
    assertFeeWithinSafetyBound(estimate.requiredPaymentAmount); // SI-2
    const { taskId } = await relayerSend7710Transaction({ /* …estimate.context… */ });
    const txHash = await pollToTerminal(taskId);                // services/gasAbstraction/pollTaskStatus
    return {
      status: "settled", rail: "relayer", txHash,
      proof: encodeProofEnvelope({ challenge, txHash }),
      spentAtoms: requestedAtoms,
    };
  }

  // Rail A (MetaMask facilitator) — wrapFetchWithPayment redeems the
  // delegation through the facilitator; proof is the PAYMENT-RESPONSE.
  return await settleViaFacilitator(args);  // §4.3
}
```

> **Error discipline (CLAUDE.md user-facing-errors rule).** `reason` is
> always hand-written friendly copy. Raw relayer/facilitator bodies, HTTP
> status lines, and RPC payloads go to `if (__DEV__) console.warn(...)` only,
> never into the returned `reason` or any thrown `Error.message` that bubbles
> to UI. This mirrors the already-sanitised
> [`relayer.ts`](file:///home/cstralpt/takumipay/mobile-app/services/walletKit/evm/relayer.ts)
> and `services/transcribeAudio.ts`.

### 5.4 Orchestrator (`services/x402/`)
Provider-neutral, SDK-free, Node-unit-testable. Proposed files:

* `agentX402Client.ts` — the §4.1 loop: `probe → parse → gate → settle → retry`.
* `parseX402Erc7710Challenge.ts` — `accepts[]` reader returning
  `X402Erc7710Challenge`; reuses the parsing conventions and tolerance of
  [`pathCRawX402.ts`](file:///home/cstralpt/takumipay/mobile-app/services/nanopay/pathCRawX402.ts)
  (`scheme === "exact"`, JSON body primary, header fallback). Factor the
  shared `accepts[]` walker so both modules stay in lockstep.
* `budget.ts` — `x402SpendLedger`: per-`(wallet, delegationSalt)` running
  total persisted in SecureStore alongside the grant; `remaining()` =
  `delegationMeta.maxAmount − spent` (or period-aware for `erc20PeriodTransfer`).
* `index.ts` — `runAgentX402Fetch(args)` returning the resource payload plus a
  settlement summary for the agent.

### 5.5 Agent tool registration (cross-repo)
Add a single mobile tool so the Kimi K2.6 loop can drive the flow:

* **Mobile** — new executor under
  `services/agent-executors/wallet/` (or a dedicated `x402/` bucket),
  registered in
  [`agent-executors/index.ts`](file:///home/cstralpt/takumipay/mobile-app/services/agent-executors/index.ts)
  and added to `EXPECTED_MOBILE_TOOLS`. Tool name: **`x402_fetch`**.
  Input: `{ url, method?, maxSpendUsdc? }`. Output (sanitized): the resource
  body (or a summary) + `{ paid: boolean, amountUsdc, rail, txHash? }`.
  Capability: a new **`agent_pay`** capability (factual: "spends from the
  agent allowance"), gated by the presence of a `delegation` grant.
* **Server** (`takumi-agent-api`) — add `x402_fetch` to the wallet tool group
  in `src/tools/registry.ts` with `executor: "mobile"`, `capability:
  "agent_pay"`. Onchain-adjacent ⇒ mobile, per the registry's non-negotiable
  rule. `assertRegistryParity()` and `pnpm check:agents` enforce both sides
  match. Update the `wallet` agent `tool_prefixes` in
  [`agentManifests.json`](file:///home/cstralpt/takumipay/mobile-app/services/agent-executors/agentManifests.json)
  to claim `x402_` (or register under the existing `defi`/`wallet` prefix set).

---

## 6. Flow & UX Integration

### 6.1 Capability resolution
The `x402_fetch` executor resolves the active EVM `walletKit` and checks
`typeof walletKit.settleX402Payment === "function"`. If absent (Solana/Sui
active, or no delegation grant), it returns a friendly "this resource needs an
EVM agent allowance" result to the agent — no crash, no chain branch.

### 6.2 The budget gate (silent vs. prompt)
1. Load the active wallet's `delegation` grant from `PermissionGrantStore`
   (`scope.kind === "delegation"`). If none → **no autonomous spend**; the
   agent returns a result asking the user to grant an allowance first.
2. Compute `remaining = x402SpendLedger.remaining(wallet, grant)`.
3. If `requestedAtoms + estimatedFee ≤ remaining` → **settle silently**
   (research notes §5.4: "never had to click Approve").
4. Else → return `status: "over_budget"`; the agent surfaces a one-tap
   approval sheet (`describeErc20Allowance`-style hand-written copy:
   *"This data costs $0.40 — over your remaining $0.18 agent budget. Top up
   the allowance?"*). On approval the user re-signs an allowance (Phase 2
   flow); the per-call payment is never an ad-hoc transaction prompt.
5. On `settled`, advance the ledger by `spentAtoms` and record the tx in
   transaction history (relayer rail) for the activity feed.

### 6.3 Worked example (research notes §5.4, Venice-free)
1. User granted the Core Agent a **$5.00 USDC** allowance (Phase 2,
   biometric-signed, stored as a `delegation` grant).
2. User: *"Assess the safety of the top yield pools on Base and rebalance into
   the safest."* (Kimi K2.6 plans.)
3. Agent calls the paid **pool-safety oracle** (the demo seller's
   `GET /api/v1/pool-safety`, §9); server returns **402** for **0.02 USDC**
   with `assetTransferMethod: "erc7710"`.
4. `x402_fetch` parses the challenge, sees `0.02 ≤ 5.00` remaining, settles via
   the chosen rail, ledger → `4.98` remaining.
5. Agent retries with `X-PAYMENT`, gets `200 OK` + safety scores, rebalances,
   and reports. **Zero payment prompts.**

---

## 7. Security Invariants & Audit Guidelines

* **SI-1. Budget never exceeded.** `settleX402Payment` MUST refuse
  (`over_budget`) when `requestedAtoms > remainingBudgetAtoms`. The local
  ledger gates UX; the on-chain `erc20TransferAmount` / `erc20PeriodTransfer`
  caveat is the cryptographic ceiling — the cap holds even if the ledger or
  agent key is compromised (rationale per
  [`agentDelegationMapping.ts`](file:///home/cstralpt/takumipay/mobile-app/services/agentDelegationMapping.ts)
  header).
* **SI-2. Fee overcharge protection.** Reuse `assertFeeWithinSafetyBound` /
  `RELAYER_FEE_SAFETY_MAX_USDC_ATOMS` before any
  `relayerSend7710Transaction`. The **fee** counts against the same safety
  envelope as the **payment**; a 0.02 USDC resource must not incur a 4 USDC
  relayer fee.
* **SI-3. Payment-target binding.** The transfer leg's recipient MUST equal
  the challenge `payTo`, and the `asset` MUST be the expected USDC address for
  `network`. No agent-chosen recipients. Optionally pin `payTo` to an
  `allowedTargets` caveat when the resource is known.
* **SI-4. Wallet/session isolation.** Settlement uses the wallet bound to the
  agent session (the budget's owner), never `activeWallet`/`activeChain`
  fallbacks — same class as commit `4828e91` (CLAUDE.md dApp-bridge rule).
* **SI-5. Replay protection.** Relayer rail: track `taskId`/`txHash`; never
  resubmit a settled challenge. Facilitator rail: the open delegation's
  `timestamp` caveat + the seller's single-use nonce bound replay.
* **SI-6. No raw error leakage.** Per CLAUDE.md, no facilitator/relayer body,
  HTTP status, or RPC payload reaches the user or any UI-bound
  `Error.message`. `reason` strings are hand-written; raw detail is
  `__DEV__`-only logs.
* **SI-7. Provider neutrality.** No hardcoded resource hosts and **no Venice
  endpoints/keys**. The client pays whatever x402 resource the agent targets,
  bounded only by the allowance.
* **SI-8. Chain-agnostic guardrail.** `services/x402/` and the `x402_fetch`
  executor MUST pass `pnpm check:chains` — no `namespace === "eip155"`
  branching; rail and capability selection go through method presence and the
  parsed challenge only.

---

## 8. Test Plan & Acceptance Criteria

### Unit tests (Node `node:test` / Vitest)
* **Challenge parsing.** `parseX402Erc7710Challenge` extracts `payTo`,
  `asset`, `maxAmountRequired`, `network`, `facilitator`, and
  `assetTransferMethod` from an `accepts[]` body; rejects non-`exact` schemes;
  falls back to header form; never throws raw bodies.
* **Budget gate.** `requestedAtoms` equal to / one atom over `remaining`
  resolve to `settled` / `over_budget` respectively; fee is included in the
  comparison; periodic budgets reset across `periodDuration`.
* **Ledger math.** `x402SpendLedger` accumulates `spentAtoms`, survives
  `JSON.stringify` round-trip (decimal strings, no bigint), and is
  `(wallet, delegationSalt)`-scoped (no cross-wallet bleed, mirroring
  `PermissionGrantStore`).
* **Rail selection.** A challenge with a reachable facilitator → Rail A; one
  without → Rail B; selection asserts no chain-id branching.
* **Fee bound.** A mocked estimate above `RELAYER_FEE_SAFETY_MAX_USDC_ATOMS`
  triggers `RelayerFeeOverchargeError` and a `failed` result with friendly
  copy.
* **Error sanitisation.** A 500 facilitator/relayer response yields a friendly
  `reason`; the raw body appears only under a stubbed `__DEV__` logger.

### Integration tests
* **Full loop (mocked fetch + mocked relayer).** `probe(402) → settle →
  retry(200)` returns the resource payload and advances the ledger; the
  retried request carries `X-PAYMENT`.
* **Docking parity.** `EvmWalletKit` registers `settleX402Payment`;
  `SolanaWalletKit` / `SuiWalletKit` leave it `undefined` and compile.
* **Registry parity.** `assertRegistryParity()` passes with `x402_fetch`
  present on both mobile and server; manifest prefix resolves to the right
  agent bucket.

### Acceptance criteria
1. With a stored $5 allowance, a 0.02 USDC 402 resource is paid and returned
   to the agent with **no user prompt**; ledger shows 4.98 remaining.
2. A 402 amount over the remaining budget produces an `over_budget` result and
   a one-tap top-up sheet — **never** an ad-hoc transaction prompt.
3. Relayer fees are bounded by the Phase 3 safety envelope; an overcharge is
   rejected with friendly copy.
4. `pnpm check:chains`, `pnpm test`, and `pnpm check:agents` pass; Solana/Sui
   kits unaffected.
5. The reasoning brain remains **Kimi K2.6**; the repo contains **no Venice
   provider, key, endpoint, or package** after Phase 5.

---

## 9. Demo Seller API (Test Harness)

> **Role boundary.** TakumiPay is the **buyer** in x402 (§3.1, §4). The seller
> is an **external** resource owner — never a TakumiPay product. No public
> seller speaks the ERC-7710 delegation scheme yet, so to exercise Phase 5
> end-to-end we stand up a **throwaway demo seller**. It is test scaffolding
> only: it lives in a **sibling repo / folder** (`takumipay/x402-demo-seller/`),
> ships nothing to users, and is deleted after the hackathon. The MetaMask
> facilitator URL is **seller-side config** and lives only here — it is **not**
> seeded into the mobile app or any TakumiPay backend (it is advertised back to
> the buyer inside each 402 challenge).

### 9.1 What it is
A standalone Node/Express service exposing a mock **DeFi pool-safety oracle** —
the exact resource the §6.3 / research-notes §5.4 flow needs (it sits between
`defi_list_opportunities` and `defi_rebalance`). Payloads are **canned and
deterministic** (hardcoded pool data): the artifact under test is the
*payment*, not the data.

* **Stack:** `@x402/express` `paymentMiddleware` + `@metamask/x402`
  `x402ExactEvmErc7710ServerScheme`.
* **Network:** Base Sepolia (`eip155:84532`).
* **Asset:** testnet USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
* **Facilitator:** `https://tx-sentinel-base-sepolia.dev-api.cx.metamask.io/platform/v2/x402`.
* **`payTo`:** a throwaway Base Sepolia address the demo operator controls
  (receives the USDC; needs no funding). Set via `X402_PAY_TO` env; the seller
  refuses to boot if unset.

### 9.2 Routes & pricing
Two price points so a single run demonstrates **both** budget-gate branches
(§6.2): silent auto-pay *and* over-budget escalation.

| Method & path | Price | Returns | Demonstrates |
| :--- | :--- | :--- | :--- |
| `GET /api/v1/pool-safety` | **$0.02** | ranked `pools[]` with `safetyScore` + `riskFlags` | silent auto-pay (within $5 budget) |
| `GET /api/v1/pool-audit?poolId=<id>` | **$0.75** | a single pool's deep audit report | ledger draw-down across calls |
| `GET /api/v1/pool-audit-full-suite` | **$6.00** | full multi-pool audit bundle | **over-budget** → top-up sheet (SI-1) |
| `GET /healthz` | free | `{ ok: true }` | liveness; not gated |

### 9.3 Challenge contract the seller advertises
Each gated route returns `402` with an `accepts[]` entry the buyer's
`parseX402Erc7710Challenge` (§5.4) consumes verbatim:

```jsonc
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "price": "$0.02",
      "network": "eip155:84532",
      "payTo": "0x<seller-wallet>",
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "resource": "https://<seller-host>/api/v1/pool-safety",
      "extra": { "assetTransferMethod": "erc7710" },
      "facilitator": "https://tx-sentinel-base-sepolia.dev-api.cx.metamask.io/platform/v2/x402"
    }
  ]
}
```

> The seller only **configures** `scheme` / `price` / `network` / `payTo` /
> `extra.assetTransferMethod` (see `x402-demo-seller/src/index.ts`). The
> `@x402/express` middleware + facilitator resolve the fiat `price` into the
> on-chain USDC atom `maxAmountRequired` and inject `asset` / `resource` /
> `facilitator` into the emitted 402 body — which is what the buyer's
> `parseX402Erc7710Challenge` reads. The block above is the **effective**
> challenge the buyer sees, not the literal seller config.

### 9.4 Success payload (after `X-PAYMENT`)
```jsonc
// 200 OK + header PAYMENT-RESPONSE
{
  "asOf": "2026-06-02T00:00:00Z",
  "pools": [
    { "poolId": "aave-v3-usdc", "protocol": "Aave v3",
      "apy": 4.8, "tvlUsd": 1240000000, "safetyScore": 92, "riskFlags": [] },
    { "poolId": "somefarm-usdc", "protocol": "SomeFarm",
      "apy": 31.2, "tvlUsd": 850000, "safetyScore": 38,
      "riskFlags": ["unaudited", "low_tvl", "admin_key_eoa"] }
  ]
}
```
The DeFi agent ranks by `safetyScore`, drops anything with disqualifying
`riskFlags`, picks the winner, and proceeds to `defi_rebalance`.

### 9.5 Reachability
The mobile app (buyer) must reach the seller over HTTPS from a device, so
`localhost` is not enough — expose it via **ngrok** (quick) or a **Railway /
Render** deploy and use that public origin as the resource URL the agent
fetches. CORS must expose the `PAYMENT-REQUIRED` and `PAYMENT-RESPONSE`
headers (MetaMask seller guide).

### 9.6 Manual test script (Base Sepolia)
1. Boot the seller with `X402_PAY_TO` set; tunnel/deploy → note the public origin.
2. In the app, grant the Core Agent a **$5.00 USDC** allowance (Phase 2).
3. Ask the agent to assess pool safety → it calls `x402_fetch` on
   `<origin>/api/v1/pool-safety`.
4. Confirm: no prompt, ledger shows ~**4.98** remaining, and **0.02 USDC lands
   at `payTo`** on [sepolia.basescan.org](https://sepolia.basescan.org).
5. Ask for the **full-suite audit** ($6.00) → confirm the **over-budget** sheet
   fires and **no** payment is sent.

> **Out of scope for this repo.** The seller is not built by this spec's mobile
> changes; it is a companion deliverable. This section is the contract the
> buyer (Phase 5) is written against so the two can be tested together later.
