# Sui Overflow 2026 — Phase 1: Intent Engine — Engineering Spec

**Status:** Draft v0.1 (design, no code yet)
**Author:** Claude (synthesis) · Owner: App
**Date:** 2026-06-15
**Track:** Agentic Web → Sub-track 3 (Intent Engine). **Submission deadline:** 2026-06-21 (PT). **Demo Day:** 2026-07-20.
**Source of truth for intent:** [`docs/sui-overflow-2026-strategy.md`](./sui-overflow-2026-strategy.md)
**Precedent we mirror:** [`docs/sui-chain-support-spec.md`](./sui-chain-support-spec.md), [`docs/sui-dapp-bridge-spec.md`](./sui-dapp-bridge-spec.md), [`docs/defi-strategies-spec.md`](./defi-strategies-spec.md), [`docs/multi-agent-architecture-spec.md`](./multi-agent-architecture-spec.md)
**External docs cited:** Sui PTBs (`docs.sui.io`), Scallop (`docs.scallop.io`), OpenZeppelin Contracts for Sui (`docs.openzeppelin.com/contracts-sui`) — full citation list in Appendix C.

---

## 0. Goal & non-goals

### Goal

Ship the **Intent Engine**: a user states a financial goal in plain language; the Takumi agent
compiles it into a Sui **Programmable Transaction Block (PTB)**; a **guardian** inspects the exact
PTB and the on-chain state it will touch and surfaces risks in plain language; the user **explicitly
confirms** after seeing the risks; the PTB executes atomically on Sui and returns a testnet digest.

Sub-track 3 must-haves, each mapped to a deliverable in this spec:

| Must-have | Deliverable | §  |
|---|---|---|
| text → PTB → execution | zod intent schema + `compileIntentToPtb` + Sui sign-and-execute write path | §3, §4, §8 |
| human-readable PTB preview | `IntentPreviewCard` (plain-language summary + decoded PTB + risk flags) | §7 |
| guardian catching ≥2 risk classes (target 3) | docked `RiskCheck` registry: high-slippage, stale-pool/oracle, over-concentration | §5 |
| explicit confirmation (and a decline path) | two-tool compile→execute split; write-capability approval gate | §6, §8 |

**"Why Sui":** PTBs are the agent's **compile target** — a multi-step goal becomes one atomic,
auditable, previewable transaction, and the guardian inspects the precise object/pool state that
transaction will touch *before* signing, via `dryRunTransactionBlock`. Not a payment rail bolted on
at the end.

### Non-goals (this phase)

- **Autonomous execution / Agent Authority Move object.** That is Phase 2
  (`docs/sui-overflow-2026-phase2-autonomous-guardian-spec.md`). Phase 1 is **human-confirmed on
  every action** — no unattended signing, no on-chain delegation/leash.
- **A custom Move package is not required to ship.** Phase 1's meaningful Sui integration rests on
  PTBs + guardian (strategy §"Hard constraints"). An optional thin **intent-receipt** Move module
  (§10) gives a Package ID + auditability if time allows — it is strictly additive.
- **No new chain-namespace branches in shared code.** Everything new docks behind the existing
  registries (§2.2). `pnpm check:chains` must stay green.
- **No EVM/x402 settlement in the hero path.** The story is the PTB-compiling agent + guardian; x402
  stays out of the demo (strategy §"What NOT to do").
- **Not a general DEX aggregator.** We support a small, fixed set of intents (`supply`/`withdraw`/
  `swap`) against real Sui protocols — DeepBook v3 (swap, testnet+mainnet), Scallop (supply, mainnet),
  Cetus/7K (swap, mainnet). Breadth beyond these is a post-submission concern.

### 0.1 How we satisfy Sub-track 3 (Intent Engine) — the judging scorecard

The official problem statement and its four must-haves, mapped to deliverables:

| Sub-track 3 must-have (official) | Our deliverable | Status |
|---|---|---|
| **text → PTB → execution flow** | `Intent` (zod) → `compileIntentToPtb` → `signAndExecuteSuiPtb` → testnet digest (§3, §4, §8) | ✅ the LLM emits a *structured intent*; the compiler owns PTB construction (no hallucinated coinTypes) |
| **human-readable PTB preview** | `IntentPreviewCard`: plain-language summary **+ decoded `SuiDecodedCommand[]`** (§7.2) | ✅ shows the *actual decoded commands*, not just a sentence |
| **guardian catching ≥2 risk classes** | **all 3 the statement names** — high slippage, concentration, **stale pools** (§5.2) | ✅ **exceeds** (asks 2, ships 3, matching their wording) |
| **explicit confirmation step** | write-tool approval sheet + un-bypassable guardian `block` (§5.3, §6) | ✅ two-layer; the **decline path is first-class & demoed** |

> *"A swap chatbot with no guardian layer is not an intent engine."* — the guardian is the entire
> bar; it is where we invest (real on-chain reads via `dryRunTransactionBlock`, not canned warnings).

**Why Sui specifically (the disqualifying bar — put this verbatim in the README & demo narration):**

> A multi-step financial goal ("swap half my SUI to USDC, then supply it to Scallop") compiles into
> **one Programmable Transaction Block** — a single atomic, all-or-nothing transaction. Before
> signing, the guardian runs `dryRunTransactionBlock` and inspects the **exact object/pool state and
> the precise balance/object changes that *this* transaction will produce**, then explains the risk
> in plain language. The risk shown is computed from the real effects of the real transaction, not a
> generic heuristic. On a multi-tx EVM flow there is no atomic preview and far weaker pre-sign
> inspection — so Sui's **object model + PTB atomicity + dry-run effects** are what make the guardian
> possible and trustworthy. Sui isn't a payment rail here; it is what makes the AI **safer**.

**Where we win the 50% "Real-World Application" weight:** the intent engine ships *inside TakumiPay*,
a live multi-chain wallet/payments app with real users — not a standalone demo. The persona (an
Indonesian user who wants yield but "doesn't speak DeFi") plus a **plain-language, Bahasa/English**
guardian is a financial-inclusion story, not a crypto-native toy. Lead the pitch with the user and
the product; the architecture is the 20%.

**What we must nail to *place* (not just comply):** (1) the guardian visibly reads **real** testnet
state and genuinely fires — stale-pool is the easiest to make authentically fire; (2) the demo shows
a risky intent **blocked** in plain language, not just a happy-path success; (3) if Day-3 lands, the
**atomic swap→supply PTB** is the hero "why Sui" moment; (4) real testnet digests + public repo +
README opening on the "why Sui" paragraph above.

### 0.2 Winning narrative, demo script & README (the execution playbook)

The score is decided as much by *presentation* as by code. This is the playbook the team executes;
treat it as binding for the recording and the repo.

**Lead with the human, not the chain.** Open on the persona (§"The persona" in the strategy): an
Indonesian user who wants to earn on idle USDC but "doesn't speak DeFi." The product is **TakumiPay**
(a live wallet/payments app), and the Intent Engine is a feature inside it — not a standalone demo.
That framing is what wins the **50% Real-World** weight.

**Demo script (≤5 min, maps 1:1 to the four must-haves):**

| # | On screen | Must-have it proves | Network |
|---|---|---|---|
| 1 | Type a goal in plain English/Bahasa: *"swap 5 SUI to USDC, keep it safe"* | text → PTB | testnet (DeepBook) |
| 2 | `IntentPreviewCard`: plain-language summary **+ decoded PTB** (`deepbook::swap`, split, transfer) | human-readable PTB preview + "why Sui" (decoded, atomic) | testnet |
| 3 | Guardian rows: green "Looks safe" → user says *go ahead* → **approval sheet** → **testnet digest** (click SuiVision) | explicit confirmation + execution | testnet |
| 4 | Type a deliberately risky goal: *"swap 90% of my SUI now"* (large size / thin pool) → guardian **blocks** in plain language → agent declines, **never reaches the sheet** | guardian (≥2 classes) + decline path — *the make-or-break* | testnet |
| 5 | (Optional, mainnet) *"earn yield on my USDC"* → Scallop supply preview → small real digest | "production-ready, just switch to mainnet" + 100% prize | mainnet |
| 6 | One sentence: **"Why Sui"** (§0.1 paragraph, verbatim) over the decoded-PTB still | disqualifying bar | — |

Show **at least one genuine block** (step 4). Most teams only demo the happy path — the decline is
the proof we're an intent engine, not a swap chatbot.

**Talking points mapped to the judging weights:**
- *Real-World (50%):* "Ships inside a real multi-chain wallet with real users; plain-language guardian
  in Bahasa + English = financial inclusion, not a crypto toy."
- *Product & UX (20%):* the structured `IntentPreviewCard`, the bilingual plain-language risks, the
  no-raw-error discipline.
- *Technical / meaningful Sui (20%):* "PTB is the agent's compile target; the guardian dry-runs the
  exact transaction and inspects the real object/pool state before signing. We dock into our existing
  `DefiProtocolAdapter` port (the same one jitoSOL/Aave use) and fill the `sui-ptb` submission gap."
- *Presentation & Vision (10%):* the Phase-1 → Phase-2 arc — the same guardian, human-confirmed today,
  acting within an on-chain leash tomorrow.

**README outline (public repo — judges read this first):**
1. One-liner + the **"Why Sui" paragraph (§0.1) as the very first section.**
2. 30-sec "what it does" + the demo GIF/video link.
3. Architecture diagram: NL → Intent → PTB → guardian (dry-run) → confirm → execute, noting the
   reuse of `DefiProtocolAdapter` + `dryRunTransactionBlock`.
4. The 3 guardian risk classes with a real screenshot of a **blocked** intent.
5. Testnet digest link(s) + (if available) mainnet; Package ID if the §10 module shipped.
6. "Run it" + team + KYC note (submission checklist, strategy §"Submission checklist").

**Anti-patterns to avoid on camera:** narrating wei/MIST math; showing raw error strings; a demo with
no block; calling Sui a "payment rail"; more than ~30s of architecture before the user value lands.

---

## 1. Background — what the build rests on

### 1.1 PTBs as the compile target (official Sui model)

A PTB is a single transaction composed of up to a few hundred ordered **commands**
(`MoveCall`, `SplitCoins`, `MergeCoins`, `TransferObjects`, `MakeMoveVec`, …) where the result of
one command feeds the next, executed **atomically** — all-or-nothing (`docs.sui.io`,
Programmable Transaction Blocks). This is exactly the property the Intent Engine needs: a goal like
"swap half my SUI to USDC, then supply it to Scallop" is *one* signable, *one* previewable,
*one* dry-runnable object — not a fragile multi-tx saga.

We build PTBs with `@mysten/sui`'s `Transaction` builder (already a dependency; used across
`services/chains/sui/`). The decoded structural view is already modelled in
`services/chains/sui/payloads.ts` as `SuiDecodedCommand` — the guardian and preview reuse it
verbatim rather than inventing a second shape.

### 1.2 What we already own (Phase 1 is ~80% wiring)

Grounded inventory — these exist today and we reuse them:

- **PTB types + sign modes** — `services/chains/sui/payloads.ts`
  (`SuiSignTxMode = "sign-and-execute"`, `SuiDecodedCommand`, `SuiSimulationSummary`,
  `SuiSimulationWarning`).
- **On-chain inspection / dry-run** — `services/chains/sui/simulation.ts`
  `simulateSuiTransaction(client, { txBase64, sender })` wraps `dryRunTransactionBlock` and already
  lifts effects → `balanceChanges` / `objectChanges` / `warnings`. **This is the guardian's
  on-chain read primitive** — we extend its warning set, we don't rebuild it.
- **Sui write path through the kit** — `services/agent-executors/wallet/sui.ts` (`sendSui`,
  `sendSuiCoin`) routes through `SuiWalletKit` via `walletKitRegistry`. The execute step adds one
  sibling executor that signs-and-executes a pre-built PTB.
- **`SuiWalletKit`** — `services/walletKit/sui/SuiWalletKit.ts` (signer materialisation,
  `buildTxExplorerUrl`, native/coin transfer). We dock one new optional method here (§8.2).
- **Agent tool → preview card → confirm pipeline** — `StructuredUI/registry.ts` maps tool names to
  cards; `SuiPendingTxCard` already renders the confirmed/failed receipt and the write-capability
  approval gate already provides explicit confirmation.
- **Opaque-intent hand-off precedent** — `mintPaymentIntentTool.ts` mints an intent server-side and
  hands an **opaque `intentId`** to a later signing step. Our compile→execute split copies this
  shape exactly (§6, §8.1).
- **Error discipline** — the "friendly copy in UI, raw detail in `__DEV__` only" rule (CLAUDE.md,
  `feedback_user_facing_errors`) *is* the plain-language guardian UX. Free points; §9.
