# Sui Overflow 2026 — TakumiPay Strategy & Build Plan

> Working doc. Source of truth for what we submit, which track, and how we build it.
> Hackathon facts pulled from the official participant handbook + track problem statements
> (Agentic Web, DeFi & Payments, Walrus, DeepBook Predict).

## TL;DR — DECIDED

- **Main track:** **Agentic Web.**
- **Phase 1 (now, the submission):** **Intent Engine (sub-track 3).** Plain-language financial goal
  → compiled into a Sui **PTB** → a **guardian** surfaces risks in plain language → user **explicitly
  confirms** → execute. Human-in-the-loop on every action.
- **Phase 2 (stretch, only if Phase 1 is fully done):** **Autonomous Risk Guardian (sub-track 1).**
  Same guardian + PTB machinery, but the confirm step is swapped for **autonomous execution** gated
  by a Move **Agent Authority** object — hero use case: **liquidation protection** on Scallop.
- **The through-line is the guardian.** Phase 1 ships it human-confirmed; Phase 2 lets it act on its
  own within an un-bypassable on-chain leash. We build the hard part (risk engine + PTB compiler)
  once and reuse it.
- **Why Sui (Phase 1):** PTBs are the compile target — a multi-step goal becomes one **atomic,
  auditable, previewable** transaction, and the guardian inspects the exact object/pool state the
  PTB will touch *before* signing. Not a bolted-on rail.

### Why this sequencing
1. **Phase 1 is the most buildable in the time we have.** It leans almost entirely on assets we
   already own (the Takumi agent + our risk-preview/structured-card UI). The only net-new piece is
   the NL→PTB compiler + the guardian's risk checks — no custom Move module required to ship.
2. **Phase 2 is the ambitious, higher-ceiling play** (thinner field, higher stakes) but it depends
   on a Move Agent Authority object + Scallop position integration. We only commit to it once Phase 1
   is demo-ready, so we never risk the submission on the hard part.
3. **One project, two sub-tracks of coverage.** Sub-tracks aren't judged separately — we compete in
   the overall Agentic Web track, so satisfying sub-track 3's must-haves now and growing into
   sub-track 1's is strictly additive.

---

## Hard constraints (these shape everything)

1. **Timeline.** Submission deadline is **June 21, 2026** (Pacific). Phase 1 must be ~80% reuse of
   existing code + a thin Sui-specific new layer (NL→PTB + guardian).
