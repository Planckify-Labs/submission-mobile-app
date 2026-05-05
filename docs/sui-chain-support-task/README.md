# Sui Chain Support — Task Backlog

This folder contains engineering tasks derived from
`../sui-chain-support-spec.md`. Each file represents one discrete unit
of work from the spec's §3.2 file surface and §10 task breakdown.

## Filename convention

```
{NN}_{task_name}_istaken_{true|false}[_isfinish_true].md
```

- `NN` — two-digit sequential task number
- `task_name` — short snake_case label
- `istaken_true` / `istaken_false` — whether an engineer is actively working on it
- `_isfinish_true` — appended as a **postfix** once the task is complete.
  A file without this postfix is not yet finished.

Three possible states:

| State | Filename pattern |
|---|---|
| Not started | `00_hermes_rn_compat_smoke_test_istaken_false.md` |
| In progress | `00_hermes_rn_compat_smoke_test_istaken_true.md` |
| Finished    | `00_hermes_rn_compat_smoke_test_istaken_true_isfinish_true.md` |

## Workflow

1. Browse the tasks, pick one that ends with `istaken_false.md`.
2. Claim it by renaming `istaken_false` → `istaken_true`:
   ```
   git mv 00_hermes_rn_compat_smoke_test_istaken_false.md 00_hermes_rn_compat_smoke_test_istaken_true.md
   ```
3. Work on the task. Read the referenced sections of
   `../sui-chain-support-spec.md` — each task file excerpts only the
   minimum context needed.
4. When the task is complete and merged, append the `_isfinish_true`
   postfix — do NOT flip `istaken` back to `false`:
   ```
   git mv 00_hermes_rn_compat_smoke_test_istaken_true.md 00_hermes_rn_compat_smoke_test_istaken_true_isfinish_true.md
   ```
   Finished files stay in the folder as a durable record of what shipped.
5. If you abandon a task mid-flight, rename it back to `istaken_false.md`
   (without the `isfinish_true` postfix) so someone else can pick it up.

## Phase ordering

Tasks are numbered by the phase they belong to in the spec. **Do not start
a later phase before the previous phase's exit criteria are green.** PR
groupings follow the roll-out plan in `../sui-chain-support-spec.md` §12.

- **Phase 0** (task 00) — Hermes / RN compatibility smoke test for
  `@mysten/sui`. Single throw-away screen; gates the whole effort.
- **Phase 1** (tasks 01–02) — Type scaffolding. `TSuiFields`,
  `TWalletCreationParams.source` widening, `ChainConfig` Sui variant +
  static mainnet fallback. No user-visible change.
- **Phase 2** (tasks 03–07) — Sui primitives + signer dwell site +
  transfer services. Pure helpers + tests; kit not yet registered.
- **Phase 3** (tasks 08–10) — `SuiWalletKit` registered. Create-new
  flow derives a Sui wallet alongside EVM + Solana from one mnemonic.
  **Depends on the API seed PR (task 15)** — without server rows the
  picker / agent reads a Sui blockchain row that doesn't exist.
- **Phase 4** (tasks 11, 13, 14) — Agent-mode tools, telemetry, and
  the legacy 20-byte address rejection guard.
- **Phase 5** (task 12) — `SuiAdapter` scaffold lands behind
  `FEATURE_SUI_DAPP_BRIDGE=false`. Sets up the next milestone with a
  one-line ON.
- **Phase 6** (task 15) — API seed-script update (lands in
  `takumi-api/`, not this repo). Must merge **before** Phase 3.

## Task map

### Phase 0 — Compatibility gate

| # | File | Title |
|---|---|---|
| 00 | `00_hermes_rn_compat_smoke_test_istaken_false.md` | Hermes / RN compatibility smoke test for `@mysten/sui` |

### Phase 1 — Type scaffolding

| # | File | Title |
|---|---|---|
| 01 | `01_twallet_type_widening_istaken_false.md` | `TSuiFields` + extend `TWallet` / `TWalletCreationParams` |
| 02 | `02_chain_config_sui_variant_istaken_false.md` | `ChainConfig` Sui arm + static `supportedChains` mainnet row |

### Phase 2 — Primitives, dwell site, transfer services

| # | File | Title |
|---|---|---|
| 03 | `03_sui_derivation_slip0010_istaken_false.md` | `derivation.ts` — BIP-39 → SLIP-0010 ed25519 `m/44'/784'/0'/0'/0'` |
| 04 | `04_sui_codec_istaken_false.md` | `codec.ts` — bech32 (`suiprivkey1…`), address derivation, intent helpers |
| 05 | `05_sui_signer_dwell_twv2026xxx_istaken_false.md` | `walletService.getSuiSignerForWallet` + cache + `clearAccountCache` |
| 06 | `06_sui_wallet_creators_and_validators_istaken_false.md` | `walletUtils.ts` — validators + `createSuiWalletFrom{PrivateKey,Mnemonic}` |
| 07 | `07_sui_token_kind_and_transfer_services_istaken_false.md` | `errorCodes.ts` + `tokenKind.ts` + `transferService.ts` + `coinTransferService.ts` (Coin / Regulated / Closed Loop dispatch) |

### Phase 3 — Kit registration and shared mnemonic flow

| # | File | Title |
|---|---|---|
| 08 | `08_sui_wallet_kit_istaken_false.md` | `SuiWalletKit` implementation binding primitives to kit interface |
| 09 | `09_register_sui_wallet_kit_in_boot_istaken_false.md` | Register `createSuiWalletKit()` in `services/walletKit/boot.ts` |
| 10 | `10_extend_shared_mnemonic_bootstrap_istaken_false.md` | Extend `deriveWalletsFromMnemonic` namespaces to `["eip155","solana","sui"]` |

### Phase 4 — Agent-mode, telemetry, UX guards

| # | File | Title |
|---|---|---|
| 11 | `11_sui_agent_executors_istaken_false.md` | `services/agent-executors/sui.ts` + register + extend `EXPECTED_MOBILE_TOOLS` |
| 13 | `13_sui_telemetry_breadcrumbs_istaken_false.md` | Sentry tags `chain=sui` + breadcrumbs (no key bytes) |
| 14 | `14_legacy_address_rejection_istaken_false.md` | Pre-flight migration check: reject legacy 20-byte addresses in send sheet |

### Phase 5 — DApp-bridge scaffold (disabled)

| # | File | Title |
|---|---|---|
| 12 | `12_sui_adapter_scaffold_istaken_false.md` | `SuiAdapter` scaffold + `FEATURE_SUI_DAPP_BRIDGE` boot guard |

### Phase 6 — API seed-script companion

| # | File | Title |
|---|---|---|
| 15 | `15_api_seed_script_update_istaken_false.md` | `takumi-api/src/scripts/prisma/seed.ts` — Sui blockchain rows + USDC token row |

## Source of truth

`../sui-chain-support-spec.md` is the canonical spec. These task files
are a projection of it — if anything here disagrees with the spec, the
spec wins. Update the spec first, then update the task.

## Out of scope (this milestone)

These items are explicitly deferred to a follow-up spec
(`../sui-dapp-bridge-spec.md`, to be authored):

- Live `window.sui` injected provider in the dApp browser
- Approval sheet, PTB inspector, sign-in-with-Sui (SIWS)
- Sponsored transactions / gas station integration
- zkLogin, multisig accounts
- Sui Name Service (SuiNS) reverse lookup
- TakumiPay Move package on Sui

See `../sui-chain-support-spec.md` §0 (non-goals) and §13 (future work).
