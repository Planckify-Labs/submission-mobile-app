# Task 03 — `ChainConfig` discriminated union + Solana `supportedChains` entries

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-chain-support-spec.md` §4.2, §6.2, §10.

## Why this matters

`ChainConfig` today assumes a viem `Chain` is the only shape a chain can
take. That's why `send.tsx` freely reads `activeChain.chain.nativeCurrency`.
Widening to a discriminated union by `namespace` is what lets the
`WalletKitAdapter` (Task 04) dispatch uniformly — the EVM path keeps its
viem chain; the Solana path carries `cluster` + `rpcUrl`.

## Scope

- `constants/configs/chainConfig.ts`:
  ```ts
  type ChainConfig =
    | {
        namespace: "eip155";
        chain: viem.Chain;
        iconUrl?: string;
        isTestnet?: boolean;
      }
    | {
        namespace: "solana";
        cluster: "mainnet-beta" | "devnet";
        rpcUrl: string;
        rpcSubscriptionsUrl?: string;
        iconUrl?: string;
        isTestnet?: boolean;
      };
  ```
- Add two Solana entries to `supportedChains`:
  - `mainnet-beta` — `rpcUrl` from `EXPO_PUBLIC_SOLANA_MAINNET_RPC`
    (default `https://api.mainnet-beta.solana.com`).
  - `devnet` — `rpcUrl` from `EXPO_PUBLIC_SOLANA_DEVNET_RPC` (default
    `https://api.devnet.solana.com`), `isTestnet: true`.
- `.env.example`: add the two `EXPO_PUBLIC_SOLANA_*_RPC` keys with
  their defaults.
- Rehydration safety (§10): in the `active_chain` query function, stamp
  `namespace: "eip155"` on any persisted shape missing a `namespace`
  before returning. This keeps users upgrading from v2.2.x from tripping
  the new narrowing.

## Rules (non-negotiable)

- **Narrow with `if (activeChain.namespace === "eip155")`, not with
  optional chaining.** Keep types sharp — see spec §9.2.
- **No viem import on the Solana branch.** The `solana` variant must
  stay importable without pulling viem's `Chain` type reach.
- **Existing EVM callers keep working unchanged.** Every `activeChain.chain.*`
  access either gets narrowed or moves into `EvmWalletKit` (Task 05). No
  reach-through on the Solana branch.
- **Persisted JSON round-trips.** `ChainConfig` is plain data — the
  `JSON.stringify`/`JSON.parse` path in `active_chain` storage must
  survive both variants.

## Acceptance

- [ ] `ChainConfig` is a discriminated union with `namespace` as the
      discriminant.
- [ ] `supportedChains` exports at least `ethereum`, `solana-mainnet`,
      `solana-devnet`. Existing EVM entries unchanged.
- [ ] `.env.example` lists `EXPO_PUBLIC_SOLANA_MAINNET_RPC` and
      `EXPO_PUBLIC_SOLANA_DEVNET_RPC`.
- [ ] Upgrading a local dev install from a pre-Solana build (persisted
      `active_chain` missing `namespace`) does not crash on load — the
      backfill stamps `"eip155"`.
- [ ] `pnpm check:syntax` passes; all compile errors from the widening
      are either fixed or scoped to the follow-up tasks with TODO
      comments referencing the task number.

## Out of scope

- `ChainSelector` namespace grouping UI (Task 16).
- Building a Solana `ChainConfig` from backend `Blockchain` rows in
  `changeActiveChainInternal` (Task 13).
- `WalletKitAdapter` interface / registry (Task 04).
