# Task 16 — `<PaymentError>` + `constants/paymentErrors.ts`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §9.1 (full error matrix)

## Why this matters

Every error on the scan→pay→settle path shares one visual contract.
Centralising copy + CTAs in one registry means i18n and A/B tests are
one-file changes, and every failure emits a uniform telemetry event.

## Scope

- Create `constants/paymentErrors.ts`:
  ```ts
  export type PaymentErrorCode =
    | "QR_UNRECOGNIZED" | "QR_TAMPERED"
    | "MERCHANT_NOT_ONBOARDED" | "PAN_ALREADY_CLAIMED"
    | "QUOTE_EXPIRED" | "INSUFFICIENT_GATEWAY_BALANCE" | "REQUIRES_DEPOSIT"
    | "SIGNATURE_INVALID" | "NONCE_REUSED" | "AUTHORIZATION_EXPIRED"
    | "CIRCLE_UPSTREAM_ERROR" | "PAYMASTER_UNAVAILABLE"
    | "DEPOSIT_PENDING_ATTESTATION" | "DEPOSIT_FAILED"
    | "CHAIN_RPC_UNREACHABLE" | "WALLET_NAMESPACE_MISMATCH"
    | "XENDIT_PAYOUT_DECLINED" | "XENDIT_PAYOUT_LIMIT_EXCEEDED"
    | "INTENT_EXPIRED" | "SCAN_PERMISSION_DENIED" | "NETWORK_OFFLINE";

  export interface PaymentErrorDef {
    code:    PaymentErrorCode;
    title:   string;
    body:    string;
    primary: { label: string; action: PrimaryAction };
    secondary?: { label: string; action: SecondaryAction };
    autoRecoverable?: true;
  }

  export const PAYMENT_ERRORS: Record<PaymentErrorCode, PaymentErrorDef>;
  ```
  Copy strings verbatim from §9.1 — this file is the source of truth.
- `PrimaryAction` / `SecondaryAction` are string-literal unions the
  `<PaymentError>` component maps to real handlers. Examples:
  `"scan_again" | "retry" | "contact_support" | "open_camera_settings" |
  "deposit_now" | "notify_merchant_whatsapp" | "create_evm_wallet" |
  "refund_request" | "copy_invite_link" | "back"`.
- Create `components/payment/PaymentError.tsx`:
  - Props: `{ code, intentId?, merchantId?, onDismiss }`.
  - Renders icon + title + body + up to two buttons from the def.
  - On mount emits `payment_error_shown` telemetry with
    `{ code, intentId, merchantId }`.
  - Handlers for each action live in a sibling `useActionHandlers.ts` so
    the component stays declarative — handlers that require router or
    deep-linking live there.
- `NativeWind` styling matches the existing `<InfoCard>` / alert aesthetic;
  error tone only (no "warning" variant yet).
- Tests: snapshot the rendered output for every code; action dispatch
  table covered in unit tests on `useActionHandlers`.

## Rules (non-negotiable)

- **No inline strings in UI callers.** Every caller renders
  `<PaymentError code="…" />` — never constructs title/body ad-hoc.
- **Telemetry is automatic on mount.** Do not require callers to emit the
  event themselves.
- **Do not localize yet.** Ship English v1 per spec; wire i18n keys so the
  future translation pass is one file.
- **Copy matches the matrix exactly.** Do not rewrite for "tone" — the
  copy was shipped in the spec.

## Acceptance

- [ ] All 20 rows from §9.1 present in `PAYMENT_ERRORS`.
- [ ] `<PaymentError>` mounts with the right CTA count per code.
- [ ] Telemetry event fires with the expected props.
- [ ] `pnpm check:syntax` passes.
- [ ] Snapshot tests pass.

## Out of scope

- i18n translations (wiring only).
- Toast/inline-error variants — component is the modal/banner form only.
