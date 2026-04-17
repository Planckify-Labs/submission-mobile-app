# Solana Chain Support — Task Backlog

This folder contains engineering tasks derived from
`../solana-chain-support-spec.md`. Each file represents one discrete unit
of work from the spec's §6 file surface and §14 onboarding UX.

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
| Not started | `01_deps_and_ed25519_polyfill_istaken_false.md` |
| In progress | `01_deps_and_ed25519_polyfill_istaken_true.md` |
| Finished    | `01_deps_and_ed25519_polyfill_istaken_true_isfinish_true.md` |

## Workflow

1. Browse the tasks, pick one that ends with `istaken_false.md`.
2. Claim it by renaming `istaken_false` → `istaken_true`:
   ```
   git mv 01_deps_and_ed25519_polyfill_istaken_false.md 01_deps_and_ed25519_polyfill_istaken_true.md
   ```
3. Work on the task. Read the referenced sections of
   `../solana-chain-support-spec.md` — each task file excerpts only the
   minimum context needed.
4. When the task is complete and merged, append the `_isfinish_true`
   postfix — do NOT flip `istaken` back to `false`:
   ```
   git mv 01_deps_and_ed25519_polyfill_istaken_true.md 01_deps_and_ed25519_polyfill_istaken_true_isfinish_true.md
   ```
   Finished files stay in the folder as a durable record of what shipped.
5. If you abandon a task mid-flight, rename it back to `istaken_false.md`
   (without the `isfinish_true` postfix) so someone else can pick it up.

## Phase ordering

Tasks are numbered by the phase they belong to in the spec. **Do not start
a later phase before the previous phase's exit criteria are green.**

- **Phase 1** (tasks 01–03) — dependencies, polyfill, type widening. No
  user-visible change.
- **Phase 2** (tasks 04–06) — `WalletKit` docking port + `EvmWalletKit`
  relocation. Behavior-identical on EVM.
- **Phase 3** (tasks 07–12) — Solana primitives and `SolanaWalletKit`.
  Kit is usable from unit tests but not yet from screens.
- **Phase 4** (tasks 13–16) — screens refactor to kit-dispatched reads /
  writes / display. Solana is first-class in `send.tsx` / `wallet.tsx`.
- **Phase 5** (task 17) — dApp-bridge signer wire-up so in-WebView Solana
  dApps can sign.
- **Phase 6** (tasks 18–26) — simplified onboarding (§14): login is
  auth-only, wallet management consolidates into `wallet.tsx`.
- **Phase 7** (task 27) — TWV-2026-070 security design note (can run in
  parallel once Phase 3 tasks 07 + 10 land).

## Task map

### Phase 1 — Dependencies and type scaffolding

| # | File | Title |
|---|---|---|
| 01 | `01_deps_and_ed25519_polyfill_istaken_false.md` | Add `@solana/kit` deps + Ed25519 polyfill + TWV-2026-070 boot check |
| 02 | `02_twallet_type_widening_istaken_false.md` | `TWallet.solana?` / `TSolanaFields` + widen `TWalletCreationParams.source` |
| 03 | `03_chain_config_discriminated_union_istaken_false.md` | `ChainConfig` discriminated union + Solana `supportedChains` entries |

### Phase 2 — WalletKit docking port

| # | File | Title |
|---|---|---|
| 04 | `04_wallet_kit_adapter_and_registry_istaken_false.md` | `WalletKitAdapter` interface + `walletKitRegistry` singleton |
| 05 | `05_evm_wallet_kit_relocation_istaken_false.md` | `EvmWalletKit` — wrap existing viem code behind the kit interface |
| 06 | `06_boot_wallet_kits_istaken_false.md` | `bootWalletKits()` + registration in `app/_layout.tsx` |

### Phase 3 — Solana primitives and signer dwell

