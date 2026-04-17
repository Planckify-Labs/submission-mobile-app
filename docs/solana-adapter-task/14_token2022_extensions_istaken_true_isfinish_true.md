# Task 14 — `token2022.ts` — mint extension parser + annotations

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §4.7, §10.2, §10.4 inv 8.

## Why this matters

Token-2022 mints can carry footgun extensions invisible to the user —
`PermanentDelegate` lets a third party move tokens without consent;
`MintCloseAuthority` can wipe out the entire token supply;
`TransferFee` silently reduces received amount; `TransferHook` runs
arbitrary code on every transfer. Invariant 8 mandates a distinct
annotation per extension with severity tagged by footgun class.
Without this, users approving a "simple SPL transfer" could be
approving a rugpull.

## Scope

- `services/chains/solana/token2022.ts`:
  - `readMintExtensions(mint: Address, rpc: SolanaRpc):
    Promise<MintExtensions>` — fetches `getAccountInfo(mint)`, parses
    TLV extension data via `@solana-program/token-2022`.
  - Detect and return each extension with its material fields:
    `TransferFee`, `PermanentDelegate`, `NonTransferable`,
    `InterestBearing`, `DefaultAccountState`, `ConfidentialTransfer`,
    `TransferHook`, `MetadataPointer`, `MemoTransfer`, `CpiGuard`,
    `MintCloseAuthority`, `ScaledUiAmount`, `PausableConfig`,
    `GroupPointer`, `GroupMemberPointer`, inline `TokenMetadata`.
  - `summariseExtensionWarnings(ext: MintExtensions):
    SolanaSimulationWarning[]` — emits the §10.4 inv 8 annotations
    with exact severity classes:
    - `PermanentDelegate` set → `danger`.
    - `MintCloseAuthority` set → `danger`.
    - `PausableConfig.paused` → `danger`.
    - `TransferFee` non-zero → `warn` with basis-points + fee
      account.
    - `TransferHook` set → `warn` with hook program.
    - `NonTransferable` (on an owner-transfer action) → `warn`.
    - `DefaultAccountState = Frozen` → `warn`.
    - `MetadataPointer` → read pointed account; mismatch with
      on-chain metadata → `warn`; else `info` with name/symbol/URI.
    - `CpiGuard` → `info`.
    - `InterestBearing` → `info`.
    - `ConfidentialTransfer` with pending balance → `info`.
    - `MemoTransfer` required + action lacks memo → `warn`.
    - `ScaledUiAmount` → silently adjust display (both raw +
      scaled shown); no warning.
    - `GroupPointer` / `GroupMemberPointer` → `info`.
    - Inline `TokenMetadata` → authoritative name / symbol / URI
      (overrides dApp-supplied hint).
    - Unknown extension discriminant → `warn: "Mint uses an
      unrecognized Token-2022 extension ({discriminant}) — wallet
      may not display accurately"`.
  - Used by `SolanaSimulationInspector` (Task 11) for every SPL
    instruction touching a Token-2022 mint; and by `takumi:watchToken`
    (Task 19).
- `token2022.test.ts` — fixture mints for each extension class;
  severity-level assertion per extension.

## Rules (non-negotiable)

- **Every known material extension surfaces an annotation.**
  Invariant 8 enumeration is exhaustive for what we render — no
  silent "present but not shown".
- **Unknown extensions warn, never silently pass.** Future
  extensions must be visible so users see "something here I don't
  understand" instead of a false-green preview.
- **`readMintExtensions` caches via `solanaRpcPool`.** Read-only
  mint-account data; 2 s TTL fine.

## Acceptance

- [ ] PYUSD fixture → `TransferFee warn`.
- [ ] Fixture with `PermanentDelegate` → `danger`.
- [ ] Fixture with unknown discriminant → `warn` with raw
      discriminant number.
- [ ] Inline `TokenMetadata` overrides dApp hint (unit test).

## Out of scope

- Confidential-transfer full ZK rendering (deferred; see §9).
- `takumi:watchToken` UX wiring (Task 19).
- Rendering annotations in the tx sheet (Task 16).
