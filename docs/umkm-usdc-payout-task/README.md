# UMKM USDC → SEA Fiat Payout — Task Backlog

This folder contains engineering tasks derived from `../umkm-usdc-payout-spec.md`.
Each file represents one discrete unit of work from the spec's §11 milestone
plan and the §4–§10 implementation surfaces.

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
| Not started | `01_payment_intent_types_istaken_false.md` |
| In progress | `01_payment_intent_types_istaken_true.md` |
| Finished    | `01_payment_intent_types_istaken_true_isfinish_true.md` |

## Workflow

1. Browse the tasks, pick one that ends with `istaken_false.md`.
2. Claim it by renaming `istaken_false` → `istaken_true`:
   ```
   git mv 01_payment_intent_types_istaken_false.md 01_payment_intent_types_istaken_true.md
   ```
3. Work on the task. Read the referenced sections of
   `../umkm-usdc-payout-spec.md` — each task file excerpts only the minimum
   context needed.
4. When the task is complete and merged, append the `_isfinish_true` postfix —
   do NOT flip `istaken` back to `false`:
   ```
   git mv 01_payment_intent_types_istaken_true.md 01_payment_intent_types_istaken_true_isfinish_true.md
   ```
   Finished files stay in the folder as a durable record of what shipped.
5. If you abandon a task mid-flight, rename it back to `istaken_false.md`
   (without the `isfinish_true` postfix) so someone else can pick it up.

## Milestone ordering

Tasks are numbered by the milestone they belong to in the spec (§11).
**Do not start a later milestone before the previous milestone's exit
criteria are green.**

- **M1** (tasks 01–05) — Normalization layer. No networking, no chain writes.
- **M1.5** (tasks 06–09) — Merchant onboarding shell (additive; ships alongside M1).
- **M2** (tasks 10–15) — Nanopayments core (the default gasless rail).
- **M3** (tasks 16–18) — Xendit payout UX + error matrix.
- **M4** (tasks 19–22) — Gateway deposit + Circle Paymaster wrap.
- **M5** (tasks 23–25) — x402 + direct-on-Arc fallback paths.

Agent mode (§8), multi-country expansion (§12 Q3), and `MerchantTreasury.sol`
(§7) are intentionally not yet broken into tasks — they live beyond v1.

## Task map

### M1 — Normalization / routing layer (§4)

| # | File | Title |
|---|---|---|
| 01 | `01_payment_intent_types_and_detector_registry_istaken_false.md` | `PaymentIntent` / `PayChannel` types + `Detector` registry + `classify()` |
| 02 | `02_wallet_detectors_istaken_false.md` | Wallet address + wallet URI detectors (EVM, Solana, EIP-681) |
| 03 | `03_emvco_qris_detector_istaken_false.md` | EMVCo TLV parser + CRC-16 + QRIS detector |
| 04 | `04_takumipay_jws_detector_istaken_false.md` | TakumiPay signed-QR detector (ES256 via `jose`) |
| 05 | `05_scan_to_pay_router_integration_istaken_false.md` | Wire `classify()` into `app/scan-to-pay.tsx` + `switchToScannedTarget` + `/pay-merchant` stub |

### M1.5 — Merchant onboarding shell (§1.1.1)

| # | File | Title |
|---|---|---|
| 06 | `06_merchant_signup_entry_istaken_false.md` | "Register as Merchant" button on `app/login.tsx` + `signup-intro.tsx` fork |
| 07 | `07_merchant_qris_scan_step_istaken_false.md` | "Scan my QRIS" flow — reuse EMVCo decoder + sticker photo capture |
| 08 | `08_merchant_signup_form_istaken_false.md` | `signup-form.tsx` — channel picker, polymorphic account field, POST `/v1/merchants/signup` |
| 09 | `09_merchant_qr_home_screen_istaken_false.md` | `app/merchant/qr.tsx` — JWS QR render, save-to-photos, share sheet |

### M2 — Nanopayments core (§5.2, §5.5)

| # | File | Title |
|---|---|---|
| 10 | `10_arc_testnet_chain_config_istaken_false.md` | Add Arc Testnet entry to `chainConfig.ts` + env wiring |
| 11 | `11_wallet_kit_sign_eip3009_istaken_false.md` | `WalletKitAdapter.signTransferWithAuthorization` (EVM kit) |
| 12 | `12_nanopay_build_authorization_istaken_false.md` | Pure `buildAuthorization()` — EIP-712 typed-data + zod schemas |
| 13 | `13_nanopay_submit_authorization_istaken_false.md` | `submitAuthorization()` — POST proxy + attestation handling |
| 14 | `14_use_payment_intent_query_istaken_false.md` | `usePaymentIntent` TanStack Query hook (status polling) |
| 15 | `15_pay_merchant_screen_istaken_false.md` | `/pay-merchant` end-to-end: quote → confirm → sign → attestation |

### M3 — Xendit payout UX (§6.3, §9.1)

| # | File | Title |
|---|---|---|
| 16 | `16_payment_error_component_istaken_false.md` | `<PaymentError>` + `constants/paymentErrors.ts` (full error-code matrix) |
| 17 | `17_merchant_channels_hook_istaken_false.md` | `useMerchantChannels(country)` — fetched ranked list, no client-side sort |
| 18 | `18_receipt_and_status_screen_istaken_false.md` | Receipt screen + live `SETTLED → PAID_OUT` invalidation + FCM banner |

### M4 — Gateway deposit + Circle Paymaster (§5.4, §5.5)

| # | File | Title |
|---|---|---|
| 19 | `19_wallet_kit_paymaster_userop_istaken_false.md` | `WalletKitAdapter.sendUserOpWithUsdcPaymaster` (EVM kit, `permissionless`) |
| 20 | `20_gateway_deposit_service_istaken_false.md` | `services/nanopay/gatewayDeposit.ts` — UserOp + plain-tx fallback |
| 21 | `21_gateway_deposit_onboarding_screen_istaken_false.md` | `/onboarding/nanopay-deposit` one-time screen |
| 22 | `22_deposit_receipt_polling_istaken_false.md` | `POST /v1/pay/intents/:id/deposit-receipt` + attestation polling + re-arm `/pay-merchant` |

### M5 — Fallback paths (§5.1, §5.3, §5.6)

| # | File | Title |
|---|---|---|
| 23 | `23_x402_fallback_path_istaken_false.md` | Path C — raw x402 `fetch → 402 → sign → refetch` reusing the M2 signer |
| 24 | `24_direct_on_arc_path_istaken_false.md` | Path A — direct ERC-20 `transfer` on Arc (tokenized `WalletKitAdapter` write) |
| 25 | `25_pay_executor_path_selector_istaken_false.md` | `PayExecutor` path selector (§5.6) unifying A / B / C |

## Source of truth

`../umkm-usdc-payout-spec.md` is the canonical spec. These task files are a
projection of it — if anything here disagrees with the spec, the spec wins.
Update the spec first, then update the task.
