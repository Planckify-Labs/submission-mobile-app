# WalletConnect v2 — pre-implementation design (TWV-2026-030)

**Owner:** mobile-app · **Spec ref:**
`docs/wallet-security-vulnerabilities-spec.md` TWV-2026-030.

> **Status:** WalletConnect is NOT integrated today. This note captures
> the design rules so the feature lands safely the first time, instead
> of copying a tutorial that defaults to AsyncStorage / v1 fallback.

## Hard rules

| # | Rule |
|---|---|
| 1 | **v2 only.** Import `@walletconnect/sign-client`. v1 pairing URIs (`wc:.+@1?...`) are detected and rejected in the UI with an "outdated WalletConnect link — ask the dApp to upgrade" message. |
| 2 | **SecureStore for session state.** Sessions persist via `signingSecureSet` / `signingSecureGet` — same accessibility attributes as the seed (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`, `requireAuthentication`). No AsyncStorage fallback. SecureStore unavailable → sessions live in memory and die on app close. |
| 3 | **24h expiry cap.** Sessions auto-expire within 24h regardless of WC's longer default. Reconnection requires an explicit user tap; no silent re-approval. |
| 4 | **Sessions Settings screen.** A user-facing list of active sessions — dApp name, icon, URL, per-chain scope, per-method scope, last-seen — with one-tap revoke. Lives at `app/sessions.tsx` (or similar). |
| 5 | **Signer parity.** Every WC signature request routes through `DappBridge.submitAgentIntent` (or equivalent) so the same signer UI, the same nonce / origin pin (TWV-2026-013/015), and the same simulator / claim-mismatch / unknown-spender banners apply. NO bypass path. |
| 6 | **Pairing URI provenance.** A WC URI accepted from a deeplink follows TWV-2026-024's deeplink gate — preview screen mandatory, never auto-pair. |

## Pre-implementation checklist

The integrator MUST tick all of these before opening the feature PR:

- [ ] `package.json` adds `@walletconnect/sign-client` (NOT
      `@walletconnect/client` — that's v1).
- [ ] Session storage adapter implemented over `signingSecureSet` /
      `signingSecureGet` (`services/walletconnect/storage.ts`).
- [ ] 24h expiry enforced both in the storage layer and the UI.
- [ ] `app/sessions.tsx` ships with a one-tap revoke that surfaces
      through the standard bridge approval flow.
- [ ] Parity test: a `personal_sign` from a WC pairing renders the
      same sheet, with the same trusted-UI strip (TWV-2026-064), as
      a `personal_sign` from the in-app dApp browser.
- [ ] `assertOurRdns` is invoked when the wallet identifies itself in
      the WC `proposalNamespaces` reply (TWV-2026-031).

## Review gate

Any PR that integrates WalletConnect MUST cite TWV-2026-030 and
demonstrate every checklist item above. A WC PR landing without
SecureStore session storage is a CVE-2022-28843 regression.
