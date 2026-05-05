# Task 02 — `ChainConfig` Sui arm + static `supportedChains` mainnet row

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-chain-support-spec.md` §3.6, §11 (resolved decision 1).

## Why this matters

`ChainConfig` is the discriminated union every kit method narrows on.
Until the Sui arm exists, `SuiWalletKit` cannot type-narrow its inputs
without `as any`, and the chain switcher cannot render a Sui row from
the static fallback while the backend `/blockchains` feed catches up.
A static mainnet row also means a fresh install lands the user on
mainnet — same posture as Solana — so QA can exercise Sui without
backend coordination.

## Scope

- `constants/configs/chainConfig.ts`:
  ```ts
  export type ChainConfig =
    | { namespace: "eip155"; chain: TChain; iconUrl?: string; isTestnet?: boolean }
    | { namespace: "solana"; cluster: "mainnet-beta" | "devnet"; rpcUrl: string;
        rpcSubscriptionsUrl?: string; iconUrl?: string; isTestnet?: boolean }
    | { namespace: "sui";    network: "mainnet" | "testnet" | "devnet";
        rpcUrl: string; iconUrl?: string; isTestnet?: boolean };
  ```
- Add **mainnet only** to the static `supportedChains` array:
  ```ts
  {
    namespace: "sui",
    network: "mainnet",
    rpcUrl: "https://fullnode.mainnet.sui.io:443",
    iconUrl: /* Sui logo asset path */,
    isTestnet: false,
  }
  ```
  Testnet / devnet rows arrive via the backend `/blockchains` feed
  (Task 15) — do **not** add them statically.

## Rules (non-negotiable)

- **Static mainnet only.** Mirrors the Solana posture (mainnet-beta in
  static fallback, devnet via backend). Static testnet rows would ship
  to every user and require a feature flag to hide — not worth the
  surface area.
- **No new `chainSlug` discriminator column.** The existing `network`
  field on the Sui arm is the chain identifier — code that needs a
  CAIP-2-shaped string composes `sui:${network}` on the fly. (Decision
  recorded in spec §3.8.)
- **No `MAX_GAS_BUDGET_MIST` here.** The kit owns transfer-related
  constants (Task 08). Keep this file to topology only.
- **Public Mysten fullnode is the v1 endpoint.** Swap to a paid
  provider (Alchemy / Triton) via re-seed when traffic warrants — the
  static URL is the floor, not the ceiling.

## Acceptance

- [ ] `ChainConfig` becomes a 3-armed discriminated union.
- [ ] `supportedChains` exports a Sui mainnet row pointing at the
      Mysten public RPC.
- [ ] Existing EVM and Solana rows are byte-identical (no drift).
- [ ] `pnpm check:syntax` passes — every consumer of `ChainConfig`
      either narrows on `namespace` already, or now needs an explicit
      `case "sui":` branch surfaced by the type checker.
- [ ] Sentry telemetry for type errors after merge stays green for 24h.

## Out of scope

- Backend `/blockchains` Sui rows (Task 15 — separate repo).
- `SuiWalletKit` consumption of the new arm (Task 08).
- `ChainSelector` UI grouping changes — already namespace-grouped from
  the Solana rollout.
