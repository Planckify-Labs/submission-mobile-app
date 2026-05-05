# Sui dApp Bridge — Task Backlog

This folder contains engineering tasks derived from
`../sui-dapp-bridge-spec.md`. Each file represents one discrete unit of
work from the spec's §3 file surface, §13 task breakdown, and §15
roll-out plan.

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
| Not started | `01_payloads_and_types_istaken_false.md` |
| In progress | `01_payloads_and_types_istaken_true.md` |
| Finished    | `01_payloads_and_types_istaken_true_isfinish_true.md` |

## Workflow

1. Browse the tasks, pick one that ends with `istaken_false.md`.
2. Claim it by renaming `istaken_false` → `istaken_true`:
   ```
   git mv 01_payloads_and_types_istaken_false.md 01_payloads_and_types_istaken_true.md
   ```
3. Work on the task. Read the referenced sections of
   `../sui-dapp-bridge-spec.md` — each task file excerpts only the
   minimum context needed.
4. When the task is complete and merged, append the `_isfinish_true`
   postfix — do NOT flip `istaken` back to `false`:
   ```
   git mv 01_payloads_and_types_istaken_true.md 01_payloads_and_types_istaken_true_isfinish_true.md
   ```
   Finished files stay in the folder as a durable record of what shipped.
5. If you abandon a task mid-flight, rename it back to `istaken_false.md`
   (without the `isfinish_true` postfix) so someone else can pick it up.

## Phase ordering

Tasks are numbered by the phase they belong to in the spec's §15 roll-out
plan. **Do not start a later phase before the previous phase's exit
criteria are green.** The bridge stays gated behind
`FEATURE_SUI_DAPP_BRIDGE=false` until task 20.

- **Phase 0** (task 00) — research / SDK round-trip verification. No
  production code.
- **Phase 1** (tasks 01–04) — payloads, error codes, injected script,
  adapter skeleton. Adapter returns `-32601` for everything; injected
  script announces but does not sign.
- **Phase 2** (tasks 05–07) — `installSuiSigner` + `executeApproval`
  for connect / signMessage / signIn / signTransaction (both modes) /
  switchNetwork. Signer dwells at `getSuiSignerForWallet` per
  TWV-2026-YYY.
- **Phase 3** (tasks 08–10) — inspectors (PTB decoder, simulation, SIWS).
  No user-visible change yet.
- **Phase 4** (tasks 11–13) — approval sheets + renderer registration.
  Sheets compile but unreachable until the boot guard flips.
- **Phase 5** (tasks 14, 15) — boot wiring + telemetry. Cold/warm Fast
  Refresh re-tested; `chain=sui` Sentry tags + per-method timers wired.
- **Phase 6** (tasks 16–18) — AI-readiness: `agentContext.ts`,
  `redact.ts` Sui branches, agent-mode write-path smoke. Lands BEFORE
  the bridge goes live so the on-demand "agent" inspector finds Sui
  ready when it ships.
- **Phase 7** (task 19) — manual dApp smoke (Cetus, Suilend, Navi) and
  quirks document.
- **Phase 8** (task 20) — flip `FEATURE_SUI_DAPP_BRIDGE` to `true`. Sui
  dApp explorer is live.
- **Phase 9** (tasks 21, 22) — orthogonal items derived from spec body
  (not §13 task table): the WalletConnect CAIP-2 mapping extension and
  the TWV-2026-YYY (SUI-DAPP) security design note. Both can land in
  parallel with any earlier phase; the security note is the
  ship-blocker for task 20.

## Task map

### Phase 0 — Research

| # | File | Title |
|---|---|---|
| 00 | `00_verify_mysten_tx_round_trip_istaken_false.md` | Verify `@mysten/sui/transactions` `Transaction.from(bytes)` round-trip in WebView WebKit/Chromium runtime |

### Phase 1 — Payloads, errors, injected script, adapter skeleton

| # | File | Title |
|---|---|---|
| 01 | `01_payloads_and_types_istaken_false.md` | `services/chains/sui/payloads.ts` + Sui types (network, chain, payloads, decoded commands, simulation summary) |
| 02 | `02_error_codes_istaken_false.md` | `services/chains/sui/errorCodes.ts` + `assertSuiErrorCode` (analogue of Solana errorCodes) |
| 03 | `03_injected_script_and_lint_istaken_false.md` | `services/chains/sui/injectedScript.ts` (Wallet Standard shim, ≤ 5 KB gz, idempotent) + `__wallet-standard-lint.ts` |
| 04 | `04_sui_adapter_skeleton_istaken_false.md` | `services/chains/sui/SuiAdapter.ts` skeleton — `getInjectedScript`, `onStateChange`, `handleRequest` dispatch table only |

### Phase 2 — Signer dwell + executeApproval

| # | File | Title |
|---|---|---|
| 05 | `05_install_sui_signer_istaken_false.md` | `installSuiSigner` + `SuiSignerFns` interface; bridge-side signer install dwelling on `getSuiSignerForWallet` |
| 06 | `06_execute_approval_non_tx_istaken_false.md` | `SuiAdapter.executeApproval` for `connect`, `signMessage`, `signIn` (SIWS), `switchNetwork` |
| 07 | `07_execute_approval_sign_transaction_istaken_false.md` | `SuiAdapter.executeApproval` for `signTransaction` (sign-only) + `signTransaction` (sign-and-execute) round-tripping `Ed25519Keypair.signTransaction` |

### Phase 3 — Inspectors

