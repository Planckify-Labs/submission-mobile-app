# Task 19 — Manual smoke against Cetus / Suilend / Navi + quirks doc

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-dapp-bridge-spec.md` §13 (task 19), §14 (risk row 3).

## Why this matters

Wallet Standard compliance + lint suite (Task 03) catch shape bugs.
Real dApps catch behavior bugs: hydration-time re-discovery patterns,
SDK-version-specific Transaction shapes, sponsored-tx assumptions, idle
reconnect timing. Three live dApps cover most of the variance we'll
see post-ship.

## Scope

- Set up dev WebView with `FEATURE_SUI_DAPP_BRIDGE=true` (locally only —
  do NOT commit the flag flip; that's Task 20).
- For each dApp:
  1. **Cetus** (DEX) — connect → swap a small amount → sign-and-execute.
     Verify reactive re-discovery on hydration.
  2. **Suilend** (lending) — connect → deposit → sign-and-execute.
     Verify the `signPersonalMessage` step (most lending UIs use SIWS).
  3. **Navi** (lending / aggregator) — connect → swap → sign-and-execute.
     Verify network-switch behavior if Navi exposes one.
- Document each dApp's quirks in
  `docs/sui-dapp-bridge-task/19_dapp-quirks.md`:
  - Re-discovery pattern (does it call `getWallets()` once or
    reactively?).
  - Transaction shape passed to `signTransaction` (Mysten `Transaction`
    instance vs base64 vs Uint8Array — exercises the §5.5 normaliser).
  - SIWS use vs raw personal-message use.
  - Sponsored-tx use (Y/N).
  - Any dApp-specific bug surfaced.
- Add regression tests for any bug class found.

## Rules (non-negotiable)

- **Local flag flip only.** Do not commit `FEATURE_SUI_DAPP_BRIDGE=true`.
  Task 20 owns the flip.
- **Real wallets, testnet funds.** Use a fresh testnet wallet —
  do NOT use a wallet holding real funds.
- **Document, don't fix.** Each quirk gets a row in the doc; fixes are
  separate PRs that cite the doc.
- **Reproduce in writing.** Each quirk row has reproduction steps so
  someone else can verify.

## Acceptance

- [ ] All three dApps complete a full sign cycle on testnet.
- [ ] `19_dapp-quirks.md` exists with one section per dApp.
- [ ] Any bug class found has either a fix PR or a tracked task.
- [ ] No private mainnet funds touched.

## Out of scope

- Fixing every quirk — only blocking ones.
- The flag flip itself (Task 20).
