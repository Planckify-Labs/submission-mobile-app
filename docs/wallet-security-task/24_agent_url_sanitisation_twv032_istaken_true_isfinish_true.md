# Task 24 — Agent output URL sanitisation + external-link dialog

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-032, §7, §9

## Why this matters

Electrum 3.3.3 lost ~$937k in Dec 2018 because Sybil-attack servers
returned RPC error strings that the client rendered as rich HTML with
clickable links to malware "updates". TakumiAI has three equivalent
surfaces: the agent (`components/home/TakumiAgent/`) can produce URLs in
chat output, the dApp-browser URL bar can be pre-filled from push /
deeplink, and WalletConnect `peerMeta.name` / `peerMeta.url` strings come
from the relay. The spec names `services/bridge/redact.ts` as a candidate
site for the outbound-rendering helper.

## Scope

- `components/home/TakumiAgent/` — agent chat renderer must strip all
  URLs from model output before display, then re-insert them as
  sanitised tokens. Never render raw Markdown or HTML from the model.
  Use plain-text `<Text>` for model strings; autolink is disabled.
- Sanitised URL token — when tapped, route through a confirmation dialog
  that shows the full URL, the domain, and a warning when the domain is
  not on the app's allowlist. Only after explicit user tap does the URL
  reach `Linking.openURL`. See spec §6 TWV-2026-032.
- Domain allowlist — maintain a short list of known-safe domains (project
  site, docs, block explorers already allowlisted by task 13 /
  TWV-2026-049). Non-allowlisted domains render the warning dialog.
- `services/bridge/redact.ts` — extend to cover outbound-rendered strings
  (the spec §6 applicability note). Every server-supplied string rendered
  in critical UI must route through this helper.
- WalletConnect / push / bridge metadata — `peerMeta.name`, `peerMeta.url`,
  push body, and any server-supplied error string render as plain text,
  never auto-open, never auto-link.
- dApp-browser URL bar — never pre-fill the URL bar from a push or
  deeplink without a confirmation tap. Entering a URL remains an explicit
  user action.

## Rules (non-negotiable)

- No server-supplied string renders as Markdown or HTML in critical UI.
- Every tappable URL in agent output, WalletConnect metadata, push, or
  in-app error must pass through the confirmation dialog.
- `Linking.openURL` is called from exactly one helper path; direct calls
  from agent / push / WalletConnect code are forbidden.
- Allowlist entries are reviewed; new entries require a PR.

## Acceptance

- [ ] Agent chat renders model output as plain text; URLs are extracted
      and rendered as sanitised tokens.
- [ ] Tapping a sanitised URL opens the confirmation dialog with full URL
      and domain; non-allowlisted domains show the warning banner.
- [ ] `services/bridge/redact.ts` exposes an outbound-string sanitiser and
      is used by WalletConnect metadata / push / bridge error renderers.
- [ ] dApp-browser URL bar does not auto-populate from a deeplink or push
      payload.
- [ ] Unit tests cover: model output with mixed Markdown, URL extraction,
      allowlist hit, allowlist miss, `javascript:` / `data:` URL rejected.
- [ ] pnpm check:syntax passes.

## Out of scope

- Live scam-domain feed (task 29, TWV-2026-051).
- Punycode / IDN-homograph warning (task 30, TWV-2026-052).
- Signed push notifications (task 31, TWV-2026-054).
