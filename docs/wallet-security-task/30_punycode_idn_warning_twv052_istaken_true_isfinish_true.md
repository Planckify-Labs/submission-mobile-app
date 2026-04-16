# Task 30 — Punycode rendering + IDN-homograph warning in URL bar

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-052, §7, §9

## Why this matters

Homograph domains (Cyrillic `а`/`е`/`о` for Latin `a`/`e`/`o`, mixed
scripts like `ùniswap.org`) can be visually indistinguishable from
legitimate dApps. ScamSniffer reports `xn--uniswap-...` homographs
repeatedly across 2023–2025. Users sign Permit2 / `setApprovalForAll`
believing they are on the real site. The URL bar in `components/
dapps-browser/BrowserAddressBar` and the signer-UI origin display must
render punycode or warn prominently whenever the origin contains
non-ASCII characters.

Live exposure: `app/dapps-browser.tsx` feeds the raw `navState.url`
reported by `onNavigationStateChange` straight into `addressBarText` /
`BrowserAddressBar` with zero normalisation, and tags bridge messages
with `browserState.url` as the origin — so a homograph host renders
verbatim in both the URL bar and downstream signer prompts.

## Scope

- Add a URL-rendering helper (new `components/dapps-browser/url-
  renderer.ts` or similar — see spec §9) that:
  - Detects non-ASCII characters in the host.
  - Applies Chromium's IDNA2008 single-script rule; multi-script
    hosts are flagged.
  - Returns `{display, punycode, warning}` where `warning` is one of
    `"ok" | "multi-script" | "confusable"`.
- Update `BrowserAddressBar` (and the `addressBarText` state path in
  `app/dapps-browser.tsx`) to render in punycode (ASCII) for any
  flagged host, with a banner "This URL contains unusual characters
  that may impersonate another site" and the ASCII form shown
  prominently. Also normalise the `origin` string attached to bridge
  messages in `handleMessage` so downstream signer prompts receive
  the ASCII form.
- For Permit / `setApprovalForAll` signatures, always display the
  ASCII-normalised origin alongside the decoded Unicode form,
  regardless of the flag state.
- Add a cross-check against the known-dApp registry (if the
  Unicode-normalised host matches a top-1000 dApp AND this is the
  first visit): hard-warn before any signature.

## Rules (non-negotiable)

- Punycode is the authoritative display for flagged hosts — never
  fall back to the rendered Unicode without the warning banner.
- Signer-UI origin display always shows the ASCII form for any
  signature prompt, even on the happy path.
- The renderer must be pure + unit-testable (no React, no network).

## Acceptance

- [ ] Unit tests cover:
  - Pure-ASCII host → `warning: "ok"`.
  - Single-script non-Latin (e.g., Cyrillic-only) → `warning:
    "ok"` with punycode display.
  - Multi-script (Latin + Cyrillic) → `warning: "multi-script"`.
  - Known confusable spellings of top dApps → `warning:
    "confusable"`.
- [ ] The dApp-browser URL bar renders punycode + banner on a test
      host like `xn--uniswap-example`.
- [ ] Signer-UI origin display always includes the ASCII form for
      Permit / `setApprovalForAll` prompts.
- [ ] Regression: pure-ASCII navigation unchanged.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- A full managed top-1000 dApp registry (ships as a static JSON;
  updates are out-of-scope here).
- Server-side homograph detection / reputation scoring.
- Automatic navigation refusal (we warn, we do not block).