- **The DeFi adapter port + swap aggregator already exist** — see §1.2.1. We dock into them; we do
  **not** invent a parallel DeFi registry.

The genuinely new work: **(a) the NL→PTB compiler** (a thin layer over the existing port), **(b) the
guardian's risk checks**, and **(c) the Sui-PTB submission path** the current executors lack (§1.2.1).

### 1.2.1 Reuse the existing DeFi port — do NOT invent a parallel one (critical)

The app already has a first-class DeFi layer modelled on the **same space-docking discipline** as
the wallet kit, with **EVM and Solana** venues live. The Sui Intent Engine docks into it:

- **`services/defi/` — `DefiProtocolAdapter` (the port).** One adapter per (protocol, deployment):
  `buildDeposit` / `buildWithdraw` / `readPosition` (+ optional `buildClaim`/`buildWrap`,
  `staticSafetyScore`, `minDepositRaw`). Returns an **`UnsignedCall`** discriminated by namespace —
  `evm-call | solana-ix | sui-ptb`. **`sui-ptb` is already a reserved variant** (`services/defi/types.ts:122`)
  "*when a Sui DeFi adapter ships*." Registry: `registerDefiAdapter` / `getDefiAdapter` /
  **`listDefiAdaptersForChain(namespace, chainId)`** (registry.ts) — already **network-gated** by
  `chainId` (EVM number / Solana cluster / **Sui network string**). Boot: `bootDefi()` (bootstrap.ts)
  registers adapters per feature-flag phase, incl. a **`FEATURE_DEFI_TESTNET_ADAPTERS`** path.
- **Exemplar to copy: `adapters/solanaJito.ts`** — the jitoSOL liquid-staking "supply to earn yield"
  adapter (reads pool state on demand, computes the exchange rate, builds real instructions, returns
  a position). **Scallop = the Sui analog**: a `kind: "stablecoin_lending"` adapter,
  `namespace:"sui"`, `chainId:"mainnet"`, returning `{ kind:"sui-ptb", transactionBlockBase64 }`.
- **`services/swap/aggregator.ts` — the swap layer** (separate from `DefiProtocolAdapter`; backend
  `/swap/route`, EVM-shaped today). Exposes `getPriceImpactSeverity` (2% warn / 10% danger) and
  `validateSlippage` — **the guardian reuses these thresholds** so slippage UX matches in-app swap.

**The gap the Intent Engine fills (this is our "why Sui" submission work, not a rebuild):** the
existing agent executors (`agent-executors/defi/writes.ts`) are **EVM-only at submission** — they
throw `unsupported_chain` for any `UnsignedCall.kind !== "evm-call"` ("the agent-executor pipeline
is EVM-first for v1"). So `sui-ptb` (and `solana-ix`) adapters can be *built* but **not submitted**
by the agent today. The Intent Engine is the pipeline that finally **submits a `sui-ptb`** (via the
Sui WalletKit method, §8.2) — guarded, previewed, confirmed.

**Consequences for this spec (replacing the earlier `IntentProtocolAdapter` sketch):**
- `supply` / `withdraw` → a new **`ScallopSuiAdapter implements DefiProtocolAdapter`**
  (`services/defi/adapters/scallopSui.ts`), registered in `bootDefi()`. **No new port, no `networks`
  field** — `chainId:"mainnet"` + `listDefiAdaptersForChain` already does the network gate.
- `swap` → a small **Sui swap module** under `services/swap/sui/` (DeepBook/Cetus/7K, §4.5) producing
  a `sui-ptb`, mirroring `aggregator.ts`'s `SwapRoute` shape and reusing its severity/slippage helpers.
- The **compiler** (§4) is a thin dispatcher: `Intent` → `getDefiAdapter("scallop-sui").build*` (supply)
  or the Sui swap module (swap) → `UnsignedCall{kind:"sui-ptb"}`. The guardian + tools + card are
  unchanged from §5–§7.

### 1.3 The space-docking discipline (hard rule)

TakumiPay extends capabilities behind small, presence-checked adapter interfaces registered with a
registry; shared code dispatches through the registry instead of branching on namespace strings
(`feedback_space_docking`; enforced by `pnpm check:chains`). We already have `ChainAdapter` (dApp
bridge), `WalletKitAdapter` (first-party wallet ops), **and `DefiProtocolAdapter` (DeFi venues,
§1.2.1)**. Phase 1 **docks into the existing ports** rather than inventing new ones:

- **`DefiProtocolAdapter`** (existing) — Scallop docks here for `supply`/`withdraw` (§4.4).
- **Sui swap module** `services/swap/sui/` (mirrors the existing `aggregator.ts`) — DeepBook/Cetus/7K
  for `swap` (§4.5).
- The only genuinely-new docking port is **`RiskCheck`** — one per risk class; inspects the compiled
  PTB + dry-run and emits plain-language flags (§5).

New venues and new risk classes dock by **registering** (`registerDefiAdapter`, the swap
`SWAP_PRIORITY`, the `RiskCheck` registry), never by adding an `if (venue === …)` /
`if (namespace === …)` branch. Files under `components/`, `hooks/`, `app/` must not branch on
namespace — the compiler and guardian live under `services/`, where Sui-specificity is the
contract (same allowance the wallet-kit Sui code already has).

### 1.4 Three-repo topology (where Phase 1 lands)

The agent is **server-authoritative for tool definitions**. Three repos, one contract:

- **`agent-api/`** (NestJS + Vercel AI SDK `ai` v6) — the **source of truth** for what tools exist.
  Each tool is a `ToolMeta` (`{ name, category, executor, capability, description, inputSchema }`,
  `agent-api/src/tools/internal/types.ts`). The DeFi specialist's tools live in
  `agent-api/src/tools/defi/`. Hard rule (`agent-api/src/tools/registry.ts`): **onchain = `executor:"mobile"`, non-onchain = `executor:"server"`.** The server also builds the approval-sheet
  `meta.human_summary` deterministically via `buildHumanSummary(name, input)`
  (`agent-api/src/tools/human-summary.ts`). `scripts/sync-agent-manifests.mjs` syncs
  `agent-api/src/agents/manifests/agentManifests.json` → the mobile
  `services/agent-executors/agentManifests.json` so prefix-routing matches on both sides.
- **`api/`** (NestJS REST) — backs DeFi reads via `/strategies/*` (`api/src/strategies`): the
  `OpportunityCache`, `UserStrategy` config, and the pool-safety/`safety_score` signal that the EVM
  DeFi agent already consumes (see `defi_simulate_deposit` `safety_score`, `defi_rebalance`'s
  "pool-safety oracle"). Phase 1's guardian reads Scallop on-chain **directly** (no new backend
  dependency this week) but the `OpportunityCache` is the precedent for a future Scallop yield feed.
- **mobile (`mobile-app/`)** — executes the `executor:"mobile"` tools against the device signer +
  registry, and renders each tool's result through a StructuredUI card keyed by tool name.

**Consequence for the Intent Engine:** the two new tools must be added in **three** places —
(1) `ToolMeta` + `human_summary` case in `agent-api`, (2) mobile executor in
`services/agent-executors/`, (3) StructuredUI card in `registry.ts`. Both are onchain →
`executor:"mobile"`. **Capability classification:** `defi_intent_preview` is **`capability:"read"`**
(it dry-runs and inspects, never signs) and `defi_intent_execute` is `capability:"write"` (it signs).

> **Do not use `capability:"simulate"`.** The `simulate` capability is treated as a plain `read` in
> this codebase — its "preview" UX treatment requires a registered card and otherwise hangs the
> server agent loop on `awaitMobileResult` until a 5-min timeout (that bug is why
> `defi_simulate_deposit` is `read`, not `simulate`). `defi_intent_preview` is therefore a plain
> **`read`**: it runs silently, returns its result, and `IntentPreviewCard` renders the compiled plan
> + guardian flags as an informational card. **The explicit-confirmation gate lives entirely on the
> `write` tool `defi_intent_execute`** — the standard mobile approval sheet (the same gate `send_sui`
> uses) is the user's eyes-open confirm, and rejecting it (or the guardian blocking it) is the
> decline path. No `simulate`, no card-driven confirm gate on the preview.

---

## 2. Architecture

### 2.1 Pipeline

```
User (NL): "earn yield on my idle USDC, safely"
   │
   ▼  Takumi agent (useChat) — DeFi specialist (manifest prefix `defi_`)
   │  emits a STRUCTURED intent (zod) and calls:
   │
   ├─►  defi_intent_preview   (capability: "read")
   │       1. validate intent (zod)                         services/chains/sui/intent/intentSchema.ts
   │       2. compileIntentToPtb(intent, ctx) → PTB + decoded  …/intent/compileIntentToPtb.ts
   │            ├─ supply/withdraw → getDefiAdapter("scallop-sui")   services/defi/ (existing port)
   │            └─ swap           → getSuiSwapRoute(...)             services/swap/sui/ (mirrors aggregator)
   │       3. GUARDIAN.inspect(ptb, dryRun, ctx) → RiskFlag[]  …/intent/guardian/*
   │            ├─ high slippage?
   │            ├─ stale pool / stale oracle?
   │            └─ over-concentration?
   │       4. stash {ptbBase64, summary, flags} in IntentStore keyed by opaque intentId
   │       └─ return { intentId, human_summary, decoded, risk_flags }  →  IntentPreviewCard
   │
   ▼  IntentPreviewCard (informational, output-available): plain-language summary + decoded PTB
   │       + guardian risk rows. NO card-driven gate — risk_flags are in the tool result, so the
   │       model decides whether to offer execution and narrates the risks in chat.
   │         · safe   → agent offers to proceed; user agrees → model calls defi_intent_execute
   │         · risky  → guardian "block" flag; agent declines / asks to adjust (← risky-intent demo)
   │
   └─►  defi_intent_execute   (capability: "write")
           0. STANDARD MOBILE APPROVAL SHEET  ← this is the EXPLICIT confirmation (same gate as send_sui)
           1. load ptbBase64 from IntentStore by intentId (reject if absent/expired → re-preview)
           2. SuiWalletKit.signAndExecuteSuiPtb(wallet, chain, ptbBase64)   …/sui/SuiWalletKit.ts
           3. record history; return { digest, network }  →  SuiPendingTxCard (Confirmed/Failed)
```

Why two tools rather than one write tool: the guardian must read live on-chain state and surface
risks **before** anything is signable. A `read` compile/guard tool (whose result carries the
`risk_flags`) followed by a `write` execute tool keyed on an opaque `intentId` is the same proven
shape as `mintPaymentIntent` → pay. The **explicit-confirmation** requirement is satisfied by the
`write` tool's standard approval sheet — not by the preview card. The **decline path** is
first-class and demoable two ways: the guardian emits a `block` flag and the agent never offers
execution, or the user rejects the approval sheet.

### 2.2 File layout (new)

```
# NEW Sui-PTB-native intent layer — names describe behaviour, not category
services/chains/sui/intent/
  intentSchema.ts          zod Intent schema (the structured object the LLM emits) + types
  compileIntentToPtb.ts    compileIntentToPtb(intent, ctx): dispatches to the EXISTING defi port /
                           swap module below → CompiledIntent { ptbBase64, decoded, summary, apy?, expectedOut? }
  intentStore.ts           opaque intentId → { ptbBase64, summary, flags, expiresAt } (MMKV, TTL)
  guardian/
    riskCheck.ts           RiskCheck interface, RiskFlag (plain-language), Severity (the contract)
    riskCheckRegistry.ts   register RiskChecks + runGuardian(ptb, dryRun, ctx) → RiskFlag[]
    checks/
      highSlippageCheck.ts        (reuses swap/aggregator getPriceImpactSeverity, §5.2)
      staleOracleCheck.ts         (stale pool / stale price)
      overConcentrationCheck.ts   (too much % into one venue/asset)
  *.test.ts                unit tests (vitest — add to vitest.config.ts include list)

# DOCK INTO THE EXISTING DeFi port (supply/withdraw) — §1.2.1
services/defi/adapters/scallopSui.ts   ScallopSuiAdapter implements DefiProtocolAdapter
                                       (namespace "sui", chainId "mainnet", returns sui-ptb) — mirrors solanaJito.ts
services/defi/bootstrap.ts             register ScallopSuiAdapter in bootDefi() (new Sui phase / flag)

# DOCK INTO THE EXISTING swap layer (swap) — §1.2.1, §4.5
services/swap/sui/
  suiSwapRouter.ts         getSuiSwapRoute(params) → { ptbBase64, expectedOut, priceImpact, … } (mirrors aggregator.ts)
  venues/{deepbookSwap,cetusSwap,sevenkSwap}.ts   per-venue routers (DeepBook testnet+mainnet; Cetus/7K mainnet)
  venueSelector.ts         selectSwapVenue(): priority-ordered, quote-aware venue pick (§4.6.1)
  *.config.ts              network-keyed config (pool keys, endpoints)

# Sui PTB submission (the gap the EVM-only executors leave — §1.2.1, §8.2)
services/agent-executors/defi/intentExecutors.ts  ← defi/ bucket (defi_ prefix → DeFi agent; see §6.4)
      defi_intent_preview + defi_intent_execute executors (compile via the Sui intent layer,
      submit the sui-ptb via the Sui WalletKit method)

components/home/TakumiAgent/StructuredUI/cards/
  IntentPreviewCard.tsx    read-result card: summary + decoded PTB + guardian risk rows (§7.2)
  StrategyConfigCard.tsx   small read card for defi_get_config (§7.4)

agent-api/src/tools/defi/intent.ts            ToolMeta for defi_intent_preview + defi_intent_execute (§6.1)
agent-api/src/tools/human-summary.ts          add defi_intent_execute / defi_intent_preview cases (§6.2)
  (then `pnpm manifests:sync` — no manifest hand-edit, `defi_` already routes to DeFi specialist)
```

