# Task 23 — Path C: raw x402 fallback

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §5.3, §4.3 item 2, §11 M5

## Why this matters

Unlocks paying arbitrary internet merchants (and agent-initiated purchases,
§8) that aren't in our Nanopayments registry. The signing primitive is
identical to M2 — only the POST destination and the 402 probe differ.

## Scope

- Detector: add `services/paymentIntent/detectors/x402.ts`:
  - Recognises `x402://…` explicitly.
  - Recognises plain `https://…` **only when the source is `paste` or
    `deeplink`** (scanning a QR must not auto-probe arbitrary URLs, §4.3).
  - Returns `{ kind: "x402", resourceUrl }`.
  - Registered at priority `15` (just above EMVCo).
- Create `services/x402/client.ts`:
  - `probe(resourceUrl)` → `fetch(resourceUrl)`; expects 402. Zod-parse the
    `accepts` list from the response body and pick the `exact` scheme that
    matches a chain we can sign on (priority: Base Sepolia in v1).
  - `payAndRetry({ resourceUrl, quote, kit, wallet, chain })`:
    1. `buildAuthorization()` — reuse the task 12 builder. Feed the quote's
       `from/to/value/nonce/validBefore` directly.
    2. `kit.signTransferWithAuthorization(...)` — reuse task 11.
    3. `fetch(resourceUrl, { headers: { "X-PAYMENT": base64(...) } })`.
    4. If status 200 → return the resource body.
    5. If status 402 again → `QUOTE_EXPIRED` / `SIGNATURE_INVALID` per
       facilitator response.
- Extend `app/pay-merchant.tsx`:
  - When `intent.channel.kind === "x402"`:
    - Call `x402Client.probe(resourceUrl)` on mount.
    - Display the facilitator + network + amount like the Nanopay quote.
    - On Pay → `payAndRetry`; success → receipt screen (task 18, with a
      generic "Paid" label — no Xendit line for this path).
- Env: `EXPO_PUBLIC_X402_DEFAULT_FACILITATOR` already in `.env.example`
  (§10). Document inline that the facilitator is chosen by the merchant's
  402 response, not the env default.

## Rules (non-negotiable)

- **Never auto-probe a QR-scanned `https://` URL.** Only explicit
  `x402://` or user-pasted `https://`. Detector must enforce.
- **Signer is the same as Nanopay.** If this ever needs a second signing
  primitive, something is wrong — stop and re-read §5.3.
- **No Xendit branch here.** Path C doesn't disburse fiat; receipts for
  this path only show the x402 resource as "paid".
- **Three-role separation** still holds — user approves amount; wallet
  signs; x402 facilitator is a remote system the server ceded to.

## Acceptance

- [ ] Detector and client both live with unit tests.
- [ ] Manual: paste a CDP x402 demo resource → quote → sign → 200 OK.
- [ ] Scanning a plain `https://example.com` QR does **not** auto-probe —
      shows `QR_UNRECOGNIZED` instead.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Agent-mode x402 (§8 defers to post-v1).
- A custom Arc facilitator (server-side work).
