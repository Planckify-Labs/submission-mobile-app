# Wallet Features — Task Backlog

This folder contains engineering tasks derived from `../wallet-features-spec.md`.
Each file represents one discrete unit of work from the spec's §6 phased rollout.

## Filename convention

```
{NN}_{task_name}_istaken_{true|false}[_isfinish_true].md
```

- `NN` — two-digit sequential task number (starts at 31, continuing from `eth-wallet-std-task/`)
- `task_name` — short snake_case label
- `istaken_true` / `istaken_false` — whether an engineer is actively working on it
- `_isfinish_true` — appended as a **postfix** once the task is complete.
  A file without this postfix is not yet finished.

Three possible states:

| State | Filename pattern |
|---|---|
| Not started | `31_indexer_abstraction_istaken_false.md` |
| In progress | `31_indexer_abstraction_istaken_true.md` |
| Finished    | `31_indexer_abstraction_istaken_true_isfinish_true.md` |

## Workflow

1. Browse the tasks, pick one that ends with `istaken_false.md`.
2. Claim it by renaming `istaken_false` → `istaken_true`:
   ```
   git mv 31_indexer_abstraction_istaken_false.md 31_indexer_abstraction_istaken_true.md
   ```
3. Work on the task. Read the referenced sections of `../wallet-features-spec.md` —
   each task file excerpts only the minimum context needed.
4. When the task is complete and merged, append the `_isfinish_true`
   postfix — do NOT flip `istaken` back to `false`:
   ```
   git mv 31_indexer_abstraction_istaken_true.md 31_indexer_abstraction_istaken_true_isfinish_true.md
   ```
   Finished files stay in the folder as a durable record of what shipped.
5. If you abandon a task mid-flight, rename it back to `istaken_false.md`
   (without the `isfinish_true` postfix) so someone else can pick it up.

## Phase ordering

Tasks are numbered by the phase they belong to in the spec. **Do not start a
later phase before the previous phase's exit criteria are green.**

- **Phase A** (tasks 31–38) — Portfolio + history foundation.
- **Phase B** (tasks 39–45) — NFT + ENS + contacts.
- **Phase C** (tasks 46–53) — Security + app lock.
- **Phase D** (tasks 54–57) — WalletConnect + deep links + QR.
- **Phase E** (tasks 58–62) — Swap + L2 + staking display.
- **Phase F** (tasks 63–66) — Push notifications + polish.

## Prerequisites

This spec builds on the bridge spec (`../dapp-bridge-spec.md`). Phase A can
start in parallel with bridge Phase 1b, since it only needs the `DappBridge`
plumbing from Phase 1a. See `wallet-features-spec.md` §10 for the full
dependency table.

## Task map

### Phase A — Portfolio + history foundation

| # | File | Title |
|---|---|---|
| 31 | `31_indexer_abstraction_istaken_false.md` | `IndexerProvider` interface + `AlchemyProvider` + SQLite cache |
| 32 | `32_token_balances_autodiscovery_istaken_false.md` | Token balances with auto-discovery + spam filtering |
| 33 | `33_token_prices_portfolio_istaken_false.md` | Token price feeds + portfolio aggregation UI |
| 34 | `34_transaction_history_istaken_false.md` | Transaction history indexing + decoded types |
| 35 | `35_pending_tx_tracker_istaken_false.md` | Pending tx tracker + speed-up / cancel flows |
| 36 | `36_rpc_multi_provider_istaken_false.md` | RPC multi-provider failover + health monitoring |
| 37 | `37_multicall_batching_istaken_false.md` | Multicall3 batching for `balanceOf` aggregation |

### Phase B — NFT + ENS + contacts

| # | File | Title |
|---|---|---|
| 38 | `38_nft_gallery_istaken_false.md` | NFT gallery: indexer integration + grid UI + metadata resolution |
| 39 | `39_nft_detail_transfer_istaken_false.md` | NFT detail screen + send NFT flow + ERC-6551 TBA detection |
| 40 | `40_ens_resolution_istaken_false.md` | ENS forward + reverse resolution + avatar + CCIP-read |
| 41 | `41_ens_integration_istaken_false.md` | ENS in send flow, approval sheets, address bar, history |
| 42 | `42_address_book_istaken_false.md` | Address book CRUD + send-flow autocomplete + auto-suggest |

