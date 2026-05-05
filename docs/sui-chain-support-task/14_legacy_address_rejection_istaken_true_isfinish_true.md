# Task 14 — Pre-flight migration check: reject legacy 20-byte addresses in send sheet

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-chain-support-spec.md` §3.5.

## Why this matters

Pre-mainnet Sui addresses were 20 bytes; current addresses are 32 bytes
computed from `BLAKE2b-256(flag || pubkey)`. We **only generate v1
(32-byte) addresses** and accept only 32-byte hex addresses on send. If
a user pastes a legacy 20-byte address as the recipient, the transfer
would either fail silently in the SDK or — worse — succeed against a
chain-side derivation that loses funds. This task lands the pre-flight
guard with a typed error and a UX string pointing at Sui's migration
runbook.

## Scope

- `utils/walletUtils.ts`:
  - `isValidSuiAddress` (Task 06) already rejects 20-byte legacy
    addresses by length — confirm the existing predicate. This task
    adds explicit detection so we can render a *helpful* error instead
    of a generic "invalid address".
  - Add `isLegacySui20ByteAddress(input: string): boolean` —
    matches `0x` + 40 hex chars (20 bytes), distinct from the 32-byte
    canonical form. Used by the send sheet to branch error messaging.
- `app/send.tsx` (or the recipient-validation hook the send screen
  uses — verify with `grep -rn 'validateAddress' app/`):
  - When `kit.namespace === "sui"` and the user pastes a recipient:
    1. Call `isValidSuiAddress(input)` — if true, accept.
    2. Else call `isLegacySui20ByteAddress(input)` — if true, surface
       `InvalidSuiAddressLegacyError` (declared in Task 07) with the
       UX string: "This looks like a pre-mainnet (20-byte) Sui
       address. The current Sui network uses 32-byte addresses; ask
       the recipient to send you their up-to-date address."
    3. Else surface the generic invalid-address error.
- Tests in `walletUtils.test.ts`:
  - `isLegacySui20ByteAddress` accepts only 20-byte hex; rejects
    32-byte canonical, mixed-case, missing `0x`, non-hex.
- Send-sheet integration test — paste 20-byte input → typed error
  surfaced; paste 32-byte canonical → accepted.

## Rules (non-negotiable)

- **No on-chain "balance migration" call.** That's a fullnode-side
  concern handled automatically once the user lands on a current-format
  address. Do not invent a migration RPC.
- **Typed error surfaces a helpful message — not a stack trace.** The
  UX string is part of the spec contract. Localisation can come later;
  the English string lives in this task's PR.
- **Detection-only — no auto-conversion.** Never attempt to "upgrade"
  a 20-byte address to a 32-byte one. The mapping is not 1:1 and
  guessing would lose funds.
- **Legacy detection runs only in send-recipient validation.** Do not
  add it to wallet creation paths — Tasks 03 and 06 already enforce
  32-byte derivation.

## Acceptance

- [ ] `isLegacySui20ByteAddress` exported and tested.
- [ ] Send sheet renders the migration message for 20-byte inputs.
- [ ] Send sheet rejects all other invalid inputs with the generic
      message.
- [ ] Manual smoke: paste a known 20-byte address (synthetic — generate
      a 20-byte hex string for the test); confirm UX path. Paste a
      valid 32-byte address; confirm transfer proceeds.
- [ ] **`app/send.tsx` dispatch verification (spec §3.3, §8.2):**
      confirm the send sheet routes through `walletKitRegistry.get
      (activeChain.namespace)` for `parseNativeAmount`,
      `formatNativeAmount`, `sendNativeTransfer` with no
      `namespace === "sui"` branches added at the screen layer. Decimal
      handling for SUI (9 decimals) round-trips through the kit's
      string-parsing without a screen-side override.
- [ ] `pnpm check:syntax` passes; `pnpm run test` passes.

## Out of scope

- Migration runbook content — link out to Sui docs; no in-app docs
  page in v1.
- Address-book sanitisation for existing entries (out of scope; users
  imported addresses pre-launch).
- SuiNS resolution (deferred per spec §13).