Reused unchanged: `payloads.ts` (`SuiDecodedCommand`, `SuiSimulationSummary`,
`SuiSimulationWarning`), `simulation.ts` (`simulateSuiTransaction`), `SuiPendingTxCard.tsx`.
Extended: `StructuredUI/registry.ts` (new card map entries, §7.1), `OpportunityListCard.tsx`
(Sui/Scallop rows, §7.3).

**Naming convention (applies to every new file/symbol):** a name describes **what it does**, not its
category. Match the codebase precedent — `recordTransferHistory.ts`, `coinTransferService.ts`,
`simulateSuiTransaction` — so a file's purpose is readable from its name. Hence `compileIntentToPtb.ts`
(not `compiler.ts`), `intentSchema.ts` (not `schema.ts`), `riskCheckRegistry.ts` (not `registry.ts`),
`venueSelector.ts`/`selectSwapVenue()` (not `selector.ts`), `*Check.ts` for risk checks,
`signAndExecuteSuiPtb` (not a name implying it's intent-only). Generic `types.ts`/`*.config.ts` stay
only where they're conventional within a feature folder.

---

## 3. The intent schema (`intentSchema.ts`)

The LLM does **not** emit PTB bytes or Move calls — it emits a small, validated structured
**Intent**, and the compiler owns the translation to Sui. This keeps the model's surface narrow
(fewer hallucinated addresses) and the on-chain construction deterministic and testable.

```ts
import { z } from "zod";

export const IntentAction = z.enum(["supply", "withdraw", "swap"]);

/** A human/raw amount pair so the compiler never re-parses a float at the chain boundary. */
const Amount = z.object({
  human: z.string().min(1),          // "100" — as the user said it
  // raw is computed by the executor via kit.parse*, never trusted from the model
});

export const IntentSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("supply"),
    venue: z.enum(["scallop"]),
    asset: z.string().min(1),         // symbol, e.g. "USDC" — resolved to coinType by the compiler
    amount: Amount,
  }),
  z.object({
    action: z.literal("withdraw"),
    venue: z.enum(["scallop"]),
    asset: z.string().min(1),
    amount: Amount.optional(),        // omit = withdraw all
  }),
  z.object({
    action: z.literal("swap"),
    // NO venue — the registry picks the DEX by active network (DeepBook on
    // testnet, Cetus on mainnet). The model must not choose a DEX (§4.5/§4.6).
    fromAsset: z.string().min(1),
    toAsset: z.string().min(1),
    amount: Amount,                   // exact-in
    maxSlippageBps: z.number().int().min(1).max(5000).default(50), // 0.5% default
  }),
]);

export type Intent = z.infer<typeof IntentSchema>;
```

Notes:
- **`supply`/`withdraw` are Scallop, mainnet-only** (Scallop SDK has no testnet, §4.4). The
  `venue: "scallop"` literal stays, but the registry only resolves it when the active network is
  mainnet (§4.6); on testnet the agent doesn't offer these intents.
- **`swap` carries no venue** — the compiler/registry select DeepBook (testnet) or Cetus (mainnet).
- **Symbols, not addresses, from the model.** The compiler resolves `asset`/`fromAsset`/`toAsset`
  symbols to Move `coinType`s from the token registry the Sui executors already load
  (`tokenApi.searchTokens`, see `wallet/sui.ts`). The model never supplies a coinType — eliminating
  a whole class of "agent invented a contract" failures.
- **Amounts are human strings**, converted to raw MIST/atoms by the executor via
  `kit.parseNativeAmount` / `parseUnits` (same as `sendSui`/`sendSuiCoin`). The raw value is never
  taken from the model.
- The schema is **the only thing the agent tool's `inputSchema` exposes** — mirrors
  `mintPaymentIntentInputSchema`'s "schema is the single source of truth, importable without React"
  discipline.

---

## 4. NL→PTB compiler (`compileIntentToPtb.ts`) — a thin layer over the existing port

### 4.1 Contract

```ts
export interface CompileContext {
  wallet: TWallet;                                   // paying wallet (intent.wallet discipline)
  chain: Extract<ChainConfig, { namespace: "sui" }>; // active Sui chain
  tokens: TToken[];                                  // for symbol → coinType resolution
}

export interface CompiledIntent {
  ptbBase64: string;            // the wire/sign source of truth (base64 BCS)
  decoded: SuiDecodedCommand[]; // reuse payloads.ts — drives the preview's "what it does"
  summary: string;              // hand-written plain-language one-liner
  apy?: string;                 // when the venue exposes one (supply)
  expectedOut?: bigint;         // swap quote → highSlippage (§5.2)
}

export async function compileIntentToPtb(
  intent: Intent,
  ctx: CompileContext,
): Promise<CompiledIntent>;
```

The compiler is a **dispatcher over the existing DeFi port + swap layer** (§1.2.1) — not a new
registry:

- `supply` / `withdraw` → `getDefiAdapter("scallop-sui")` then `buildDeposit` / `buildWithdraw`
  → an `UnsignedCall{ kind:"sui-ptb", transactionBlockBase64 }`. (Network gate is free:
  `listDefiAdaptersForChain("sui", chain.network)` returns the Scallop adapter only on mainnet.)
- `swap` → `getSuiSwapRoute(...)` from `services/swap/sui/` → a `sui-ptb` + `expectedOut`/`priceImpact`.
- The compiler resolves symbols → coinTypes (§3), decodes the resulting `ptbBase64` into
  `SuiDecodedCommand[]` (§4.3), and returns. The guardian (§5) runs over the result.

### 4.2 Why no new `IntentProtocolAdapter` (correction)

An earlier draft introduced a parallel `IntentProtocolAdapter` registry. **Dropped** — it duplicated
`services/defi/`'s `DefiProtocolAdapter` (§1.2.1), which already has the `sui-ptb` variant, a
network-gated registry (`listDefiAdaptersForChain`), a boot/flag phasing system (`bootDefi`), and a
working exemplar (`solanaJito.ts`). Reusing it means the Sui venue shows up in the **same**
`defi_list_opportunities` / `defi_list_positions` surfaces as EVM/Solana, with one less registry to
maintain (space-docking: extend the port, don't fork it).

- **`supply`/`withdraw`** dock as `DefiProtocolAdapter` (`ScallopSuiAdapter`, §4.4).
- **`swap`** docks in the swap layer (`services/swap/sui/`, §4.5) — swap was never a
  `DefiProtocolAdapter` (the EVM path uses `services/swap/aggregator.ts`), so the Sui swap router
  mirrors *that*, not the deposit port.

### 4.3 Decoded view

After `tx.build()` we decode the PTB into `SuiDecodedCommand[]` (the same shape
`SuiPtbDecoderInspector` produces for the dApp bridge). The preview renders this so the user sees
"1 MoveCall to scallop::mint, 1 SplitCoins, 1 TransferObjects" — concrete, auditable, not a black box.

### 4.4 Scallop integration — a `DefiProtocolAdapter`, using the official SDK (`services/defi/adapters/scallopSui.ts`)

`ScallopSuiAdapter` **implements the existing `DefiProtocolAdapter`** (§1.2.1), mirroring
`solanaJito.ts` (the jitoSOL liquid-staking adapter): `namespace:"sui"`, `chainId:"mainnet"`,
`kind:"stablecoin_lending"`, `slug:"scallop-sui"`, `staticSafetyScore`, `minDepositRaw`. `buildDeposit`
/ `buildWithdraw` build the PTB with the Scallop SDK and return `{ kind:"sui-ptb", transactionBlockBase64 }`;
`readPosition` reads the user's market-coin balance (the jitoSOL `readPosition` analog). Register it
in `bootDefi()`. Because `chainId:"mainnet"`, `listDefiAdaptersForChain("sui","testnet")` returns it
nowhere — **the network gate is free**, no `networks` field needed.

**Do we need the SDK? Yes.** Scallop ships an official TypeScript SDK —
**`@scallop-io/sui-scallop-sdk`** (npm; repo `scallop-io/sui-scallop-sdk`, docs `docs.scallop.io`).
It is the supported way to build Scallop PTBs: it resolves Scallop's package + market object IDs
**per network from Scallop's own address service** (so we don't hard-code them), and its `*Quick`
builder methods do coin selection / merge / split for us. Hand-rolling Scallop `moveCall`s without
the SDK would mean tracking package upgrades + object IDs ourselves — not worth it for a 1-week build.

The SDK exposes (confirmed from `sui-scallop-sdk/document/builder.md`): `Scallop` (entry →
`client` / `query` / `builder` / `utils`), `ScallopQuery` (read on-chain market/pool data — the
guardian's `staleOracle` read), and a tx builder whose relevant methods are:

| Intent | SDK method | Notes |
|---|---|---|
| `supply` | `depositQuick(amountRaw, coinName)` | e.g. `depositQuick(100_000000, "wusdc")`; mints market coin |
| `withdraw` | `withdrawQuick(amountRaw, coinName)` | full/partial |
| (Phase 2) borrow/repay | `borrowQuick` / `repayQuick` / collateral + obligation methods | not used in Phase 1 |

```ts
// services/defi/adapters/scallopSui.ts — buildDeposit() body sketch
import { Scallop } from "@scallop-io/sui-scallop-sdk";

const scallop = new Scallop({ networkType: chain.network /* "mainnet" */ });
const builder = await scallop.createScallopBuilder();   // wraps a SuiKit client + resolved addresses
const tx = builder.createTxBlock();          // a @mysten/sui Transaction under the hood
tx.setSender(wallet.address);                // REQUIRED for dry-run (§4.7)
await tx.depositQuick(amount, coinName);     // coinName from the §4.1 symbol→Scallop-coin map
const transactionBlockBase64 = await tx.txBlock.build({ client: builder.suiKit.client });
return { kind: "sui-ptb", transactionBlockBase64 };   // the reserved UnsignedCall variant
```

Map the intent `asset` symbol → Scallop `coinName` + `decimals` via the token registry (§4.1);
reject an asset Scallop doesn't list with a typed `DefiError("unsupported_asset")`. The adapter
exposes the resolved **market/pool object id** so `staleOracle` (§5.2) can read its last-update
timestamp.

> **Scallop has no swap.** Confirmed from the SDK builder docs — Scallop is a lending/borrow/stake
> money market; its only swap mention is a comment ("pass it to a dex"). Scallop's website "swap"
> tab is an aggregator UI, **not** an SDK primitive. So the swap leg of any intent uses a separate
> DEX — see §4.5.
>
> **Scallop SDK is mainnet-only.** Confirmed: the SDK ships **no testnet package/address IDs** —
> initializing with `networkType: "testnet"` errors. ⇒ the **`supply`/`withdraw` (Scallop) intents
> are mainnet-only.** On testnet the registry simply does not offer them (§4.6); the testnet-testable
> intent is `swap` via DeepBook (§4.5). This is why the network-capability design (§4.6) matters: the
> feature set follows the active network, and switching to mainnet lights Scallop up with zero code
> change.

### 4.5 Swap layer — `services/swap/sui/` (mirrors `aggregator.ts`) — DeepBook v3 + Cetus + 7K

Swap is **not** a `DefiProtocolAdapter` — the EVM path uses `services/swap/aggregator.ts`, so the Sui
swap router lives in **`services/swap/sui/`** and mirrors that module's `getSwapRoute`/`SwapRoute`
shape (returning a `sui-ptb` + `expectedOut` + `priceImpact`) and **reuses its `getPriceImpactSeverity`
/ `validateSlippage`** helpers so slippage UX matches in-app swap.

Scallop can't swap, and **both Sui DEX aggregators are mainnet-only** (verified: 7K's README states
"this package only supports mainnet"; Cetus Aggregator's only documented endpoint/contracts are
mainnet — `https://api-sui.cetus.zone/router_v3/find_routes`). So the **one swap venue that runs on
testnet** — which is what we need to test now — is **DeepBook v3**, Mysten's own CLOB, whose SDK
**explicitly supports `env: "testnet"`** with pre-registered pools (e.g. `SUI_DBUSDC`).

Three per-venue routers under `services/swap/sui/venues/`, picked by the selector (§4.6.1):

**(a) `venues/deepbookSwap.ts` — `@mysten/deepbook-v3` — testnet + mainnet (the baseline).**
Verified API (`docs.sui.io/standards/deepbookv3-sdk`): a `DeepBookClient` built from a
`SuiClient(testnet|mainnet)` + address + `env`; swap commands `swapExactBaseForQuote` /
`swapExactQuoteForBase` taking `SwapParams { poolKey, amount, deepAmount, minOut }`; and a **quote**
read (`getQuoteQuantityOut` / `getBaseQuantityOut`) that returns the expected output — exactly the
number `highSlippage` needs. `minOut` is set from `maxSlippageBps`.

```ts
import { DeepBookClient } from "@mysten/deepbook-v3";
const db = new DeepBookClient({ client: suiClient, address: wallet.address, env: chain.network });
const { quantityOut } = await db.getQuoteQuantityOut(poolKey, amountIn); // verify exact return shape
db.swapExactBaseForQuote({ poolKey, amount: amountIn, deepAmount: 0, minOut })(tx); // PTB command
```

**(b) `venues/cetusSwap.ts` — `@cetusprotocol/aggregator-sdk` — mainnet-only.**
Verified API (repo `CetusProtocol/aggregator`): `new AggregatorClient({...})`, then
`findRouters({ from, target, amount: BN, byAmountIn })` (quote → guardian) and
`fastRouterSwap({ routers, txb, slippage })` / `routerSwap({ routers, txb, inputCoin, slippage })`
(`slippage` is a fraction, e.g. `0.01` = 1%; convert from `maxSlippageBps`).

**(c) `venues/sevenkSwap.ts` — `@7kprotocol/sdk-ts` — mainnet-only** (drop-in alternative; Meta-Aggregator
quote + tx build, same quote+build shape).

All three feed an `expectedOut` to `highSlippage` (§5.2) and expose the pool id to `staleOracle`. The
compiler does **not** let the model choose the DEX — `swap` intents carry no venue (§3); the selector
(§4.6.1) picks per network.

### 4.6 Network gating — free for supply, a small selector for swap

The active network comes from `ChainConfig` (`getActiveSuiChain().network`), never hard-coded.

- **`supply`/`withdraw` (Scallop) — gating is free.** `listDefiAdaptersForChain("sui", chain.network)`
  (existing registry, §1.2.1) returns `ScallopSuiAdapter` only when `chain.network === "mainnet"`
  (its `chainId`). On testnet it resolves nothing → the compiler returns a typed
  `not_on_this_network` and the agent says yield is a mainnet feature. **No `networks` field, no new
  registry** — this is the same per-deployment gating Aave-Base-vs-Aave-Ethereum already uses.
- **`swap` — the `services/swap/sui/venueSelector.ts`** picks a venue per network (§4.6.1).

Resulting venue matrix — **no code changes between networks, only which venues resolve:**

| Action | Sui **testnet** (where you're testing now) | Sui **mainnet** (production flip) |
|---|---|---|
| `swap` | **DeepBook v3** (`SUI_DBUSDC` etc.) — real quote + slippage | **Cetus** → **7K** → **DeepBook** (priority-ordered, §4.6.1) |
| `supply` / `withdraw` | *not offered* (Scallop is mainnet-only) — agent says "available on Sui mainnet" | **Scallop** (`ScallopSuiAdapter`, `depositQuick`/`withdrawQuick`) |

Production-ready by construction: flipping the user's active chain to mainnet is the *only* action
needed to unlock Scallop + Cetus + 7K. **Config, not constants**: `services/swap/sui/*.config.ts`
(pool keys, aggregator endpoints) + the Scallop SDK's own per-network `addressId`.

#### 4.6.1 Swap venue selection — DeepBook · Cetus · 7K coexisting

On mainnet more than one swap venue is eligible (Cetus, 7K, DeepBook). `venueSelector.ts` picks with a
**priority-ordered, quote-aware resolver** — the same pattern this repo already ships for payments
(`306aa03 feat(x402): priority-ordered health-aware settlement rail chain`): try venues in priority
order, drop those that error / return no route, and let the **best expected-out win**.

```ts
// services/swap/sui/venueSelector.ts
const SWAP_PRIORITY: Record<SuiNetwork, string[]> = {
  mainnet: ["cetus", "7k", "deepbook"],   // aggregators first (best route), CLOB fallback
  testnet: ["deepbook"],                   // only DeepBook runs on testnet
  devnet:  ["deepbook"],
};
// selectSwapVenue(): walk SWAP_PRIORITY for the active network, quote each registered venue,
// choose the best expected-out (ties → earlier priority). suiSwapRouter.getSuiSwapRoute() then
// builds that venue's sui-ptb; its quote feeds `highSlippage`. None answer → invalid_input ("no_swap_route").
```

So all venues **work alongside each other**: Scallop owns `supply`/`withdraw` via the DeFi port;
DeepBook/Cetus/7K compete for `swap` via the swap selector — both network-gated. Adding or reordering
a swap venue is a one-line edit to `SWAP_PRIORITY`; adding a lending venue is one `registerDefiAdapter`
call — no change to the compiler, guardian, tools, or UI (space-docking, Appendix B).

### 4.7 PTB assembly invariants

- **`tx.setSender(wallet.address)` before `build()`** — `dryRunTransactionBlock` (the guardian's read
  primitive) needs a sender, and a missing/incorrect sender is itself a `sender.mismatch` warning the
  decoder already models.
- **Gas:** let the SDK/Sui pick the gas coin (no manual `setGasPayment` in Phase 1). A
  `gas.high-budget` decoder warning is surfaced as an `info` risk row.
- **`ptbBase64` is the source of truth** that gets stored and signed — never re-build at execute time
  (re-build could pick different coins/gas than what the user previewed). The TTL (§8.1) bounds
  staleness; the execute-time re-guard (§5.3) catches drift.
- **Atomic swap→supply compose (the "why Sui" wow) — scope note.** `DefiProtocolAdapter.buildDeposit`
  and `getSuiSwapRoute` each return a *finished* `sui-ptb`, so composing both legs into **one** atomic
  PTB needs them to append into a *shared* `Transaction` instead. Phase 1 ships **single-action**
  intents (one finished `sui-ptb` each) — which satisfies every must-have. The atomic compose is a
  documented **stretch** requiring an optional `buildInto(tx)` capability on the Scallop adapter +
  Sui swap router (Sui-PTB-native; the EVM/Solana ports never needed it because they don't compose
  atomically). Until then, a "swap then supply" goal is two sequential previewed intents.

---

## 5. The guardian (`guardian/`)

The guardian is the **make-or-break must-have**: the sub-track explicitly rejects "a swap chatbot
with no guardian." We ship **three** risk classes (≥2 required).

### 5.1 `RiskCheck` (docked port)

```ts
export type Severity = "info" | "warn" | "block";

export interface RiskFlag {
  code: "slippage.high" | "oracle.stale" | "concentration.high";
  severity: Severity;
  /** Hand-written, plain-language. Never a raw RPC/SDK string (CLAUDE.md). */
  title: string;     // "High slippage"
  detail: string;    // "This swap could lose ~3.2% to price impact."
}

export interface RiskCheck {
  readonly code: RiskFlag["code"];
  /** Pure-ish: inspect the compiled PTB + dry-run + on-chain reads. */
  run(args: {
    intent: Intent;
    compiled: CompiledIntent;
    dryRun: SuiSimulationSummary | null;   // from simulateSuiTransaction
    ctx: CompileContext;
  }): Promise<RiskFlag | null>;            // null = check passed
}
```

`runGuardian(...)` runs every registered check, collects non-null flags. New risk classes dock by
registering a `RiskCheck` — **no branching anywhere else changes** (space-docking). The guardian's
on-chain reads go through `simulateSuiTransaction` (`dryRunTransactionBlock`) plus targeted object
reads (`client.getObject` on the pool/oracle) — the exact state the PTB will touch.

### 5.2 The three checks

| Check | Reads | Flags when | Plain-language copy |
|---|---|---|---|
| **`highSlippage`** | the swap router's `expectedOut`/`priceImpact` (§4.5) vs min-out | reuse `getPriceImpactSeverity` from `services/swap/aggregator.ts` (≥2% `warn`, ≥10% `danger`→`block`), tightened by `maxSlippageBps` | "This swap could lose ~X% to price impact. Consider a smaller size." |
| **`staleOracle`** | Scallop market/pool object: last-update timestamp & the price feed it reads | `now − lastUpdate > THRESHOLD` (e.g. 60s for price, longer for pool accrual) | "This pool's price hasn't updated in N minutes — supplying now may use a stale rate." |
| **`overConcentration`** | wallet balances (kit `getAllBalances`) + the post-intent allocation | this action pushes one venue/asset over a % ceiling (e.g. >70% into a single venue) | "After this, ~Y% of your funds sit in one place. That concentrates your risk." |

**How `highSlippage` gets its number (the source is the venue quote, never the LLM).** Slippage =
the gap between what you *expect* to receive and what you *actually* receive. Two parts:

- **Price impact** — your own order moves the price because the pool has finite depth. Big order vs a
  shallow pool ⇒ you receive less. This is deterministic from the quote.
- **Slippage tolerance** — the floor you accept (`maxSlippageBps`), enforced on-chain as `minOut`.

The check computes it from the swap router's pre-build quote (§4.5):
`getQuoteQuantityOut(poolKey, amountIn)` (DeepBook) or `findRouters(...).priceImpact` (Cetus/7K).
`expectedOut` = quoted output; `effectivePrice = amountIn / expectedOut`;
`priceImpact ≈ (referencePrice − effectivePrice) / referencePrice`. That % goes through
`getPriceImpactSeverity` (band table below). The PTB's on-chain guard is
`minOut = expectedOut × (1 − maxSlippageBps/10000)` — if execution would land below it, the tx
reverts and the dry-run shows it, which the guardian also flags as `block`. **Worked example:** swap
5 SUI, quote says `expectedOut = 9.2 USDC`, "ideal" ≈ 9.5 ⇒ impact ≈ 3.2% ⇒ `warn` ("could lose
~3.2% to price impact"); a "swap 90% now" order blows past 10% ⇒ `block`. Price impact (order size
vs pool) is distinct from `staleOracle` (data freshness) — hence two separate checks.

**Math discipline (OpenZeppelin audit guidance).** Slippage/concentration ratios are fixed-point.
We follow OpenZeppelin's Sui audit findings — *Sui Bugs and a Rounding Backfire* and *Critical Bug
Patterns in Sui Move* (`openzeppelin.com/news`) — and round **conservatively toward flagging risk**
(round price-impact *up*, round min-out *down*) so a borderline-unsafe intent is never rounded into
looking safe. Where we compute ratios off-chain we mirror the conventions of `openzeppelin_fp_math`
(9-decimal signed/unsigned fixed point) and `openzeppelin_math` (overflow-safe, explicit rounding)
so the optional on-chain receipt module (§10) and the off-chain guardian agree on arithmetic.

**Complementary (not duplicated): the existing backend strategy-policy guards.** EVM DeFi writes run
`resolveAndGuard` (`agent-executors/defi/writes.ts`) — tier-ceiling, protocol whitelist, APY-drift
±5%, strategy-paused kill-switch — sourced from `/strategies/*`. Those are **policy** checks (does
this fit the user's saved risk envelope?); our guardian is **transaction-level on-chain risk** (what
will this exact PTB do?). They layer cleanly: if the paying wallet has a `UserStrategy`, the compiler
MAY also run the policy guards (e.g. surface APY-drift / `safety_score` as extra `info`/`warn`
rows). Phase 1 ships the on-chain guardian as the must-have; policy-guard layering is optional and
additive.

### 5.3 Severity → behaviour

The preview is a `read`, so severity drives **two** gates, not a card button:

- `block` — the worst flag the guardian returned for this intent. `defi_intent_preview`'s result
  carries `blocked: true`; the agent prompt (§6.4) instructs the model **not** to call
  `defi_intent_execute` for a blocked intent and to explain why / offer to adjust.
  **Belt-and-braces:** `defi_intent_execute` **re-runs the guardian at execute time** and refuses
  (typed friendly error) if the intent is now blocked — so a blocked intent can never be signed even
  if the model misbehaves. This is the spec's "a flagged-risky intent can be declined."
- `warn` — rendered prominently in `IntentPreviewCard`; the agent surfaces it and proceeds only on
  the user's eyes-open say-so (which still goes through the write approval sheet).
- `info` — muted annotation row.

For the demo (strategy Day 6): **one safe intent executed** (approval sheet → digest) and **one
risky intent blocked** (guardian `block` → agent declines, never reaches the sheet).

---

## 6. Agent tools & routing (three-place wiring)

### 6.1 Server `ToolMeta` (`agent-api/src/tools/defi/`)

Add a new barrel `agent-api/src/tools/defi/intent.ts`, composed into `DEFI_TOOLS` via
`composeAgentTools('defi', …)` (same as `propose.ts`/`simulate.ts`). Names are FROZEN once shipped
(the stub-vs-real flip discipline in `propose.ts`):

```ts
// defi_intent_preview — onchain dry-run + guardian. READ (NOT simulate — see §1.4).
{
  name: 'defi_intent_preview',
  category: 'utility',
  executor: 'mobile',          // onchain (compiles a PTB + dry-runs) → mobile
  capability: 'read',          // never signs; runs silently then renders IntentPreviewCard
  description:
    'Compile a plain-language DeFi goal on Sui into a Programmable Transaction Block, dry-run it, ' +
    'and run the guardian (slippage / stale-pool / over-concentration). Returns an opaque ' +
    'intent_id, a plain-language summary, the decoded PTB commands, and risk_flags. ALWAYS call ' +
    'this before defi_intent_execute. If any risk_flag has severity "block", DO NOT execute — ' +
    'explain the risk and offer to adjust.',
  inputSchema: { /* the §3 Intent, expressed as JSON-Schema: action enum, venue, asset(s),
                    amount.human, maxSlippageBps */ },
}

// defi_intent_execute — sign-and-execute the previously compiled PTB. WRITE → approval sheet.
{
  name: 'defi_intent_execute',
  category: 'blockchain_write',
  executor: 'mobile',
  capability: 'write',         // standard mobile approval sheet = the EXPLICIT confirmation
  description:
    'Sign and execute a PTB previously built by defi_intent_preview, identified by intent_id. ' +
    'The user confirms on the mobile approval sheet before broadcast. The resulting Sui digest is ' +
    'base58 and is returned in data.digest, not tx_hash.',
  inputSchema: {
    type: 'object',
    properties: { intent_id: { type: 'string', description: 'From defi_intent_preview.' } },
    required: ['intent_id'],
    additionalProperties: false,
  },
}
```

### 6.2 Server `human_summary` (`agent-api/src/tools/human-summary.ts`)

`buildHumanSummary` covers every `write` tool; add a `defi_intent_execute` case. It runs from the
LLM `input` at call time (the server has the `intent_id`, not the compiled APY), so keep it generic
and approval-safe; the rich post-compile copy comes from the mobile result (§7):

```ts
case 'defi_intent_execute':
  return 'Execute your prepared Sui transaction';   // approval-sheet-safe, no raw data
```

(`defi_intent_preview` is a `read` → no summary needed, but the registry-parity test wants a label:
`case 'defi_intent_preview': return 'Prepare a Sui transaction from your goal';`.)

### 6.3 Manifest sync

No manifest edit: the `defi_` prefix already routes to the **DeFi specialist** in
`agent-api/src/agents/manifests/agentManifests.json`, and `pnpm manifests:sync` propagates it to the
mobile `services/agent-executors/agentManifests.json`. (Intent compilation *is* DeFi-shaped.)

### 6.4 Mobile executors (`services/agent-executors/defi/intentExecutors.ts`)

Two executors. **They live in the `defi/` bucket, not `wallet/`** — `index.ts` composes them with
`composeAgentExecutors("defi", { …DEFI_TOOL_EXECUTORS })`, which **asserts every tool resolves to the
DeFi agent** (the `defi_` prefix) and fails loudly at module load if dropped in the wrong folder.
Export a `DEFI_INTENT_EXECUTORS` map from `defi/intentExecutors.ts` and spread it into `defi/index.ts`'s
`DEFI_EXECUTORS`. (They route to Sui by importing the `services/chains/sui/intent/` compiler +
guardian — exactly how the EVM DeFi executors route through their adapters.)

| Tool | Capability | Input | Output `data` | Card |
|---|---|---|---|---|
| `defi_intent_preview` | `read` | `Intent` (§3) | `{ intent_id, human_summary, apy?, decoded, risk_flags, blocked }` | `IntentPreviewCard` |
| `defi_intent_execute` | `write` | `{ intent_id }` | `{ digest, network }` (+ `tx_confirmed`, `transaction_id`) | `SuiPendingTxCard` |

| Tool | Capability | Input | Output `data` | Card |
|---|---|---|---|---|
| `defi_intent_preview` | `read` | `Intent` (§3) | `{ intent_id, human_summary, apy?, decoded, risk_flags, blocked }` | `IntentPreviewCard` |
| `defi_intent_execute` | `write` | `{ intent_id }` | `{ digest, network }` (+ `tx_confirmed`, `transaction_id`) | `SuiPendingTxCard` |

- **Digest discipline:** Sui digests are base58, not `0x`-hex. Follow `sendSui` exactly — never
  populate the hex-typed `tx_hash`; the digest lives in `data.digest` and `SuiPendingTxCard` links
  it via SuiVision (see the comment block in `wallet/sui.ts`).
- **Intent-wallet binding:** the executor signs with the **paying wallet from context**, never a
  home-screen `activeWallet` fallback (`feedback_dapp_bridge_isolation`,
  `feedback_payment_jwt_binding`).
- **Re-guard at execute (§5.3):** `defi_intent_execute` re-runs `runGuardian` on the cached PTB and
  refuses a now-`block`ed intent with a typed friendly error — the signing gate is never reachable
  for a blocked intent.

### 6.5 Canonical result shapes (`agent-api/src/tools/result-shapes.ts`)

`result-shapes.ts` is normative as of protocol v1.1 — add the two `data` shapes so the server's
expected LLM-input and the mobile output never drift (all bigints are **base-10 strings**, §8.5):

```ts
/** `defi_intent_preview` — compiled plan + guardian verdict (read; never signs). */
export type DefiIntentPreviewResult = {
  intent_id: string;                 // opaque; pass to defi_intent_execute
  human_summary: string;             // plain-language, hand-built (no raw data)
  apy?: string;                      // decimal string, when the venue exposes one
  decoded: Array<{ kind: string; /* …SuiDecodedCommand projection… */ }>;
  risk_flags: Array<{
    code: 'slippage.high' | 'oracle.stale' | 'concentration.high';
    severity: 'info' | 'warn' | 'block';
    title: string;
    detail: string;
  }>;
  blocked: boolean;                  // true ⇒ agent must NOT call defi_intent_execute
};

/** `defi_intent_execute` — terminal. digest is base58, NOT tx_hash. */
export type DefiIntentExecuteResult = {
  digest: string;
  network: string;                   // "testnet" | "mainnet" | "devnet"
};
```

### 6.6 DeFi-specialist prompt additions (`agent-api/src/agents/defi/prompts.ts`)

The model needs explicit operating rules for the intent loop (mirrors how the EVM DeFi prompt
constrains `defi_deposit`). Add:

1. **Always preview before executing.** Call `defi_intent_preview` first; read `risk_flags`.
2. **Respect `blocked`.** If `blocked === true` (or any flag `severity === "block"`), **do not** call
   `defi_intent_execute`. Explain the risk in plain language and offer a safer alternative (smaller
   size, different venue).
3. **Carry the `intent_id` verbatim** from the preview result into `defi_intent_execute`. Never
   fabricate one.
4. **Never invent `coin_type`s, package IDs, or amounts.** Express the goal as the `Intent` schema in
   symbols + human amounts; the compiler resolves the rest.
5. **One goal → one preview → (one) execute.** Don't batch-execute without a fresh preview if the
   user changed the parameters.

---

## 7. Structured UI — every relevant tool gets a card

The agent journey for the Intent Engine touches more than the two new tools — a user typically
*browses* yields, *checks* balances, then *states a goal*. Every tool in that journey must render a
purpose-built card (not a raw JSON blob) for the UX to feel like a product. Below is the **full
catalog**: what already exists and is reused, what is new, and what gets a light extension.

### 7.1 Tool → card catalog

| Tool | Cap. | Card | Status | Renders |
|---|---|---|---|---|
| `get_wallet_sui_balance` / `get_sui_balance` | read | `BalancesCard` | **reuse** | native SUI balance (already wired, §registry) |
| `get_wallet_sui_coins` | read | `BalancesCard` | **reuse** | Coin<T> list + balances |
| `defi_get_config` | read | `StrategyConfigCard` | **new (small)** | user's saved risk tier / whitelist / liquidity pref — grounds the goal |
| `defi_list_opportunities` | read | `OpportunityListCard` | **extend** | Sui/Scallop yield rows (APY, tier, liquidity) — "where can I earn?" |
| `defi_list_positions` | read | `PositionListCard` | **reuse** | open positions (after a supply, the user sees it here) |
| **`defi_intent_preview`** | read | **`IntentPreviewCard`** | **new (hero)** | plain-language summary + decoded PTB + guardian risk rows |
| **`defi_intent_execute`** | write | `SuiPendingTxCard` | **reuse** | approval gate → Confirmed/Failed receipt + SuiVision link |

Registry wiring (`components/home/TakumiAgent/StructuredUI/registry.ts`):

```ts
// new
defi_intent_preview: IntentPreviewCard,
defi_get_config:     StrategyConfigCard,
// reuse / extend
defi_intent_execute:      SuiPendingTxCard,
defi_list_opportunities:  OpportunityListCard,   // already mapped — extend payload for Sui
defi_list_positions:      PositionListCard,       // already mapped
// (balance reads already map to BalancesCard, incl. the Sui ones)
```

### 7.2 `IntentPreviewCard` (new — the hero surface)

A **read-result** card (no live `input-available` confirm gate — preview is `read`, §1.4). It
renders the `defi_intent_preview` output and is purely presentational (computes no chain state,
branches on no namespace — Appendix B). Top to bottom:

1. **Plain-language summary** — `data.human_summary` ("Supply 100 USDC to Scallop, earning ~5.2%
   APY") with the `apy` highlighted when present.
2. **What it does on-chain** — `data.decoded: SuiDecodedCommand[]` as a compact readable list
   ("Move call · `scallop::mint`", "Split coins", "Transfer to you"). Auditable, not a black box.
   Reuses the same decode shape the dApp-bridge sheet shows.
3. **Guardian verdict** — a header chip: green "Looks safe" when no flags, amber "Heads up" for
   `warn`, red "Not recommended" when `blocked`.
4. **Risk rows** — each `RiskFlag` as a coloured row by `severity` (`block` red, `warn` amber, `info`
   grey) with `title` + `detail`. All copy hand-written (§9); never a raw RPC/SDK string.
5. **Footer affordance** — uses the card contract's **`onUserPrompt`** hook (the same one
   `OpportunityListCard`'s "Let Takumi pick for you" uses), *not* `addToolResult` (this is a `read`
   card with no result gate):
   - not blocked → a "Go ahead" chip calls `onUserPrompt("Yes, execute that — intent " + intent_id)`,
     which posts a fresh user turn nudging the model to call `defi_intent_execute(intent_id)`. The
     **approval sheet on that write tool is the real signing gate.**
   - blocked → no execute chip; instead "Try a safer size" calls `onUserPrompt("Can you make that
     safer?")`. `onUserPrompt` is `undefined` in historical mode, so frozen cards stay inert.

Historical mode renders the frozen summary + verdict (mirror `SuiPendingTxCard`'s
`mode === "historical"`). Styling matches `SuiPendingTxCard`/`RebalancePreviewCard` (NativeWind,
brand colours, `lucide-react-native` icons) so it sits in the conversation natively.

### 7.3 `OpportunityListCard` extension (Sui/Scallop yields)

The card already renders DeFi opportunity rows for the EVM agent. Extend its payload/rendering so a
**Sui/Scallop** opportunity row (namespace-tagged, APY, tier, liquidity profile) renders through the
**same** card — no Sui-specific card, no namespace branch in the component (the row carries a
`namespace`/`chain_label` like the balance payloads do). This lets "show me where I can earn on Sui"
return a tappable list *before* the user commits to an intent — a real UX lift over a text dump.
Phase 1 may source these rows statically (a pinned Scallop-market list) rather than a live backend
`OpportunityCache`; the card doesn't care.

### 7.4 `StrategyConfigCard` (new — small)

Renders `defi_get_config` (risk tier, whitelist, liquidity preference) as a compact summary so the
user can see the safety envelope the guardian is reasoning against. Trivial card; `null` config
renders a friendly "No strategy set yet — I'll use safe defaults." Optional for the submission if
time-pressed (the guardian works without it), but it closes the UX loop on *why* an intent was
flagged.

### 7.5 Copy discipline for all cards

Every string in every card is hand-written or built from values we control (the APY number, the
slippage %, the minutes-stale) — never `err.message`, an RPC body, or an SDK string (§9, CLAUDE.md
user-facing-errors). Bahasa/English copy is part of Day 5 hardening (strategy).

---

## 8. Execution path

### 8.1 Intent store (`intentStore.ts`)

Opaque `intentId` → `{ ptbBase64, summary, flags, expiresAt }`, persisted in MMKV with a short TTL
(e.g. 5 min — long enough to confirm, short enough that pool state can't drift far). Mirrors the
`mintPaymentIntent` opaque-id hand-off and the dApp bridge's `pendingIntents`. `defi_intent_execute`
rejects a missing/expired id with a typed, friendly error and asks the user to re-preview (pool
state may have moved → re-run the guardian, never execute a stale PTB).

### 8.2 Sign-and-execute — the `sui-ptb` submitter (kit method, docked)

This is the submission gap from §1.2.1: the existing agent executors are **EVM-only** (`writes.ts`
throws on any `UnsignedCall.kind !== "evm-call"`), so a built `sui-ptb` can't be submitted today. We
add **one** optional `WalletKitAdapter` method, implemented only by `SuiWalletKit` (presence-checked,
left `undefined` on EVM/Solana — exactly like `sendAnchorInstruction` is Solana-only). It is the
**general `sui-ptb` submitter** — it consumes the `transactionBlockBase64` an `UnsignedCall` carries,
so the same method serves any future Sui `DefiProtocolAdapter`, not just the intent engine:

```ts
/**
 * Signs and executes a pre-built PTB (base64 BCS — the `sui-ptb` UnsignedCall payload)
 * with the wallet's Sui signer. Sui-only; other kits leave undefined. Consumers
 * presence-check. Returns the base58 digest.
 */
signAndExecuteSuiPtb?(args: {
  wallet: TWallet;
  chain: ChainConfig;
  ptbBase64: string;       // === UnsignedCall.transactionBlockBase64 for kind "sui-ptb"
}): Promise<string>;
```

Internally it uses the same signer materialisation as `sendSui`/`sendSuiCoin` and
`client.signAndExecuteTransaction` (`SuiSignTxMode = "sign-and-execute"`, from `payloads.ts`). No new
signing primitive — the PTB is just the generalisation of the single-transfer the kit already signs.
(A natural follow-up, out of scope here: teach `agent-executors/defi/writes.ts` to route its
`sui-ptb` branch through this same method so `defi_deposit` works on Sui too — but Phase 1 ships the
guarded intent flow, not the bare deposit tool.)

### 8.3 History

`recordTransferHistory` is reused (already called by `sendSui`), tagging `type` appropriately
(e.g. `"DEFI_SUPPLY"` / `"SWAP"`) so the intent shows up in the activity feed.

### 8.4 Executor implementation contract (`defi/intentExecutors.ts`)

Both executors implement `MobileToolExecutor = (input, context) => Promise<ToolResult>` and **never
throw** — they wrap in `safeExecute` and raise typed `ExecutorError(ExecutorErrorCode.*, "<label>")`
(from `services/agent-executors/types.ts`), exactly like `sendSui`. `ExecutorContext` carries
`{ wallet, account, blockchains, activeChainId }`; the Sui chain comes from `getActiveSuiChain()`
and the token list from the same cache path `getSuiWalletTokens` uses (`tokenApi.searchTokens` +
per-blockchain MMKV cache). Skeleton:

```ts
// services/agent-executors/defi/intentExecutors.ts
const SUI_NS = "sui" as const;

export const defiIntentPreview: MobileToolExecutor = (input, context) =>
  safeExecute(async () => {
    if (context.wallet?.namespace !== SUI_NS)
      throw new ExecutorError(ExecutorErrorCode.UnsupportedChain, "wallet_not_sui");

    const intent = parseIntent(input);                 // zod (§3); InvalidInput on failure
    const chain = getActiveSuiChain();                 // reuse from wallet/sui.ts
    const tokens = await loadSuiTokens(context, chain); // same path as getSuiWalletTokens
    const client = new SuiJsonRpcClient({ url: chain.rpcUrl, network: chain.network });

    const compiled = await compileIntentToPtb(intent, { wallet: context.wallet, chain, tokens });
    const dryRun = await simulateSuiTransaction(client, {
      txBase64: compiled.ptbBase64, sender: context.wallet.address,
    });
    const flags = await runGuardian({ intent, compiled, dryRun, ctx: { /* … */ } });
    const blocked = flags.some((f) => f.severity === "block")
      || (dryRun?.status !== "success");               // a tx that would revert is "blocked"

    const intent_id = intentStore.put({ ptbBase64: compiled.ptbBase64, intent, flags }); // TTL §8.1
    const data = toJsonSafe({                          // §8.5 — bigints → strings
      intent_id, human_summary: compiled.summary, apy: compiled.apy,
      decoded: compiled.decoded, risk_flags: flags, blocked,
    });
    return { status: "success", data, display: data };  // card reads output.data
  });

export const defiIntentExecute: MobileToolExecutor = (input, context) =>
  safeExecute(async () => {
    if (context.wallet?.namespace !== SUI_NS)
      throw new ExecutorError(ExecutorErrorCode.UnsupportedChain, "wallet_not_sui");
    const intentId = requireString(input, "intent_id");
    const entry = intentStore.get(intentId);            // null ⇒ expired/unknown
    if (!entry) throw new ExecutorError(ExecutorErrorCode.InvalidInput, "intent_expired");

    // Re-guard (§5.3): refuse a now-blocked intent before signing.
    const chain = getActiveSuiChain();
    const client = new SuiJsonRpcClient({ url: chain.rpcUrl, network: chain.network });
    const dryRun = await simulateSuiTransaction(client, {
      txBase64: entry.ptbBase64, sender: context.wallet.address,
    });
    if (dryRun?.status !== "success")
      throw new ExecutorError(ExecutorErrorCode.InvalidInput, "intent_no_longer_safe");

    const kit = getSuiKit();                            // walletKitRegistry, presence-checked
    const digest = await kit.signAndExecuteSuiPtb!({  // §8.2 docked method
      wallet: context.wallet, chain, ptbBase64: entry.ptbBase64,
    });
    const transaction_id = await recordTransferHistory({ /* …§8.3… */ });
    return {
      status: "success", tx_confirmed: true, transaction_id,
      data: { digest, network: chain.network },         // base58 digest in data.digest (NOT tx_hash)
    };
  });

export const DEFI_INTENT_EXECUTORS = {
  defi_intent_preview: defiIntentPreview,
  defi_intent_execute: defiIntentExecute,
};
```

`getActiveSuiChain`, `getSuiKit`, `requireString` are imported/duplicated from the existing
`wallet/sui.ts` patterns (extract to a small shared `sui/executorContext.ts` if duplication grates).

### 8.5 Wire serialization (protocol §8 — bigints are strings)

The executor's `data` is forwarded **verbatim into LLM context and the card**. Per agent-protocol
§8, every value that can exceed `Number.MAX_SAFE_INTEGER` must be a **base-10 string**, decoded with
`BigInt(str)` never `Number(str)`. `SuiSimulationSummary` (and any amount the guardian computes) hold
native `bigint`s — a `toJsonSafe()` pass must stringify them before return. `SuiDecodedCommand` is
already JSON-safe (counts/strings). Risk-flag numbers we surface (slippage %, minutes-stale, %
concentration) are small — render them as already-formatted display strings in `detail`, never raw
ratios. This mirrors `toAgentSlice` in `wallet/sui.ts`.

---

## 9. Error & copy discipline (hard rule)

End users never see raw error text — `err.message`, RPC/SDK bodies, status lines, dry-run failure
strings (CLAUDE.md user-facing-errors; `feedback_user_facing_errors`). Applied here:

- **Guardian `RiskFlag.title`/`detail` and `IntentPreviewCard` copy are hand-written**, parameterised
  only by computed numbers we control (the slippage %, the minutes-stale, the concentration %).
- **Compiler / SDK failures** (Scallop SDK throw, dry-run RPC error) map to fixed friendly copy
  ("We couldn't build that transaction safely. Please try again."), with the raw detail behind
  `if (__DEV__) console.warn(...)`. Executors throw typed `ExecutorError(code, "<short_label>")` —
  never embedding an external body in the message (mirrors `wallet/sui.ts`).
- **Curated signals OK, passthrough not** — detecting a known Scallop/SDK condition and swapping in
  our own copy is fine; surfacing the SDK's string is not.

---

## 10. Do we need a new contract? (intent-receipt Move module — OPTIONAL)

**Short answer: no new contract is required to ship Phase 1.** The meaningful Sui integration is
PTBs + guardian calling **existing third-party packages** (Scallop, the DEX) — the submission
checklist asks for a Package ID only "*if* deployed on-chain," and Phase 1 is eligible on PTBs alone
(strategy "Hard constraints" §2). No custom Move package is on the critical path.

### 10.1 State of the contracts repo (`/home/cstralpt/takumipay/contract`)

| Dir | Stack | State |
|---|---|---|
| `contract/evm/` | Foundry/Solidity (`TakumiPay.sol`, `TakumiPayV2.sol`) | populated |
| `contract/solana/` | Anchor | populated |
| **`contract/sui/`** | Move | **empty scaffold** — `sources/` + `tests/` exist, **no `Move.toml`, no `.move`** |

So there is a Sui home waiting, but nothing in it. Phase 1 leaves it empty (or adds the optional
module below); **Phase 2's Agent Authority module is what populates `contract/sui/` for real.**

### 10.2 Optional intent-receipt module (only if Day 7 buffer allows)

A thin Move package in `contract/sui/` gives a **Package ID** + on-chain auditability without
changing the Phase 1 story:

- `contract/sui/Move.toml` + `contract/sui/sources/intent_receipt.move`. A `record_intent(...)` entry
  that logs a hash of the executed intent + digest as an event (or owned object). The compiler
  appends it as the **final `MoveCall` in the same PTB**, so it stays one atomic transaction; the
  mobile side needs only the published Package ID pinned in `scallop.config.ts`'s sibling
  `intentReceipt.config.ts`.
- Built on **OpenZeppelin Contracts for Sui** (installed via MVR, `docs.openzeppelin.com/contracts-sui`):
  - `openzeppelin_access` — two-step transfer for the module's admin/upgrade capability (the
    capability-handling pattern OZ's audit findings repeatedly flag when done wrong).
  - `openzeppelin_math` / `openzeppelin_fp_math` — if the receipt stores any computed ratio, use the
    audited overflow-safe / explicit-rounding primitives rather than hand-rolled arithmetic.
- Deploy: `sui client publish` to testnet → record the Package ID for the submission checklist.
- Security learning inputs: OZ's *Critical Bug Patterns in Sui Move* and the Move-over CTF
  (`moveover.openzeppelin.com`) — review before writing any Move; **defer the module entirely if it
  risks the submission.**

This module is the natural seam toward Phase 2's **Agent Authority** object — but Phase 1 ships
**without** any authority/delegation object (non-goal §0).

---

## 11. Networks & environments (testnet now, mainnet-ready by design)

Goal: **develop and demo on Sui testnet today** (the dev wallet has testnet SUI + testnet USDC),
while being **production-ready so a user just switches the active chain to Sui mainnet** and the full
feature set lights up — no rebuild. The active network is read from `ChainConfig`
(`getActiveSuiChain().network`); the protocol registry (§4.6) is the single place that maps
network → available venues.

**Hard reality from official docs (drives everything here):**

| Protocol | Package | Testnet? | Used for |
|---|---|---|---|
| **DeepBook v3** | `@mysten/deepbook-v3` | ✅ **yes** (`env: "testnet"`, pools like `SUI_DBUSDC`) | `swap` on testnet **and** mainnet |
| Scallop | `@scallop-io/sui-scallop-sdk` | ❌ **mainnet-only** (no testnet address IDs) | `supply`/`withdraw` — **mainnet only** |
| Cetus Aggregator | `@cetusprotocol/aggregator-sdk` | ❌ **mainnet-only** | `swap` best-route — **mainnet upgrade** |
| 7K | `@7kprotocol/sdk-ts` | ❌ **mainnet-only** (README) | swap alt — mainnet only |

**What we test on testnet now (fully real, no mainnet funds needed):**
- The hero pipeline end-to-end: NL → `Intent` → PTB → guardian → approval sheet → **testnet digest**.
- Intent: **`swap` SUI↔USDC on DeepBook v3 testnet** using the dev wallet's testnet SUI / USDC.
- **All three guardian classes are real on testnet:** `highSlippage` (DeepBook quote vs min-out),
  `concentration` (wallet balances — network-independent), `staleOracle` (DeepBook pool object's
  last-update / a thin-liquidity pool genuinely triggers it).

**What flipping to mainnet unlocks (zero code change — registry + config only):**
- `supply`/`withdraw` on **Scallop** (the "earn yield on idle USDC" hero).
- `swap` gains the **Cetus** and **7K** aggregators (priority-ordered, best-quote wins, §4.6.1);
  DeepBook stays as the fallback in the chain.

**Submission framing:** ship + demo on **testnet** (swap + full guardian) to satisfy every must-have;
state clearly that supply/yield is **mainnet-ready and shown on mainnet**. If the team wants the
yield hero *in* the demo, run that one intent on mainnet with a small real amount — which also
unlocks the **100%-upfront prize** (strategy §"Prize mechanics"). Decision in §14.

- **Config (network-keyed, "config not constants"):** `deepbook.config.ts` (pool keys per network),
  `scallop.config.ts` (`addressId`, mainnet), `cetus.config.ts` + `sevenk.config.ts` (aggregator
  endpoints, mainnet).
- **Explorer:** SuiVision URLs already handled by `SuiWalletKit.buildTxExplorerUrl` and the
  card-side `buildSuiExplorerUrl` (testnet subdomain).

---

## 12. Milestones (maps to strategy Day 0–7)

| Day | Deliverable | Done-when |
|---|---|---|
| **0–1** (spike) | Three-place wiring for **one** hard-coded intent — **`swap` SUI↔USDC on DeepBook v3 testnet** (Scallop is mainnet-only, §4.4): `ToolMeta` (`agent-api`) → `manifests:sync` → mobile executors `defi_intent_preview`+`defi_intent_execute`; **one** guardian check (`highSlippage` from the DeepBook quote); `IntentPreviewCard` renders; write approval sheet → sign-and-execute → **testnet digest**. | NL/intent → PTB → 1 warning → approval sheet → on-chain testnet digest end-to-end. |
| **2–3** | `IntentSchema` (supply/withdraw/swap); `compileIntentToPtb` dispatching to the **existing DeFi port** (`ScallopSuiAdapter` in `services/defi/`, registered in `bootDefi`) + the **Sui swap module** (`services/swap/sui/` — DeepBook testnet+mainnet, Cetus/7K mainnet, selector §4.6.1); decoded view → `IntentPreviewCard`; `OpportunityListCard` Sui rows + `StrategyConfigCard`. | swap compiles on testnet; supply + Cetus/7K compile on mainnet — same code, switched by network. |
| **4** | Guardian: all three `RiskCheck`s reading live state; severity drives agent behaviour + execute re-guard (§5.3); **block/decline path**. | Risky intent is flagged in plain language and is un-signable (block); safe intent reaches the approval sheet. |
| **5** | UX hardening: all cards polished (preview/risk rows/opportunity/config), Bahasa/English copy, no-raw-error sweep, edge cases (expired intent, empty balance, RPC down). | `pnpm lint`, `pnpm check:syntax`, `pnpm check:chains`, `pnpm test` green. |
| **6** | ≤5-min demo: state a goal → preview card with decoded PTB → guardian catches a real risk → approve a safe one at the sheet, **decline/blocked on a risky one** → testnet digest. Logo, public repo, README "why Sui." | Recorded. |
| **7** | Buffer: verify testnet deploy (mainnet if possible); optional intent-receipt Move module + Package ID; submit. | Submitted. |

---

## 13. Testing

- **vitest** (add new files to the explicit `include` list in `vitest.config.ts`):
  - `intentSchema.test.ts` — intent validation: rejects unknown venue/action, coerces amounts, defaults
    slippage.
  - `compileIntentToPtb.test.ts` — supply routes to `getDefiAdapter("scallop-sui")`, swap routes to the Sui
    swap module; symbol→coinType resolution; on testnet a `supply` intent yields
    `not_on_this_network` (because `listDefiAdaptersForChain("sui","testnet")` is empty).
  - `scallopSui.test.ts` (under `services/defi/adapters/`) — `buildDeposit`/`buildWithdraw` return a
    `sui-ptb` UnsignedCall; mirrors the `solanaJito` adapter tests.
  - `swap/sui/venueSelector.test.ts` — priority order per network; best-expected-out wins; venues that
    error are skipped; testnet resolves only DeepBook; `no_swap_route` when none answer (§4.6.1).
  - `guardian/*.test.ts` — each `RiskCheck` against fixture dry-run summaries: high-slippage fires
    above threshold and not below (reusing `getPriceImpactSeverity`); stale-oracle fires past the
    window; concentration fires over the ceiling; **rounding is conservative** (borderline → flag).
  - `intentStore.test.ts` — TTL expiry; missing-id rejection.
- **`check:chains`** must stay green — verify no new namespace branch leaked into
  `components/`/`hooks/`/`app/` (the preview card stays presentational; all dispatch is in
  `services/`).
- **Manual testnet pass** (with the dev wallet's testnet SUI + testnet USDC) before recording:
  a real **DeepBook v3 SUI↔USDC swap on testnet** through the full pipeline (preview → guardian →
  approval sheet → testnet digest), plus a **declined/blocked** risky intent (e.g. high-slippage on a
  large size, or over-concentration). Optionally repeat the **Scallop supply** path on **mainnet**
  with a small real amount to validate the production flip.
- **Guardian uses fixtures, not live RPC** in tests — `simulateSuiTransaction` is injected a stub
  `SuiSimulationClient`; DeepBook/Scallop/Cetus/7K quote calls are stubbed in unit tests, exercised
  for real only in the manual pass.
- **agent-api (jest):** the registry-parity test requires **every** tool name in `TOOL_REGISTRY` to
  map to a non-empty `buildHumanSummary` label — add the `defi_intent_*` cases (§6.2) or the parity
  test fails. Run `pnpm test` in `agent-api`. Also confirm `pnpm manifests:sync` leaves the mobile
  `agentManifests.json` unchanged (the `defi_` prefix already exists → diff should be empty).

### 13.1 Manual chat-UI test script (also the live-demo prompts)

Run these in the Takumi Agent chat once the three-place wiring (§6) + `IntentPreviewCard` are in
place. Same prompts double as the demo (§0.2). Bilingual on purpose — Bahasa is part of the pitch.

**Pre-flight:** active wallet = **Sui**, network = **testnet**; testnet SUI + USDC funded; DeepBook
testnet `poolKey` set (`deepbook.config.ts`); `defi_intent_preview`/`defi_intent_execute` registered
on both sides + `IntentPreviewCard` in `StructuredUI/registry.ts` (else the loop hangs, §1.4).

| # | Prompt (EN / ID) | Tool → card | Expected |
|---|---|---|---|
| 1 Happy path | `swap 5 SUI to USDC, keep it safe` / `tukar 5 SUI ke USDC, yang aman ya` | `defi_intent_preview` → `IntentPreviewCard` | summary + decoded PTB (`deepbook::swap`) + green "Looks safe" |
| 2 Confirm | `go ahead` / `lanjut` | `defi_intent_execute` (write) → approval sheet → `SuiPendingTxCard` | sheet → sign → **testnet digest** (SuiVision link) |
| 3 Block path | `ape 90% of my SUI into USDC now` / `tukar 90% SUI ku ke USDC sekarang` | `defi_intent_preview` → `IntentPreviewCard` | red row (slippage/concentration), verdict "Not recommended", **no approval sheet** |
| 4 Browse | `what tokens do I hold on Sui?` / `aku punya token apa di Sui?` | `get_wallet_sui_coins` → `BalancesCard` | balances list (existing tool) |
| 5 Network gate (negative) | `earn yield on my idle USDC` (still on **testnet**) | preview rejects | agent: "yield is on Sui mainnet" + offers a swap |
| 6 Mainnet flip | switch to **mainnet**, then `earn yield on my idle USDC` / `kembangkan USDC ku biar dapat yield` | `defi_intent_preview` → Scallop → `IntentPreviewCard` | supply preview + APY → approve → mainnet digest (small amount) |

Make `highSlippage`/`overConcentration` fire honestly in step 3 with a large size; `staleOracle` is
the easiest to fire on a thinly-updated testnet pool.

**If a card doesn't render / the agent won't call the tool:**

| Symptom | Check |
|---|---|
| Agent replies text only, no tool call | ToolMeta present in agent-api? `manifests:sync` run? DeFi prompt (§6.6) tells it to always preview first? |
| Long "thinking" then timeout | `IntentPreviewCard` not registered in `registry.ts` (the §1.4 hang) — or the `read` executor didn't return |
| "Switch to your Sui wallet" | active wallet namespace ≠ `sui` |
| Supply rejected on testnet | correct — Scallop is mainnet-only (§4.6) |
| Digest blank / dead link | don't populate `tx_hash` (hex); base58 digest lives in `data.digest` (§6.4) |
| Model won't execute after "go ahead" | use the `onUserPrompt` "Go ahead" chip on the card (§7.2) — it injects `intent_id` into the next turn |

---

## 14. Open questions / risks

1. **RESOLVED — venue/network mapping (§4.5/§4.6).** Verified from official docs: Scallop, Cetus,
   and 7K are **mainnet-only**; **DeepBook v3 supports testnet**. So testnet demos `swap` via
   DeepBook (full guardian), mainnet adds Scallop supply + Cetus/7K. Open sub-decision: whether to
   include the **Scallop supply** intent *in the recorded demo* (requires running that one on
   mainnet with a small real amount — also unlocks the 100%-upfront prize) or keep the recording
   testnet-only and present supply as the mainnet flip. *Team call, Day 5–6.*
2. **DeepBook testnet pool + coins.** Confirm the exact testnet `poolKey` (e.g. `SUI_DBUSDC`) and
   that the dev wallet's testnet USDC matches that pool's quote coin type. *Verify Day 0–1.*
3. **Stale-oracle threshold.** What counts as "stale" depends on the venue's update cadence; start
   with 60s for price / longer for accrual, tune against observed testnet (DeepBook) + mainnet
   (Scallop) behaviour.
4. **Slippage quote source.** `dryRunTransactionBlock` gives effects but not a protocol "expected
   out"; `highSlippage` reads the venue quote (DeepBook `getQuoteQuantityOut`, Cetus/7K route
   `findRouters`) alongside the dry-run. Confirm exact return field names against each SDK.
5. **Mainnet for 100% prize.** Flip is config-only (§4.6); do it once Phase 1 is demo-ready, with
   small real amounts — never at the cost of the submission.

---

## 15. Edge cases & failure modes (each maps to a typed `ExecutorError` + friendly copy)

| Situation | Where caught | Code / outcome | User sees |
|---|---|---|---|
| Active wallet/chain is not Sui | both executors | `unsupported_chain` | "Switch to your Sui wallet to do that." |
| LLM intent fails zod | `parseIntent` | `invalid_input` | "I couldn't understand that goal — can you rephrase?" |
| Asset symbol not listed by the venue | compiler | `invalid_input` | "I can't do that on \<venue\> yet." |
| Insufficient balance for the amount | compiler / dry-run revert | `insufficient_funds` / `blocked:true` | "You don't have enough \<asset\> for that." |
| Dry-run says the tx would revert | preview (`blocked:true`) | guardian `block` | "This would fail on-chain, so I won't prepare it to sign." |
| RPC / Scallop SDK throws | `safeExecute` | `network_error` (raw in `__DEV__` only) | "We couldn't reach Sui right now. Please try again." |
| `intent_id` unknown/expired (TTL) | execute | `invalid_input` ("intent_expired") | "That preview expired — let me re-check and show you again." |
| Intent became unsafe between preview & execute | execute re-guard | `invalid_input` ("intent_no_longer_safe") | "Conditions changed — re-previewing for safety." |
| Watch-only wallet (`account === null`) | execute | `wallet_type_cannot_execute` | "This wallet can't sign transactions." |
| User rejects the approval sheet | mobile approval pipeline | standard reject | (no error — declined) |

All raw detail (SDK/RPC strings) is logged behind `if (__DEV__)` only and **never** placed on
`ToolResult.error` — that string re-enters LLM context next turn (CLAUDE.md, `ExecutorErrorCode`
doc).

## 16. Security & invariants checklist (must hold)

- **SI-1 Intent-wallet binding.** Compile, dry-run, re-guard, and sign all use
  `context.wallet` — never a home-screen `activeWallet`/`activeChain` fallback
  (`feedback_dapp_bridge_isolation`).
- **SI-2 Model never supplies chain-native strings.** No coinTypes, package IDs, object IDs, or raw
  amounts from the LLM — only the symbol/human-amount `Intent`; the compiler resolves the rest (§3).
- **SI-3 No raw errors to users or LLM.** §9 + §15. `ToolResult.error` is a curated code only.
- **SI-4 Sign only what was previewed.** The stored `ptbBase64` is the exact bytes signed; never
  rebuilt at execute (§4.7). TTL + execute-re-guard bound staleness.
- **SI-5 Un-bypassable block.** A `block` flag (or a reverting dry-run) makes the intent un-signable
  at the executor level, independent of model behaviour (§5.3, §6.6).
- **SI-6 Conservative guardian math.** Round toward flagging risk; mirror `openzeppelin_fp_math`
  conventions; never round a borderline-unsafe intent into "safe" (§5.2, OZ rounding-backfire).
- **SI-7 Chain-agnostic shared code.** All dispatch via registries under `services/`; nothing under
  `components/`/`hooks/`/`app/` branches on namespace. `pnpm check:chains` green (Appendix B).

## 17. Dependencies & config to add

- **`@mysten/deepbook-v3`** — swap on **testnet + mainnet** (the only testnet-capable venue);
  `getQuoteQuantityOut`/`getBaseQuantityOut` (→ `highSlippage`) + `swapExactBaseForQuote`/
  `swapExactQuoteForBase` (§4.5). The testnet baseline.
- **`@scallop-io/sui-scallop-sdk`** — `supply`/`withdraw` + `ScallopQuery` market reads for the
  guardian (`docs.scallop.io`). **Mainnet-only** (no testnet addresses).
- **`@cetusprotocol/aggregator-sdk`** — mainnet best-route swap (`findRouters` + `fastRouterSwap`/
  `routerSwap`). **Mainnet-only.** First in the swap priority chain (§4.6.1).
- **`@7kprotocol/sdk-ts`** — mainnet swap alternative in the priority chain. **Mainnet-only**
  (README states mainnet support only).
- **Docking, not a new registry (§1.2.1):** Scallop docks as a **`DefiProtocolAdapter`**
  (`services/defi/adapters/scallopSui.ts`, registered in `bootDefi()`); DeepBook/Cetus/7K live in the
  **Sui swap module** (`services/swap/sui/`, mirroring `aggregator.ts`). Network gating is free for
  supply (`listDefiAdaptersForChain` by `chainId`) and a small selector for swap (§4.6.1).
- **`@mysten/sui`** — already a dependency (`Transaction`, `SuiJsonRpcClient`,
  `dryRunTransactionBlock`, `signAndExecuteTransaction`).
- **`zod`** — already a dependency (intent schema; justified over the usual lightweight
  `requireString` assertions because the `Intent` is a nested discriminated union, §3).
- **Config files (network-keyed, "config not constants"):** `services/swap/sui/*.config.ts`
  (`deepbook` pool keys per network, `cetus`/`7k` aggregator endpoints, mainnet); Scallop addresses
  come from the SDK's own per-network `addressId` (no config file); and (if §10 lands)
  `intentReceipt.config.ts` (Package ID).
- **`vitest.config.ts`** — add the new `*.test.ts` files to the explicit `include` list (§13).
- **No new env vars** for Phase 1 (RPC comes from the active `ChainConfig.rpcUrl`).

---

## Appendix A — Reused symbols (grounded references)

| Symbol | File |
|---|---|
| **`DefiProtocolAdapter`, `UnsignedCall` (incl. reserved `sui-ptb`), `BuildDepositArgs`** | `services/defi/types.ts` |
| **`registerDefiAdapter`/`getDefiAdapter`/`listDefiAdaptersForChain`** (network-gated registry) | `services/defi/registry.ts` |
| **`bootDefi()` + `FEATURE_DEFI_*` phasing** (where `ScallopSuiAdapter` registers) | `services/defi/bootstrap.ts` |
| **`SolanaJitoAdapter`** — the jitoSOL "supply to earn" exemplar to mirror for Scallop | `services/defi/adapters/solanaJito.ts` |
| **`getSwapRoute`/`SwapRoute`, `getPriceImpactSeverity`, `validateSlippage`** (swap layer to mirror) | `services/swap/aggregator.ts` |
| EVM-only submission limit (`UnsignedCall.kind !== "evm-call"` → throw) — the gap §8.2 fills | `services/agent-executors/defi/writes.ts` |
| `resolveAndGuard` (tier/whitelist/APY-drift policy guards — complementary, §5.2) | `services/agent-executors/defi/writes.ts` |
| `SuiDecodedCommand`, `SuiSimulationSummary`, `SuiSimulationWarning`, `SuiSignTxMode` | `services/chains/sui/payloads.ts` |
| `simulateSuiTransaction` | `services/chains/sui/simulation.ts` |
| `SUI_EXECUTORS`, `getActiveSuiChain`, `getSuiKit`, digest-not-tx_hash discipline | `services/agent-executors/wallet/sui.ts` |
| `walletKitRegistry` (presence-check `.has(ns)`) | `services/walletKit/registry.ts` |
| `WalletKitAdapter` (optional-method docking) | `services/walletKit/types.ts` |
| `toolComponents`, `BALANCE_TOOL_NAMES` | `components/home/TakumiAgent/StructuredUI/registry.ts` |
| `SuiPendingTxCard`, `buildSuiExplorerUrl` | `components/home/TakumiAgent/StructuredUI/cards/SuiPendingTxCard.tsx` |
| `mintPaymentIntentToolSpec` (opaque-intentId hand-off precedent) | `components/home/TakumiAgent/mintPaymentIntentTool.ts` |
| `resolveAgentForTool`, `defi_` prefix routing | `services/agent-executors/agentManifest.ts`, `agentManifests.json` |
| `OpportunityListCard`, `PositionListCard`, `RebalancePreviewCard` (reuse/extend) | `components/home/TakumiAgent/StructuredUI/cards/` |
| `ToolMeta`, capability/executor classification, `composeAgentTools` | `agent-api/src/tools/internal/types.ts`, `agent-api/src/tools/defi/*` |
| `buildHumanSummary` (server-side approval-sheet copy) | `agent-api/src/tools/human-summary.ts` |
| `simulate`→`read` precedent + 5-min hang note | `agent-api/src/tools/defi/simulate.ts` (`defi_simulate_deposit`) |
| `OpportunityCache` / `safety_score` / `/strategies/*` (future Scallop feed) | `api/src/strategies` |
| manifest sync (`pnpm manifests:sync`) | `agent-api/scripts/sync-agent-manifests.mjs` |

## Appendix B — Space-docking checklist (must hold at merge)

- [ ] Scallop docks as a **`DefiProtocolAdapter`** (registered via `registerDefiAdapter` in
      `bootDefi`), **not** a new registry; swap venues live in `services/swap/sui/` behind the
      selector; `RiskCheck` has its own registry. Consumers dispatch via these — never
      `if (venue === …)` / `if (code === …)`.
- [ ] The new intent layer lives under `services/chains/sui/intent/` (compiler + guardian + store);
      the Scallop adapter under `services/defi/adapters/`; swap under `services/swap/sui/`; the agent
      executors under `services/agent-executors/defi/` (the `defi_` bucket) — none under
      `components/`/`hooks/`/`app/`.
- [ ] `IntentPreviewCard` is presentational — it reads `risk_flags`/`decoded` from the tool result,
      computes no on-chain state, branches on no namespace.
- [ ] `signAndExecuteSuiPtb` is an **optional** `WalletKitAdapter` method, Sui-only, presence-checked.
- [ ] `pnpm check:chains` green.

## Appendix C — External doc citations

- **Sui — Programmable Transaction Blocks** (atomic multi-command txs; the compile target): `docs.sui.io`
  (Concepts → Transactions → Programmable Transaction Blocks; Building PTBs).
- **`@mysten/sui`** `Transaction` builder, `dryRunTransactionBlock`, `signAndExecuteTransaction`: `docs.sui.io` SDK reference.
- **DeepBook v3** (swap on **testnet + mainnet** — the only testnet-capable venue): SDK
  **`@mysten/deepbook-v3`** (`docs.sui.io/standards/deepbookv3-sdk`, `…/swaps`; repo
  `github.com/MystenLabs/deepbookv3`). `DeepBookClient` with `env: "testnet" | "mainnet"`;
  `swapExactBaseForQuote`/`swapExactQuoteForBase` (`SwapParams { poolKey, amount, deepAmount, minOut }`);
  quote via `getQuoteQuantityOut`/`getBaseQuantityOut`; pre-registered pools (e.g. `SUI_DBUSDC`).
- **Scallop** (`supply`/`withdraw`; **mainnet-only** — SDK ships no testnet address IDs). SDK:
  **`@scallop-io/sui-scallop-sdk`** (npm; repo `github.com/scallop-io/sui-scallop-sdk`,
  `document/builder.md`: `depositQuick`/`withdrawQuick`/`borrowQuick`); `ScallopQuery` for market
  reads. Docs `docs.scallop.io`. **No native swap** (builder doc: "pass it to a dex").
- **Cetus Aggregator** (mainnet swap best-route; **mainnet-only**): **`@cetusprotocol/aggregator-sdk`**
  (`github.com/CetusProtocol/aggregator`; `cetus-1.gitbook.io/cetus-developer-docs`). `AggregatorClient`,
  `findRouters({ from, target, amount, byAmountIn })`, `fastRouterSwap`/`routerSwap` (`slippage` as a
  fraction). Endpoint `api-sui.cetus.zone/router_v3/find_routes`.
- **7K** (mainnet swap alt; **mainnet-only** per README): **`@7kprotocol/sdk-ts`**
  (`github.com/7k-ag/7k-sdk-ts`) — Meta-Aggregator quote + tx build.
- **OpenZeppelin Contracts for Sui** (MVR-distributed audited Move libs): `docs.openzeppelin.com/contracts-sui`
  — `openzeppelin_math` (overflow-safe integer math, explicit rounding), `openzeppelin_fp_math`
  (9-decimal fixed point for prices/fees/rates), `openzeppelin_access` (two-step capability transfer).
  Repo: `github.com/OpenZeppelin/contracts-sui`.
- **OpenZeppelin audit findings** (guardian math & Move discipline): *Critical Bug Patterns in Sui
  Move* and *Sui Bugs and a Rounding Backfire* — `openzeppelin.com/news`.
- **Move-over CTF** (Move security training before writing any Move): `moveover.openzeppelin.com`.
- **Sui docs root:** `docs.sui.io`.

## Appendix D — Plain-language guardian copy (Bahasa/English) + example intent turns

Plain language is a scored must-have *and* our differentiator. Copy is hand-written (§9), parameterised
only by numbers we control. Keep both locales in one map so the card renders the user's locale.

| Flag | English | Bahasa Indonesia |
|---|---|---|
| `slippage.high` (warn) | "This swap could lose ~{pct}% to price impact. Try a smaller size." | "Swap ini bisa rugi ~{pct}% karena dampak harga. Coba jumlah lebih kecil." |
| `slippage.high` (block) | "Price impact is ~{pct}% — too high to do safely. I won't prepare this." | "Dampak harga ~{pct}% — terlalu tinggi untuk aman. Saya tidak akan menyiapkannya." |
| `oracle.stale` | "This pool's price hasn't updated in {n} min — the rate may be stale." | "Harga pool ini belum update {n} menit — kursnya mungkin basi." |
| `concentration.high` | "After this, ~{pct}% of your funds sit in one place — that concentrates risk." | "Setelah ini, ~{pct}% dana kamu di satu tempat — itu memusatkan risiko." |
| verdict: safe | "Looks safe." | "Aman." |
| verdict: blocked | "Not recommended — I won't prepare this to sign." | "Tidak disarankan — saya tidak akan menyiapkannya untuk ditandatangani." |
| expired intent | "That preview expired — let me re-check and show you again." | "Preview-nya kedaluwarsa — saya cek ulang dan tampilkan lagi." |

> Locale comes from the app's existing i18n setting; the agent narrates in the user's language too.
> Never interpolate raw RPC/SDK strings into these — only `{pct}`/`{n}` computed values (§9, §15).

**Example NL → `Intent` mappings (for the agent prompt §6.6 + compiler tests §13):**

| User says | `Intent` the model emits |
|---|---|
| "swap 5 SUI to USDC, keep it safe" | `{ action:"swap", fromAsset:"SUI", toAsset:"USDC", amount:{human:"5"}, maxSlippageBps:50 }` |
| "move 100 USDC into Scallop to earn yield" (mainnet) | `{ action:"supply", venue:"scallop", asset:"USDC", amount:{human:"100"} }` |
| "take all my USDC out of Scallop" (mainnet) | `{ action:"withdraw", venue:"scallop", asset:"USDC" }` (amount omitted = full) |
| "earn yield on my idle USDC" (on testnet) | model recognises supply is **mainnet-only** (§4.6) → explains, offers a testnet swap instead |
| "ape 90% of my SUI into USDC right now" | `{ action:"swap", fromAsset:"SUI", toAsset:"USDC", amount:{human:"<90%>"} }` → guardian likely **blocks** (slippage/concentration) — the demo's decline path |