| # | File | Title |
|---|---|---|
| 08 | `08_ptb_decoder_inspector_istaken_false.md` | `SuiPtbDecoderInspector` — pure decode of base64 BCS via `Transaction.from`; emits `decoded`, `sender`, `gasOwner`, `gasBudget`, etc. + decoder annotations |
| 09 | `09_simulation_inspector_istaken_false.md` | `SuiSimulationInspector` + `services/chains/sui/simulation.ts` — `client.dryRunTransactionBlock` with mocked-RPC tests; emits balance/object change warnings |
| 10 | `10_siws_inspector_istaken_false.md` | `SuiSiwsInspector` — canonical SIWS message builder, domain mismatch / expiry / not-yet-valid annotations |

### Phase 4 — Approval sheets + renderer registration

| # | File | Title |
|---|---|---|
| 11 | `11_sui_transaction_sheet_istaken_false.md` | `components/dapps-browser/approvals/SuiTransactionSheet.tsx` — sign-only + sign-and-execute (mode flag), simulation summary, decoded PTB list, gas summary, warnings panel |
| 12 | `12_message_signin_switch_sheets_istaken_false.md` | `SuiSignPersonalMessageSheet.tsx`, `SuiSignInSheet.tsx`, `SuiSwitchNetworkSheet.tsx` |
| 13 | `13_register_renderers_istaken_false.md` | Append four Sui rows (`signIn`, `signMessage`, `signTransaction`, `switchNetwork`) to `components/dapps-browser/approvals/renderers.ts` |

### Phase 5 — Boot wiring + telemetry

| # | File | Title |
|---|---|---|
| 14 | `14_boot_register_and_signer_guard_istaken_false.md` | Register `createSuiAdapter()` in `services/bridge/boot.ts`; register `SuiPtbDecoderInspector` / `SuiSimulationInspector` / `SuiSiwsInspector` per §8.4; `installSuiSigner` behind `walletKitRegistry.has("sui")` guard; cold/warm Fast Refresh re-tested |
| 15 | `15_telemetry_sentry_tags_istaken_false.md` | Extend `bridgeEventBus` consumers with `chain=sui` Sentry tags + per-method timers; mirror Solana telemetry |

### Phase 6 — AI-readiness (lands before bridge goes live)

| # | File | Title |
|---|---|---|
| 16 | `16_agent_context_builder_istaken_false.md` | `services/chains/sui/agentContext.ts` + tests — JSON-safe, secret-free, `MoveCall` summary line, parity with Solana `agentContext.ts` |
| 17 | `17_redact_params_sui_branches_istaken_false.md` | `services/bridge/redact.ts` Sui branches — `sui:signTransaction`, `sui:signPersonalMessage`, `sui:reportTransactionEffects`, both legacy aliases |
| 18 | `18_agent_mode_write_path_smoke_istaken_false.md` | Stub Sui write tool calling `submitAgentIntent`; assert `AgentCardRenderer` (not `SuiTransactionSheet`) renders, auto inspectors run, `executeApproval` signs through `getSuiSignerForWallet` |

### Phase 7 — Manual smoke + dApp quirks

| # | File | Title |
|---|---|---|
| 19 | `19_dapp_quirks_smoke_istaken_false.md` | Manual smoke against Cetus, Suilend, Navi via dev WebView; document each dApp's quirks (e.g., reactive re-discovery patterns) |

### Phase 8 — Ship

| # | File | Title |
|---|---|---|
| 20 | `20_flip_feature_flag_istaken_false.md` | Flip `FEATURE_SUI_DAPP_BRIDGE` from `false` → `true` in `services/bridge/boot.ts`. Single-line diff PR |

### Phase 9 — Orthogonal items (spec §3.2 + §11)

These tasks come from the spec body, not the §13 task table. They are
strictly orthogonal — pickable in parallel with any earlier phase — but
task 22 is a ship-blocker for task 20.

| # | File | Title |
|---|---|---|
| 21 | `21_caip_mapping_sui_namespace_istaken_false.md` | Extend `caip2ToNamespace` in `services/walletconnect/caipMapping.ts:11-23` to recognise `sui:` (symmetric direction at `:35-39` already handles Sui). Bridge does not call this; agent permissions might. Per spec §3.2 |
| 22 | `22_twv2026yyy_sui_dapp_design_note_istaken_false.md` | TWV-2026-YYY (SUI-DAPP) design note in `docs/wallet-security-task/`. Document: bridge sign path goes through `SuiSignerFns` only; injected script never sees private keys; cross-namespace trust forbidden in `executeApproval`. Per spec §11. Parallel of Solana task 27 |

## Cross-spec dependencies

This backlog has hard dependencies on the wallet-kit milestone
(`../sui-chain-support-spec.md`):

- **Task 05 (`installSuiSigner`)** depends on wallet-kit task 07
  (`getSuiSignerForWallet` dwell site) so the bridge-side signer has a
  single place to reach the keypair through. Until that lands,
  `installSuiSigner` short-circuits and the adapter handles requests but
  cannot sign.
- **Task 14 (boot register)** must guard with `walletKitRegistry.has("sui")`
  (mirroring the Solana guard at `services/bridge/boot.ts:100-121`). If
  the kit isn't registered, dev-warn + leave `booted = false` so the
  next mount retries — same auto-retry pattern Solana uses.
- **Task 18 (agent-mode write-path smoke)** is integration-only here —
  production agent tools (`send_sui`, `send_sui_coin`) are owned by the
  wallet-kit spec §7.2.

## Source of truth

`../sui-dapp-bridge-spec.md` is the canonical spec. These task files are
a projection of it — if anything here disagrees with the spec, the spec
wins. Update the spec first, then update the task.
