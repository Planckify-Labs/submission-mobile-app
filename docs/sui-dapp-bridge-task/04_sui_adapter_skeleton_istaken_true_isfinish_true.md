# Task 04 — `services/chains/sui/SuiAdapter.ts` skeleton (dispatch only)

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-dapp-bridge-spec.md` §4.1, §4.2, §4.3, §4.5, §4.6.

## Why this matters

Splitting the adapter into two tasks (dispatch first, executeApproval
later) lets the dispatch table land with full test coverage before any
keypair touches the bridge. The skeleton must be wireable to the bridge
without enabling signing — Task 14's boot guard keeps it dormant until
`installSuiSigner` (Task 05) registers.

## Scope

- `services/chains/sui/SuiAdapter.ts`:
  - `class SuiAdapter implements ChainAdapter` with `namespace = "sui" as const`.
  - `getInjectedScript(ctx)` per §4.5 — returns the IIFE from Task 03 with
    the active address spliced (`null` when no Sui wallet present).
  - `onStateChange(ctx)` per §4.6 — emits `_updateSuiWallet({accounts, chain})`.
  - `handleRequest(req, ctx)` switch per §4.1 dispatch table:
    - `standard:connect` → `handleConnect` (silent vs interactive per §4.2)
    - `standard:disconnect` → `PermissionStore.revoke({origin})`, resolved
    - `sui:signPersonalMessage` → needs-approval `signMessage`
    - `sui:signTransaction` → needs-approval `signTransaction` (sign-only)
    - `sui:signAndExecuteTransaction` → needs-approval `signTransaction`
      (sign-and-execute)
    - `sui:signTransactionBlock` → rewrite to `sui:signTransaction`,
      dev-warn once per session
    - `sui:signAndExecuteTransactionBlock` → rewrite, dev-warn once
    - `sui:reportTransactionEffects` → log to `bridgeEventBus`, return `null`
    - `takumi:switchNetwork` → needs-approval `switchNetwork`
    - default → `-32601` per Task 02.
  - `pickSuiWalletForOrigin(ctx, origin, network)` helper (file-private)
    per §4.3 — body lifted from `SolanaAdapter:131-151`, only chain-id
    prefix differs.
  - `executeApproval` stub returning `-32603 "No Sui signer registered"`
    until Task 05 lands.
- `factory createSuiAdapter()` export — registry expects a factory.
- `services/chains/sui/SuiAdapter.test.ts`:
  - Table-driven dispatch test: every wire method routes to the right
    intent kind (or to a resolved/no-intent path).
  - Connect silent path: stub `PermissionStore.isGranted` true → resolves
    inline; false → `needs-approval`.
  - Cross-namespace trust rejection: seed an EVM grant for the origin,
    fire `standard:connect({silent:true})`, expect `4100`.
  - Legacy method rewrites + console.warn spy (once-per-session check).
  - `sui:reportTransactionEffects` returns `{ ok: true }` without
    `pendingIntentsStore.push`.

## Rules (non-negotiable)

- **Cross-namespace trust forbidden** (§4.2, §11). EVM grants do NOT
  silently expose Sui wallets.
- **Default network `"mainnet"`** (§4.2), not `"mainnet-beta"` (Solana
  carryover trap).
- **Legacy aliases rewrite the method name in-place**, then fall through
  to the same switch arm. No code duplication between current/legacy.
- **`pickSuiWalletForOrigin` body identical to Solana** modulo the
  chain-id prefix string. Don't reinvent — it's a TWV-2026-013-aware
  helper (origin pinning + cross-namespace isolation).

## Acceptance

- [ ] Dispatch table 100% covered by tests.
- [ ] Cross-namespace trust test passes.
- [ ] Legacy alias test passes — `console.warn` fires exactly once per
      session per alias.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- `executeApproval` real implementations (Tasks 06, 07).
- `installSuiSigner` (Task 05).
- Boot wiring (Task 14).