2. **Eligibility / deployment.** Must be **deployed to Sui testnet/mainnet** by shortlisting/Demo
   Day, with **substantial new functionality built during the hackathon period**. A custom **Move
   package (→ Package ID)** is *not strictly required for Phase 1* — the checklist asks for a Package
   ID only "if deployed on-chain," and Phase 1's meaningful Sui integration rests on **PTBs +
   guardian**. (Phase 2's Agent Authority object is where the custom Move package lands.)
3. **"Why Sui specifically" is a disqualifying bar.** Agentic Web: *"Sui as a meaningful part of the
   AI stack — not a payment rail bolted on at the end… Generic LLM wrappers that happen to hold SUI
   will not place."* Our "why Sui" is PTBs as the agent's compile target (Phase 1) + a Move authority
   object enforcing safe autonomy (Phase 2). Note our app is deliberately **chain-agnostic**
   (registry, `pnpm check:chains`) — for this submission we lean **into** Sui PTBs/objects.

### Judging weights (core tracks)

| Criterion | Weight |
|---|---|
| **Real-World Application** | **50%** |
| Product & UX | 20% |
| Technical Implementation (meaningful Sui integration) | 20% |
| Presentation & Vision | 10% |

### Prize / payout mechanics

- Core tracks (Agentic Web, DeFi & Payments): **$30k / $15k / $10k / $7.5k**.
- **Split payout:** 50% on announcement, 50% after mainnet deploy. **Deploy to mainnet before winners
  are announced (Aug 27) → 100% upfront.**
- Demo Day: **Agentic Web = July 20.** Shortlist announced July 8.

---

## The thesis (why this wins Agentic Web)

**DeFi is too complex and too dangerous for normal users.** They either avoid it entirely, or they
ape in and get rekt — overpay slippage, supply into a stale pool, over-concentrate, get liquidated.
The knowledge gap is the product gap.

**An intent engine with a guardian closes it.** You say what you want in plain language; the agent
compiles it into a Sui PTB; and *before you sign*, a guardian inspects the exact transaction and the
on-chain state it touches, and warns you in plain language. You approve with eyes open. (Phase 1.)

**And because Sui lets you give an agent a bounded on-chain authority, the same guardian can
eventually protect you autonomously** — watch your position 24/7 and act before disaster, without
ever being able to run off with your money. (Phase 2.)

> **One-liner:** *Tell it what you want; it builds the transaction, warns you before you sign, and
> — when you're ready — guards your money on its own, within limits the chain itself enforces.*

### The persona

> *"I want to do more on-chain — earn yield, manage a position — but I don't speak DeFi. I never know
> if I'm about to overpay on slippage or ape into a dead pool, and one bad transaction can wreck me.
> I want to just say what I want, have the transaction built for me, and be warned in plain language
> before I sign. And once I trust it, I want it to watch my back automatically — pull me out before a
> liquidation while I sleep — without ever being able to drain my wallet."*

The first sentence is **Phase 1 (Intent Engine)**. The last is **Phase 2 (Autonomous Risk Guardian)**.

---

## Why Agentic Web — and the sub-track path

- **Phase 1 → Sub-track 3 (Intent Engine).** Its must-haves map directly onto assets we already own:
  - *text → PTB → execution* — Takumi agent (`useChat`, tool calls) + our Sui PTB write path.
  - *human-readable PTB preview* — our structured cards (`SuiPendingTxCard`, `RebalancePreviewCard`).
  - *guardian catching ≥2 risk classes* — our disciplined risk-preview / RiskBanner pattern.
  - *explicit confirmation* — our sign-and-execute approval flow.
  - The sub-track explicitly rejects "a swap chatbot with no guardian," so the **guardian is the bar
    we must clearly clear** — that's where we invest.
- **Phase 2 → Sub-track 1 (Autonomous Risk Guardian).** Live price feed (oracle health factor),
  visible AI risk score (liquidation risk), ≥1 autonomous on-chain action (repay/de-risk), human
  override (revoke the authority object). Our liquidation-protection action hits all four — no
  Deepbook dependency.
- **Avoid Walrus / DeepBook Predict** — specialized net-new builds that don't reuse our stack.
- **Don't center x402/EVM settlement** — it's the "bolted-on rail" judges penalize. The story is the
  PTB-compiling agent + guardian.

---

## Existing plumbing we reuse (Phase 1 is mostly wiring)

- **PTB types + sign-and-execute** — `services/chains/sui/payloads.ts` (`SuiSignTxMode = "sign-and-execute"`, batch-native PTBs).
- **Agent write path** — `services/agent-executors/{writes,simulate,submitTx}.ts` (agent → registry → Sui execution, tested).
- **Preview / guardian / confirm surfaces** (already built — these *are* the "human-readable PTB preview"):
  - `components/home/TakumiAgent/StructuredUI/cards/SuiPendingTxCard.tsx`
  - `…/RebalancePreviewCard.tsx`, `…/SpendingApprovalCard.tsx`, `…/SwapQuoteCard.tsx`
- **Copyable agent-tool pattern** — `components/home/TakumiAgent/mintPaymentIntentTool.ts` + `useMintPaymentIntentTool.ts`.
- **Risk/error discipline** — our "friendly copy in UI, raw detail in `__DEV__` only" rule is exactly
  the plain-language guardian UX the sub-track wants. Free points.

So the **agent → tool → preview card → sign-and-execute** pipeline already exists. The genuinely new
work for Phase 1 is **(a) the NL→PTB compiler** and **(b) the guardian's risk checks**.

---

## The pipeline (what we build)

```
PHASE 1 — Intent Engine (human-confirmed)

Takumi Agent (NL: "earn yield on my idle USDC, safely")
        │  new: compileToPtb() — intent (zod) → Sui PTB
        ▼
PTB Builder (@mysten/sui)  ──►  GUARDIAN  ── inspects PTB + on-chain state
        │                          ├─ high slippage?
        │                          ├─ stale pool / stale oracle?
        │                          └─ over-concentration?
        ▼                          │ plain-language risks
Human-readable PTB preview (SuiPendingTxCard / RebalancePreviewCard)
        │  EXPLICIT confirm
        ▼
sign-and-execute (existing write path)  ──►  testnet digest

PHASE 2 — Autonomous Risk Guardian (adds, doesn't replace)

   Same GUARDIAN risk engine + PTB builder
        + continuous health-factor monitor (Scallop position)
        + Agent Authority object (Move): budget · position-scope · expiry · revocable
        → confirm step becomes AUTONOMOUS execution within the leash
        → hero action: repay/de-risk before liquidation; can't exfiltrate
```

---

## Day 0–1 spike (de-risk Phase 1's new part first)

Stand up the thinnest end-to-end Intent Engine slice:

1. `compileToPtb` agent tool (copy `mintPaymentIntentTool.ts`) — one hard-coded intent ("supply N
   USDC to Scallop") → a real Sui PTB.
2. A **single guardian check** (e.g. stale-pool / stale-oracle) that reads on-chain state and returns
   a plain-language warning.
3. Render the PTB + warning in `SuiPendingTxCard`; explicit confirm → sign-and-execute → **testnet digest**.

**Prove:** NL/intent → PTB → guardian warning → confirm → on-chain execution. This front-loads the
only new risk (the compiler + guardian reading real chain state). Everything after is more intents
and more risk checks.

---

## Phase 1 plan — Intent Engine (sub-track 3)  ← THE SUBMISSION

**Demo Day:** July 20. **Prize:** $30k / $15k / $10k / $7.5k.

**Hero:** the user states a financial goal in plain language; the agent compiles it into a Sui PTB;
the guardian catches real risks and explains them in plain language; the user confirms with eyes
open and it executes atomically on Sui.

### Add / extend for this track (the hackathon work)
1. **NL→PTB compiler** — zod intent schema + `compileToPtb` agent tool mapping goals (earn yield,
   swap, supply, move funds) to Sui PTBs against real protocols (Scallop, a DEX). *This is the
   "text → PTB → execution" must-have.*
2. **Guardian — ≥2 risk classes** (target 3): **high slippage** on a swap leg, **stale pool/oracle**
   (last-update timestamp), **over-concentration** (too much % into one venue/asset). Reads on-chain
   state the PTB will touch. *This is the must-have that separates us from a "swap chatbot."*
3. **Human-readable PTB preview** — plain-language summary of what the PTB does + the guardian's
   risk flags, rendered in `SuiPendingTxCard` / `RebalancePreviewCard`.
4. **Explicit confirmation** — user must confirm after seeing risks; a flagged-risky intent can be
   declined. Reuse the sign-and-execute approval flow.

**"Why Sui":** PTBs are the compile target — a multi-step goal becomes one atomic, auditable
transaction the user previews before signing, and the guardian inspects the exact object/pool state
that transaction will touch. No bolted-on rail.

| Day | Work | Owner |
|---|---|---|
| **0–1** | Spike (above): one intent → PTB → one guardian check → confirm → testnet digest. | App |
| **2–3** | **NL→PTB compiler:** zod intent schema + `compileToPtb` for 2–3 real intents against real Sui protocols. Human-readable preview wired into `SuiPendingTxCard`. | App |
| **4** | **Guardian:** implement ≥2 (aim 3) risk classes reading on-chain state; plain-language warnings; explicit confirm gate; decline path. | App |
| **5** | Harden UX: Bahasa/English copy, polished preview + risk cards, no-raw-error discipline, edge cases. | App |
| **6** | Record ≤5-min demo: state a goal → PTB preview → guardian catches a real risk in plain language → confirm a safe one, decline a risky one → testnet digest. Logo, public repo, README "why Sui." | Team |
| **7** | Buffer. Verify testnet deploy (mainnet if possible → 100% prize upfront). Submit. | All |

**Phase 1 deliverables:** `compileToPtb` agent tool + intent schema, guardian (≥2 risk classes),
human-readable PTB preview, explicit-confirm flow with a declined-risky-intent demo, Sui testnet
deployment, demo video.

> **Optional Move nicety for Phase 1:** a light on-chain **intent-receipt/log** Move module that
> records each executed intent (gives a Package ID + auditability). Skip if time-pressed — Phase 1 is
> eligible on PTBs alone.

---

## Phase 2 (stretch) — Autonomous Risk Guardian (sub-track 1)

**Only start once Phase 1 is demo-ready.** Reuses the guardian risk engine + PTB builder; adds
autonomy + an on-chain leash.

**Hero:** the agent watches the health factor of the user's leveraged **Scallop** position 24/7 and,
as it nears liquidation, **autonomously** repays / tops up collateral / unwinds — gated by a Move
**Agent Authority** object scoped to that position, so it can protect the position but **never
withdraw funds externally**. Revocable on-chain.

### Add / extend (on top of Phase 1)
1. **Agent Authority Move module** — user-owned object: budget ceiling, **position-only scope**,
   expiry, on-chain activity log, revocation. Enforces the leash on-chain (external withdrawals
   forbidden at the Move level). *The net-new Move package → Package ID.*
2. **Health-factor monitor** — live oracle/price feed → visible AI risk score for the position.
3. **Autonomous execution** — the Phase 1 confirm step flips to autonomous: when risk crosses the
   threshold, the agent executes the de-risk PTB within the leash, **still rendering an information
   card** per action (no silent action).
4. **Owner override** — one-tap revoke the Authority object; the agent stops mid-stride.

**Sub-track 1 must-haves, all met:** live price feed ✓ · visible AI risk score ✓ · ≥1 autonomous
on-chain action ✓ · human override ✓. (Personal/position guardian, not protocol-side — frame that
as broader real-world reach: every leveraged user, not a handful of DAOs.)

**Phase 2 demo:** open a leveraged position → set the leash → price drops, health factor falls →
agent autonomously repays before liquidation (info card + digest) → show the agent *cannot* withdraw
externally → revoke → agent stops.

---

## Submission checklist (from handbook)

- [ ] Project name (clear + simple)
- [ ] Description (what it does, why it matters)
- [ ] Logo (1:1, JPG/PNG)
- [ ] **Public GitHub repo** (public during judging)
- [ ] **Demo video** (YouTube, ≤5 min)
- [ ] Website (optional, recommended)
- [ ] **Deployment to Sui testnet or mainnet**
- [ ] **Package ID** (if deployed on-chain — Phase 1 optional, Phase 2 yes)
- [ ] At least one team member can pass KYC (required to receive prize)
- [ ] Team ≥ 2 members listed
- [ ] University Award? (mark student status on DeepSurge profile if ≥50% students)

---

## What NOT to do

- **Don't ship a swap chatbot with no guardian** — the Intent Engine sub-track explicitly rejects it.
  The guardian (≥2 risk classes, plain language) is the make-or-break must-have.
- Don't center x402/EVM settlement — it's the "bolted-on rail" judges penalize.
- Don't chase Walrus/DeepBook — wrong stack, wrong week.
- Don't start Phase 2's Move/Scallop work until Phase 1 is demo-ready — never risk the submission on
  the hard part.