| # | File | Title |
|---|---|---|
| 07 | `07_solana_derivation_slip0010_istaken_false.md` | `derivation.ts` — BIP-39 → SLIP-0010 ed25519 `m/44'/501'/0'/0'` |
| 08 | `08_solana_codec_istaken_false.md` | `codec.ts` — base58 / base64 / transaction round-trip |
| 09 | `09_solana_wallet_creators_and_validators_istaken_false.md` | `createSolanaWalletFrom{PrivateKey,Mnemonic}` + validators in `walletUtils.ts` |
| 10 | `10_solana_signer_dwell_twv2026070_istaken_false.md` | `walletService.getSolanaSignerForWallet` + cache + `clearAccountCache` |
| 11 | `11_solana_transfer_service_istaken_false.md` | `transferService.ts` — `getSolanaBalance` + `buildAndSendSolTransfer` |
| 12 | `12_solana_wallet_kit_istaken_false.md` | `SolanaWalletKit` implementation binding primitives to kit interface |

### Phase 4 — Kit-dispatched screens refactor

| # | File | Title |
|---|---|---|
| 13 | `13_use_wallet_kit_accessors_istaken_false.md` | `useWallet.getActiveWalletKit` + `getKitForWallet` + `changeActiveChainInternal` namespace branch |
| 14 | `14_send_screen_kit_dispatch_istaken_false.md` | Refactor `app/send.tsx` to kit dispatch (zero `namespace === "solana"` branches) |
| 15 | `15_wallet_screen_kit_dispatch_istaken_false.md` | `app/wallet.tsx` + `WalletDetails` + `WalletCard` use `kit.getNativeBalance` / `kit.formatNativeAmount` |
| 16 | `16_chain_selector_namespace_grouping_istaken_false.md` | `ChainSelector` groups chains by namespace; agent-busy gate unchanged |

### Phase 5 — DApp-bridge signer wire-up

| # | File | Title |
|---|---|---|
| 17 | `17_install_solana_signer_in_bridge_istaken_false.md` | `installSolanaSigner` + `services/bridge/boot.ts` call |

### Phase 6 — Simplified onboarding and wallet management (§14)

| # | File | Title |
|---|---|---|
| 18 | `18_login_auth_only_istaken_false.md` | Strip wallet UI from `app/login.tsx`; keep Google button as-is |
| 19 | `19_shared_mnemonic_bootstrap_istaken_false.md` | `deriveAll.ts` + `bootstrap.ts` — one mnemonic, N wallets auto-mint |
| 20 | `20_remove_legacy_wallet_routes_istaken_false.md` | Delete `wallet-setup`, `import-seed-phrase`, `import-private-key` routes + `WalletSetup.tsx` |
| 21 | `21_namespace_picker_and_infer_istaken_false.md` | `NamespacePicker` reusable component + `inferNamespaceFromKey` heuristic |
| 22 | `22_add_wallet_sheet_istaken_false.md` | `AddWalletSheet` top-level picker (create / import seed / import pk) |
| 23 | `23_create_wallet_sheet_istaken_false.md` | `CreateWalletSheet` — generate → verify-words → multi-chain derive |
| 24 | `24_import_seed_phrase_sheet_istaken_false.md` | `ImportSeedPhraseSheet` — paste → multi-chain namespace select → batch add |
| 25 | `25_import_private_key_sheet_istaken_false.md` | `ImportPrivateKeySheet` — chain-pick → paste → single-chain create |
| 26 | `26_wallet_screen_management_hub_istaken_false.md` | `wallet.tsx` as hub: "+" opens sheet, empty state, drop `/login` redirect |

### Phase 7 — Security documentation

| # | File | Title |
|---|---|---|
| 27 | `27_twv2026070_design_note_istaken_false.md` | `docs/wallet-security-task/NN_solana_signer_design_note.md` |

## Source of truth

`../solana-chain-support-spec.md` is the canonical spec. These task files
are a projection of it — if anything here disagrees with the spec, the
spec wins. Update the spec first, then update the task.
