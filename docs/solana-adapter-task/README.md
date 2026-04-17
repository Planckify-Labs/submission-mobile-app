# Solana Adapter — Task Backlog

This folder contains engineering tasks derived from
`../solana-adapter-spec.md`. Each file represents one discrete unit of
work from the spec's §4 architecture, §5 file layout, §6 phased rollout,
and §10 compliance matrix.

**Context:** the `solana-chain-support-task/` folder (all 27 tasks
complete) delivered first-party Solana primitives — wallet creation,
SLIP-0010 derivation, `KeyPairSigner` dwell, SOL transfer, and
`SolanaWalletKit`. This backlog builds on those primitives to ship a
production-grade **dApp-bridge adapter** that turns TakumiAI into a
first-class in-app Solana wallet for Jupiter, Magic Eden, Drift, pump.fun,
Phantom's demo pages, etc.

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
| Not started | `01_adapter_deps_and_approval_kind_istaken_false.md` |
| In progress | `01_adapter_deps_and_approval_kind_istaken_true.md` |
| Finished    | `01_adapter_deps_and_approval_kind_istaken_true_isfinish_true.md` |

## Workflow

1. Browse the tasks, pick one that ends with `istaken_false.md`.
2. Claim it by renaming `istaken_false` → `istaken_true`:
   ```
   git mv 01_adapter_deps_and_approval_kind_istaken_false.md 01_adapter_deps_and_approval_kind_istaken_true.md
   ```
3. Work on the task. Read the referenced sections of
   `../solana-adapter-spec.md` — each task file excerpts only the
   minimum context needed.
4. When the task is complete and merged, append the `_isfinish_true`
   postfix — do NOT flip `istaken` back to `false`:
   ```
   git mv 01_adapter_deps_and_approval_kind_istaken_true.md 01_adapter_deps_and_approval_kind_istaken_true_isfinish_true.md
   ```
   Finished files stay in the folder as a durable record of what shipped.
5. If you abandon a task mid-flight, rename it back to `istaken_false.md`
   (without the `isfinish_true` postfix) so someone else can pick it up.

## Phase ordering

Tasks are numbered by the phase they belong to in the spec. **Do not
start a later phase before the previous phase's exit criteria are
green.** The adapter's bridge spine (`DappBridge`, `ApprovalHost`,
`IntentInspector`) is unchanged by this work — every task plugs into
existing ports.

- **Phase 1a** (tasks 01–07) — Wallet Standard compliance + routing
  surface. Every signing method still lands on the existing scaffolded
  signer; behavior-compatible with today's scaffold + an announce dApps
  can auto-detect via `@solana/wallet-adapter-wallet-standard`.
- **Phase 1b** (tasks 08–22) — Full signing surface (signIn,
  signAllTransactions, real signTransaction UX), simulation-first UX,
  decoded instructions, Token-2022 extension awareness, cluster
  switching, watch-token, broadcast state machine.
- **Phase 1c** (tasks 23–31) — Advanced flows required for GA —
  durable nonce, partial signing, Jito tip display, stake / ATA / ALT /
  Metaplex decoders, SNS, version-downgrade safety.
- **Phase GA** (tasks 32–34) — Wallet Standard lint, third-party smoke
  matrix, §10.4 security review sign-off.

**Platform transports explicitly deferred** (not in this backlog): MWA
v2.0, WalletConnect v2 `solana:*`, Solana Pay URI — each needs its own
OS-level integration spec. See §9 + §6 Phase 2+.

## Task map

### Phase 1a — Wallet Standard compliance + routing surface

| # | File | Title |
|---|---|---|
| 01 | `01_adapter_deps_and_approval_kind_istaken_false.md` | `@wallet-standard/core` / `@solana/wallet-standard-features` / `@solana-program/token{,-2022}` / `@solana-program/address-lookup-table` deps + `ApprovalKind` +3 variants |
| 02 | `02_expanded_payload_union_istaken_false.md` | `payloads.ts` — full `SolanaApprovalPayload` union + `SolanaChain` + `canonicalizeChain` |
| 03 | `03_injected_script_wallet_standard_istaken_false.md` | `injectedScript.ts` — `registerWallet` handshake + `window.solana` / `window.phantom.solana` shim |
| 04 | `04_solana_adapter_routing_istaken_false.md` | `SolanaAdapter.handleRequest` method table — sign-only vs sign-and-send split, legacy alias, cluster resolve |
| 05 | `05_solana_rpc_pool_istaken_false.md` | `services/rpc/solanaRpcPool.ts` — proxy routing + rate-limit backoff + read-only cache |
| 06 | `06_permission_grant_chainid_widen_istaken_false.md` | Widen `PermissionGrant.chainId` to `string \| number`; key Solana grants by `(originHash, walletAddress, caip2Cluster)` |
| 07 | `07_solana_connect_sheet_istaken_false.md` | `SolanaConnectSheet.tsx` + `{ silent: true }` semantics + cluster-scoped grant write |

### Phase 1b — Full signing surface + SIWS + simulation + decoded UX

