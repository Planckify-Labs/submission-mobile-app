# Task 16 — `services/chains/sui/agentContext.ts` + tests

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-dapp-bridge-spec.md` §11.5.1, §11.5.2, §11.5.6.

## Why this matters

The on-demand "agent" inspector (future milestone) needs a per-namespace
JSON-safe view of any intent. EVM and Solana already have agentContext
builders; landing Sui's now means when the inspector ships, no Sui-side
code change is needed. The Sparkles pill ("Scan with Takumi AI") just
works.

## Scope

- `services/chains/sui/agentContext.ts`:
  - Mirror `services/chains/solana/agentContext.ts` exactly in shape.
  - Export `interface AgentIntentContext` per §11.5.2.
  - Export `type IntentShape` discriminated union with all six branches:
    `connect`, `signIn`, `signMessage`, `signTransaction`,
    `switchNetwork`, `unknown`.
  - Export `function buildAgentContext(intent): AgentIntentContext`.
  - **JSON-safe**: convert all `bigint` (`gasBudget`, `gasPrice`,
    simulation `gasUsed`, `balanceChanges.amount`) to `string`.
  - **Secret-free**: never include signature bytes / seed material.
    `messagePreview` truncated to 16 chars, `display === "utf8"` only.
  - **Pre-decoded**: surface `decoded` (PTB commands) and `simulation`;
    keep raw `transactionB64` for agent-side re-decode.
  - **MoveCall summary line** per §11.5.2 trailing block:
    ```
    MoveCall 0x<package>::<module>::<function> argc=<n> typeArgs=<m>
    ```
- `services/chains/sui/agentContext.test.ts`:
  - `JSON.stringify` round-trip without throwing on bigints.
  - `signMessage` truncates `messagePreview` to 16 chars only in
    `display === "utf8"` mode.
  - `signTransaction` sets `sponsored: true` iff `gasOwner !== sender`.
  - Parity test: same fixture shape Solana's agentContext.test.ts uses,
    Sui-adapted.

## Rules (non-negotiable)

- **JSON-safe, secret-free, pre-decoded.** §11.5.2 invariants are the
  bar; tests enforce them.
- **MoveCall summary line uses verbatim package id** — no truncation.
  AI tooling needs the full id to flag unknown packages.
- **`messagePreview` cap is 16 chars** — parity with Solana, not the
  full 32 / 64 some teams want. The agent gets enough to disambiguate
  SIWS variants without leaking claim text.
- **No new exports beyond `AgentIntentContext` and `buildAgentContext`** —
  internal helpers stay file-private.

## Acceptance

- [ ] All four test cases above green.
- [ ] `pnpm check:syntax` passes.
- [ ] Bundle-size diff captured (small — no new heavy deps).

## Out of scope

- The agent inspector itself (future milestone).
- `redactParams` Sui branches (Task 17).
- Production agent tools (`send_sui`, `send_sui_coin`) — owned by
  `docs/sui-chain-support-spec.md` §7.2.
