# Task 19 — Per-session nonce + origin check on injected provider

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-015, §7, §9

## Why this matters

`RNCWebViewBridge.postMessage` is accessible from every frame inside a
WebView by default. A sandboxed third-party ad iframe embedded in a dApp
page could call `postMessage` with a forged EIP-1193 payload and cause the
wallet to display a signature prompt the user attributes to the top-level
dApp. There is no origin information on `postMessage` — without a per-page
nonce and a native-side origin cross-check, the bridge cannot tell which
frame sent the message. This complements task 18 (TWV-2026-013); together
they close the sub-frame-forges-signature class.

This is acutely live in `app/dapps-browser.tsx`: `handleMessage`
`JSON.parse`s the raw `e.nativeEvent.data`, stamps the current
top-frame URL onto the message as `origin` (regardless of which frame
actually sent it), and passes it straight to `bridge.dispatch(parsed)`.
Combined with `injectedJavaScriptForMainFrameOnly={false}`, any embedded
iframe gets the provider AND can forge bridge calls that appear to come
from the top-level dApp.

## Scope

- `services/chains/evm/injectedScript.ts` — on each top-frame page load,
  emit a cryptographically random per-session nonce from the native side
  (not generated in JS) and inject it into a closure-scoped variable the
  injected provider signs every outbound message with. Attach the captured
  `window.location.origin` to every message.
- `services/bridge/DappBridge.ts` — reject any inbound bridge message whose
  nonce does not match the nonce issued for the current top-frame page
  load. Rotate the nonce on navigation.
- `app/dapps-browser.tsx` — rework `handleMessage` so it no longer
  unconditionally attaches `browserState.url` as `origin`. Instead, the
  bridge consumes the JS-declared origin already signed with the
  per-session nonce; the native layer only exposes the top-frame origin
  tracked via `onNavigationStateChange` for cross-check.
- Native origin pin — at the moment of message receipt, compare the
  JS-declared origin against the current top-frame origin tracked via
  `onNavigationStateChange` / `onShouldStartLoadWithRequest` (see task 18
  for origin tracking). Mismatch → drop.
- HMAC option — if a simple equality check proves insufficient, sign the
  `(origin, method, paramsHash)` tuple with a per-session HMAC key held on
  the native side and verify on receipt. Key never leaves native.
- Sub-frame suppression — where practical, set `setMixedContentMode=NEVER_ALLOW`
  and rely on `sandbox` iframe attributes in rendered pages to prevent
  cross-frame `postMessage` entirely.

## Rules (non-negotiable)

- The per-session nonce MUST be generated native-side (cryptographic RNG),
  not by the injected JS itself.
- The nonce MUST rotate on every top-frame navigation.
- A message missing the nonce, carrying a stale nonce, or declaring an
  origin that disagrees with the native-tracked top frame MUST be dropped
  silently (no error reply that leaks the control).
- The injected provider MUST NOT expose the nonce on `window` — closure
  scope only.

## Acceptance

- [ ] Native generates a fresh nonce on each top-frame load and delivers it
      via `injectedJavaScript` into a closure.
- [ ] `DappBridge.ts` rejects messages whose nonce is missing / stale.
- [ ] A synthetic test page that calls `postMessage` from a sub-frame
      cannot trigger a signature prompt.
- [ ] Origin mismatch between message-declared origin and
      `onNavigationStateChange` top origin is rejected.
- [ ] Unit tests: valid top-frame call succeeds, sub-frame forgery fails,
      replay of an old nonce fails, navigation rotates the nonce.
- [ ] pnpm check:syntax passes.

## Out of scope

- WebView version gating and prop hardening (task 18, TWV-2026-013).
- EIP-2255 permission store semantics (already shipped per
  `docs/eth-wallet-std-task/12_permission_store_eip2255_*`).
- Removing iframe support from dApp pages (dApp's choice).
