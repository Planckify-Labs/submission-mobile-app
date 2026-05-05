# Task 09 — Register `createSuiWalletKit()` in `services/walletKit/boot.ts`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-chain-support-spec.md` §2.5, §3.3.

## Why this matters

The kit registry is populated at app boot in `services/walletKit/boot.ts`.
Until `createSuiWalletKit()` is registered, every `walletKitRegistry.get
("sui")` call returns `undefined` and the namespace picker, send sheet,
and agent executors all silently treat Sui as an unknown chain. This
task is the one-line wire-up that lights everything up.

## Scope

- `services/walletKit/boot.ts`:
  ```ts
  import { createSuiWalletKit } from "./sui/SuiWalletKit";

  export function bootWalletKits() {
    walletKitRegistry.register(createEvmWalletKit());
    walletKitRegistry.register(createSolanaWalletKit());
    walletKitRegistry.register(createSuiWalletKit());   // ← new
  }
  ```
- Verify boot order in `app/_layout.tsx`: `pollyfills.ts` →
  `bootWalletKits()` → screen mount → `bootBridge(...)`. No new
  polyfill required (Task 00 confirmed `@mysten/sui` runs against the
  existing polyfill set).
- `services/walletKit/boot.test.ts` (extend) — assert all three kits
  registered after `bootWalletKits()`; assert order is EVM → Solana →
  Sui (used by the namespace picker for stable row order).

## Rules (non-negotiable)

- **One-line registration only.** No conditional flag, no env-gated
  path. Sui rides the same boot as EVM and Solana.
- **Order is stable.** EVM first (incumbent), Solana second
  (precedent), Sui third. Tests assert ordering.
- **Do NOT register `SuiAdapter` here.** That belongs in
  `services/bridge/boot.ts` behind `FEATURE_SUI_DAPP_BRIDGE` (Task 12).
  The kit registry and the adapter registry are separate seams.
- **No retry / fallback.** If `createSuiWalletKit()` throws at
  boot, that's a Hermes-compat regression — surface it loudly.

## Acceptance

- [ ] `services/walletKit/boot.ts` registers the Sui kit in the third
      slot.
- [ ] Boot test asserts presence + order of all three kits.
- [ ] Fresh dev-client boot (iOS + Android) shows no errors.
- [ ] EVM and Solana regression tests still pass — registering Sui must
      not perturb the other kits.
- [ ] **UI verification (spec §3.3, §8.1, §8.4):**
      - [ ] `components/wallet/create/*` namespace picker auto-renders
            a Sui row using the kit's `displayName` ("Sui") — no
            per-screen edit needed.
      - [ ] `ImportPrivateKeySheet` accepts a `suiprivkey1…` payload
            once the user picks the Sui namespace (`kit.validatePrivateKey`
            narrows correctly).
      - [ ] `components/asset-explorer/NetworkRadioButtons.tsx` renders
            Sui rows once the backend `/blockchains` feed includes them
            (Task 15) — confirm the existing live-feed renderer does
            not need a new branch.
- [ ] `pnpm check:syntax` passes; `pnpm run test` passes.

## Out of scope

- Bridge-side `SuiAdapter` registration (Task 12).
- Create-new flow extension (Task 10).
- Backend `/blockchains` Sui rows (Task 15).
