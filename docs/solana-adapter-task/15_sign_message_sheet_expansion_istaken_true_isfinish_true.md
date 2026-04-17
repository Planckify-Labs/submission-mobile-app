# Task 15 — `SolanaSignMessageSheet` — utf-8 vs base64 + SIWS routing

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §4.3, §10.1.

## Why this matters

Today the scaffolded sheet renders raw base64 bytes regardless of
intent — a human-readable "Sign in to foo.xyz at 2026-04-17" message
looks identical to an opaque Jito-style payload. Auto-detecting
utf-8 and rendering it as text restores the user's ability to read
what they're signing. SIWS-shaped payloads must route through the
SIWS sheet (Task 09) instead — `signMessage` is a fallback for
dApps that haven't migrated.

## Scope

- `components/dapps-browser/approvals/SolanaSignMessageSheet.tsx` —
  expand from scaffold:
  - Renders `payload.display === "utf8"` as plain text; `"base64"`
    as monospace with a "show raw" expander.
  - Copy-to-clipboard on the base64 form (never the decoded utf-8 —
    prevents replay paste attacks that tamper with invisible
    characters).
  - Domain / origin row per standard approval chrome.
  - `<RiskBanner>` consumes inspector annotations.
- `services/chains/solana/SolanaAdapter.ts::makeSignMessageIntent`:
  - Attempt utf-8 decode of the payload bytes. If valid utf-8 AND
    printable (no control chars beyond `\n`, `\r`, `\t`):
    `display: "utf8"`. Else `display: "base64"`.
  - **Heuristic SIWS detection** — if `display: "utf8"` AND first
    line matches `^[\w.-]+ wants you to sign in with your Solana
    account:$`: **do not open `SolanaSignMessageSheet`**. Return an
    annotation pointing the caller at `solana:signIn` and proceed
    with the message sheet (legacy dApps still work). Add a `warn`:
    "Prefer the Wallet Standard signIn feature for domain pinning".

## Rules (non-negotiable)

- **Copy-to-clipboard is base64 only.** Invisible-character tamper
  protection. Never paste the decoded utf-8 — invisible Unicode
  (ZWSP, RTL override) would change the hash.
- **Utf-8 decode failure → base64 render, not an error.** Many
  dApps sign raw bytes (nonce challenges); these should render as
  `"base64"` with a muted "opaque payload" label.
- **SIWS heuristic does not reject.** Legacy SIWS over
  `signMessage` must still work — we annotate, do not block.

## Acceptance

- [ ] Utf-8 message fixture: text renders readably.
- [ ] Random-bytes fixture: base64 renders, clipboard copies base64.
- [ ] Fake SIWS-over-signMessage: warn annotation present.
- [ ] Snapshot test both paths.

## Out of scope

- Real SIWS via `solana:signIn` (Task 09).
- Adapter method routing (Task 04 already dispatches on method
  name).
