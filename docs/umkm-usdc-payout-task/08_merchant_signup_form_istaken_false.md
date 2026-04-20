# Task 08 — Merchant signup form

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §1.1.1 step 3, §6.0
(`ChannelDescriptor`), §6.1 (`MerchantSignupRequest`, `MerchantProfile`),
§9.1 (`PAN_ALREADY_CLAIMED`)

## Why this matters

One form, two paths (scan-prefilled vs. blank). The form drives the whole
merchant side of the product — it's where the user commits their payout
destination, which then powers every Xendit disbursement in M3.

## Scope

- Create `app/merchant/signup-form.tsx` with React Hook Form + zod:
  - Fields per §1.1.1 step 3 table: `displayName`, `contactPhone` (E.164),
    `channelCode`, `accountNumber` (polymorphic), `accountHolderName`.
  - **Scan-path params** pre-fill `displayName`, `qrisPan`, `country`,
    `stickerPhotoUri`; manual path leaves them blank.
- Channel picker consumes task 17's `useMerchantChannels("ID")`. Rendered
  in server-returned order (no client sort — memory
  `feedback_filter_at_source.md`).
- Polymorphic `accountNumber` field: when picked channel `kind === "ewallet"`
  → phone keyboard + "+62…" prefix hint; when `kind === "bank"` → numeric
  keyboard with `digits:<n>` length hint. Switches on channel change.
- `"Same as my WhatsApp number"` checkbox appears **only** for e-wallet
  channels and copies digits; both fields remain independent in storage.
- Submit flow:
  1. If the user doesn't yet have a wallet, call the existing wallet-creation
     service silently (same auth principal). No seed phrase UI — merchant
     onboarding treats the wallet as plumbing.
  2. Upload `stickerPhotoUri` if present → receive `stickerPhotoKey`.
  3. `POST /v1/merchants/signup` with the `MerchantSignupRequest` shape
     from §6.1.
  4. On `201` → `router.replace("/merchant/qr")` (task 09).
  5. On `409 PAN_ALREADY_CLAIMED` → inline error per §9.1 error matrix.
  6. On other errors → toast + keep the form state.
- Add "Linked QRIS" readonly card below the form on the scan path (sticker
  photo thumbnail + last-4 of PAN + acquirer label). Manual path shows the
  muted "Not linked · Link later in Settings" variant.

## Rules (non-negotiable)

- **Single POST principle.** All five fields + optional `qrisLink` ship in one
  request. Do not split into sequential calls.
- **Polymorphic field validation happens at submit, not on keystroke**, to
  avoid jumpy UX when the user hasn't picked a channel yet.
- **Never display `accountNumber` fully after submit** — the `MerchantProfile`
  only echoes last-4 (§6.1). Treat it as write-only.
- **Zod at the boundary.** Every request/response parsed with zod
  (memory conventions — zod on `takumipay-api` responses).
- **DTO pattern** (skill `use-dto-pattern`): the form component receives a
  single `MerchantSignupInitialValues` object, not six separate props.

## Acceptance

- [ ] Form renders on both paths; channel change re-renders the
      `accountNumber` field with the right keyboard/length hint.
- [ ] Successful submit lands on `/merchant/qr` with the returned profile.
- [ ] 409 path shows the `PAN_ALREADY_CLAIMED` copy from the error matrix.
- [ ] No client-side sort of `MerchantChannelsResponse`.
- [ ] `pnpm check:syntax` + `pnpm lint` pass.
- [ ] `pnpm jest` covers: polymorphic validation switch, WhatsApp-copy
      checkbox behavior, zod reject of malformed E.164.

## Out of scope

- Multi-country expansion (§12 Q3 defers).
- Returning-merchant edit flow (`PATCH /v1/merchants/me`) — deferred to
  post-M3 settings screen.
