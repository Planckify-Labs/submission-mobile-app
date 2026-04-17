# Task 08 — `siws.ts` — SIWS ABNF message builder

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §4.8, §10.2, §10.4 inv 9.

## Why this matters

Sign In With Solana is EIP-4361-derived but has Solana-specific
canonicalisation — Phantom's reference vectors are the only ground
truth. Building the message string wrong silently breaks SIWS-gated
dApps (Drift onboarding, Magic Eden app-login); they validate the
signature over a server-reconstructed canonical string and reject
ours. Landing the builder + vectors first lets the signer (Task 09)
and inspector (Task 09) consume a proven serializer.

## Scope

- `services/chains/solana/siws.ts`:
  - `buildSiwsMessage(input: SolanaSignInPayload): string` — returns
    the canonical ABNF string per `phantom/sign-in-with-solana`
    reference.
  - Omit fields the input does not supply ("the wallet must
    determine"). Matches Phantom's behavior — do not invent values.
  - `parseSiwsMessage(message: string): SolanaSignInPayload` —
    round-trip inverse, used for sanity tests.
  - Both sides share `SIWS_FIELD_ORDER` and line-ending discipline
    (`\n` not `\r\n`).
- `siws.test.ts` — fixture vectors from Phantom's reference repo:
  - Minimal input (domain only).
  - Full input (every optional field set).
  - `resources` array with ≥2 entries.
  - Round-trip assertion `parseSiwsMessage(buildSiwsMessage(x))` === x.

## Rules (non-negotiable)

- **Never invent fields.** If `input.statement` is missing, the line
  is omitted — not rendered as an empty string. Invariant mirrored
  from Phantom.
- **Line endings are `\n`.** Signed bytes must match what the dApp
  verifies; a stray `\r\n` changes the hash.
- **No trailing whitespace.** Canonical serialiser trims every line.
- **`expirationTime` ≤ `issuedAt` → throw.** Builder rejects
  impossible values so the caller (inspector) can surface the
  `-32602` cleanly. Invariant 9.

## Acceptance

- [ ] Phantom reference vectors produce byte-exact output.
- [ ] Round-trip parse → build → same string.
- [ ] `pnpm run test -- siws` passes.

## Out of scope

- Domain validation / homograph check (Task 09 inspector).
- Signing the bytes (Task 09 signer extension).
