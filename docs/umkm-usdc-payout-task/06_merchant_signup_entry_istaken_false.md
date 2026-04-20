# Task 06 — Merchant signup entry point

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §1.1.1 steps 1–2

## Why this matters

UMKM are mobile-first. We ship merchant onboarding in the same app the payer
uses, on one auth principal — that means a prominent "Register as Merchant"
entry on `app/login.tsx` and a `signup-intro.tsx` fork that asks the defining
question: *do you already have a QRIS sticker?* Everything in M1.5 branches
off this one screen.

## Scope

- Edit `app/login.tsx`: add a second primary button **"Register as
  Merchant"** with equal visual weight to "Sign in as Payer." Button routes
  to `/merchant/signup-intro`. Do not alter the existing payer sign-in path.
- Create `app/merchant/signup-intro.tsx` per §1.1.1 step 2:
  - Headline "Do you have a QRIS sticker?"
  - Primary CTA `📷 Scan my QRIS` → `/merchant/qris-scan` (task 07).
  - Secondary "No QRIS yet — enter manually" → `/merchant/signup-form`
    (task 08) with empty state.
- Add the routes under `app/merchant/_layout.tsx`. The layout mirrors the
  existing onboarding layout style (header, back button).
- Zero auth coupling: a user who has a payer session can still enter merchant
  signup — the flow creates/links the merchant profile to their existing
  wallet per §1.1.1.

## Rules (non-negotiable)

- **Same auth principal.** Do not create a separate user record; merchant
  signup writes to `merchant.*` keyed by the existing user id.
- **No wallet creation yet.** Wallet is "silently created in the background"
  **only** by task 08 on form submit.
- **Equal-weight buttons on login.** Product decision per §1.1.1 — do not
  demote one to a text link.

## Acceptance

- [ ] `app/login.tsx` shows both CTAs, visually balanced (both primary
      style, matching vertical rhythm).
- [ ] `app/merchant/signup-intro.tsx` renders the fork and routes correctly
      in both directions.
- [ ] `app/merchant/_layout.tsx` exists with the standard back-header.
- [ ] `pnpm check:syntax` + `pnpm lint` pass.
- [ ] Manual smoke: fresh install, tapping "Register as Merchant" lands on
      the intro; scan-CTA and manual-CTA each reach the next stubbed screen
      without error.

## Out of scope

- QRIS scan UI (task 07) and signup form (task 08).
- The merchant home screen / printable QR (task 09).