### Phase C — Security + app lock

| # | File | Title |
|---|---|---|
| 43 | `43_app_lock_biometric_pin_istaken_false.md` | Biometric / PIN lock: setup, triggers, per-action re-auth |
| 44 | `44_address_poisoning_detection_istaken_false.md` | Address-poisoning detection in history + send flow |
| 45 | `45_token_spam_expanded_istaken_false.md` | Expanded spam filtering: phishing names, honeypot, quarantine |
| 46 | `46_seed_key_export_istaken_false.md` | Seed phrase re-export + private key export (screenshot-guarded) |
| 47 | `47_cloud_backup_wipe_istaken_false.md` | Cloud backup (encrypted, opt-in) + wipe wallet |
| 48 | `48_approval_management_revoke_istaken_false.md` | Token approval list + revoke + batch revoke + stale detection |

### Phase D — WalletConnect + deep links + QR

| # | File | Title |
|---|---|---|
| 49 | `49_walletconnect_v2_istaken_false.md` | WalletConnect v2 transport + session management UI |
| 50 | `50_deep_links_eip681_istaken_false.md` | Deep link handling: EIP-681, WC URIs, custom schemes |
| 51 | `51_qr_scanner_istaken_false.md` | QR scanner: addresses, ENS, EIP-681, WC URIs |

### Phase E — Swap + L2 + staking

| # | File | Title |
|---|---|---|
| 52 | `52_in_app_swap_istaken_false.md` | In-app swap: aggregator routing + approval sheet flow |
| 53 | `53_cross_chain_swap_mev_istaken_false.md` | Cross-chain swap (LI.FI/Socket) + MEV protection |
| 54 | `54_l2_withdrawal_tracking_istaken_false.md` | L2 withdrawal tracking + L1 data fee + sequencer health |
| 55 | `55_staking_positions_istaken_false.md` | Staking positions: native ETH, LSTs, ERC-4626 vaults |

### Phase F — Push notifications + polish

| # | File | Title |
|---|---|---|
| 56 | `56_local_notifications_istaken_false.md` | Local notifications: tx confirmed/failed, approval detected |
| 57 | `57_remote_notifications_backend_istaken_false.md` | Remote notifications + backend FCM/APNs gateway |
| 58 | `58_notification_settings_istaken_false.md` | Notification settings screen + per-channel toggles + price alerts |

### Platform integration tasks (separated)

These tasks require external service setup, API keys, or backend work.
They are separated from code tasks so code development can proceed with
interfaces and fallbacks while platform decisions are finalized.

| # | File | Title | Blocks |
|---|---|---|---|
| P1 | `P1_indexer_provider_impl_istaken_false.md` | Indexer provider implementation (Alchemy / self-hosted / other) | Tasks 32–34, 38, 48 (full data) |
| P2 | `P2_walletconnect_project_istaken_false.md` | WalletConnect Cloud project registration | Task 49 |
| P3 | `P3_firebase_push_notifications_istaken_false.md` | Firebase project + FCM/APNs push setup | Task 57 |
| P4 | `P4_rpc_provider_keys_istaken_false.md` | RPC provider API keys + remote config | Task 36 (full failover) |
| P5 | `P5_swap_aggregator_backend_istaken_false.md` | Swap aggregator backend endpoint (takumipay-api) | Tasks 52, 53 |

**Note:** Code tasks can proceed without platform tasks by using `DirectRPCProvider`
(fallback) and mock/stub implementations. Platform tasks unlock full functionality.

## Source of truth

`../wallet-features-spec.md` is the canonical spec. These task files are a
projection of it — if anything here disagrees with the spec, the spec wins.
Update the spec first, then update the task.