| # | File | Title |
|---|---|---|
| 08 | `08_siws_message_builder_istaken_false.md` | `siws.ts` — EIP-4361-derived ABNF message builder + Phantom reference vectors |
| 09 | `09_siws_inspector_and_sheet_istaken_false.md` | `SolanaSiwsInspector` + `SolanaSignInSheet.tsx` + `signer.ts` `signIn` handler |
| 10 | `10_alt_resolver_istaken_false.md` | `altResolver.ts` — resolve v0 tx lookup-table entries pre-render |
| 11 | `11_simulation_inspector_istaken_false.md` | `simulate.ts` + `SolanaSimulationInspector` — pre/post deltas + warning emission |
| 12 | `12_program_decoder_inspector_istaken_false.md` | `programDecoder.ts` — System / SPL Token / Token-2022 / ComputeBudget / Memo decoders + inspector wrapper |
| 13 | `13_program_errors_decoder_istaken_false.md` | `programErrors.ts` — three-tier decoded-error contract (per-program tables + Anchor + fallback) |
| 14 | `14_token2022_extensions_istaken_false.md` | `token2022.ts` — mint-account parse + per-extension annotation rules (§10.4 inv 8) |
| 15 | `15_sign_message_sheet_expansion_istaken_false.md` | `SolanaSignMessageSheet` — utf-8 vs base64 auto-detect + SIWS-shape routing |
| 16 | `16_transaction_sheet_expansion_istaken_false.md` | `SolanaTransactionSheet` — decoded + simulation + compute budget + fee-payer rendering |
| 17 | `17_sign_all_transactions_sheet_istaken_false.md` | `SolanaSignAllTransactionsSheet.tsx` + variadic `solana:signTransaction` routing (cap N≤20) |
| 18 | `18_switch_cluster_feature_istaken_false.md` | `takumi:switchCluster` custom feature + `SolanaSwitchClusterSheet` + `standard:events` change |
| 19 | `19_watch_token_feature_istaken_false.md` | `takumi:watchToken` custom feature + `SolanaWatchTokenSheet` + `tokenList` Solana persistence |
| 20 | `20_broadcast_state_machine_istaken_false.md` | `broadcast.ts` — preflight cache + polling confirmation + blockhash-expiry retry |
| 21 | `21_error_code_contract_istaken_false.md` | Adapter returns exact §10.3 codes; Zod param validation at adapter boundary |
| 22 | `22_boot_and_redaction_wiring_istaken_false.md` | `services/bridge/boot.ts` — register inspectors + signer wiring; `redact.ts` Solana branch |

### Phase 1c — Advanced flows required for GA

| # | File | Title |
|---|---|---|
| 23 | `23_durable_nonce_handling_istaken_false.md` | `AdvanceNonceAccount` first-instr detection + nonce-authority mismatch `danger` |
| 24 | `24_partial_multi_signer_istaken_false.md` | Co-signer flow — partially signed tx return when fee payer ≠ active wallet |
| 25 | `25_jito_tip_display_istaken_false.md` | `jitoTipAccounts.ts` — hard-coded 8 mainnet tip accounts + tip row in tx sheet |
| 26 | `26_stake_program_decoder_istaken_false.md` | Stake program instruction decoders (Initialize / Delegate / Split / Withdraw / …) |
| 27 | `27_ata_program_decoder_istaken_false.md` | ATA Create / CreateIdempotent / RecoverNested + hijack detection (§10.4 inv 7) |
| 28 | `28_alt_program_decoder_istaken_false.md` | Address Lookup Table lifecycle instruction decoders |
| 29 | `29_metaplex_decoders_istaken_false.md` | Metaplex Token Metadata / Core / Bubblegum instruction decoders |
| 30 | `30_sns_resolver_istaken_false.md` | `sns.ts` — `.sol` domain resolution with advisory invariant (§10.4 inv 22) |
| 31 | `31_version_downgrade_safety_istaken_false.md` | Refuse v0 → legacy downgrade; ALT-declaring legacy `-32602` |

### Phase GA — Verification + sign-off

| # | File | Title |
|---|---|---|
| 32 | `32_wallet_standard_lint_istaken_false.md` | `__wallet-standard-lint.ts` dev-only CI predicate against `@solana/wallet-adapter-wallet-standard` |
| 33 | `33_third_party_smoke_matrix_istaken_false.md` | Third-party dApp smoke matrix — Jupiter / MagicEden / Drift / Marinade / pump.fun / Phantom demo |
| 34 | `34_security_review_signoff_istaken_false.md` | §10.4 invariants + `window.solana` shim surface review + redaction proof |

## Source of truth

`../solana-adapter-spec.md` is the canonical spec. These task files are
a projection of it — if anything here disagrees with the spec, the spec
wins. Update the spec first, then update the task.

## Companion docs

- `../dapp-bridge-spec.md` — the docking ports this adapter plugs into
  (read first).
- `../solana-chain-support-spec.md` — first-party primitives this
  adapter consumes (wallet creation, SOL transfer, `SolanaWalletKit`).
  Wallet creation, key derivation, and signer dwell are explicitly
  **out of scope** for this backlog.
- `../wallet-security-vulnerabilities-spec.md` — TWV-2026-070 (Solana
  signer dwell) is the canonical security constraint enforced in every
  signer-touching task.
