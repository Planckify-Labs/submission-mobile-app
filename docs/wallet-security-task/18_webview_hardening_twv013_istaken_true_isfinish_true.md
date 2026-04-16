# Task 18 — WebView hardening: min system version, origin pin

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-013, §7, §9

## Why this matters

CVE-2020-6506 is a universal XSS in Android WebView <83.0.4103.106 where a
cross-origin iframe could execute JS in the top-level document. In the
TakumiAI dApp browser, a phishing page embedding a legitimate-looking site
could read the injected EIP-1193 provider, call `eth_requestAccounts`, and
trigger signatures as if it were the legitimate origin. The wallet today
assumes the top-frame origin is the requester, but message-bridge calls can
come from any frame. Controls live in `app/dapps-browser.tsx` (the in-app
browser entry, analogous to a wallet-extension-hosted browser),
`components/dapps-browser/`, `services/chains/evm/injectedScript.ts`,
`services/bridge/DappBridge.ts`, and the inspector classes under
`services/bridge/inspectors/`.

Concrete exposures in `app/dapps-browser.tsx` today: no `originWhitelist`
prop (so `http://` and `file://` load), `thirdPartyCookiesEnabled` and
`sharedCookiesEnabled` both true, no system-WebView-version check, and
`injectedJavaScriptForMainFrameOnly={false}` — so the EIP-1193 provider
is installed in every iframe including cross-origin ads.

## Scope

- `app/dapps-browser.tsx` — at WebView mount, read the system WebView
  version (Android: `WebSettings.getDefaultUserAgent` or equivalent runtime
  probe) and refuse to load dApps if < 83.0.4103.106. Show a blocking
  upgrade screen instead.
- `app/dapps-browser.tsx` WebView props — keep `setSupportMultipleWindows={false}`,
  add `originWhitelist={['https://*']}` (no `http`, no `file`), set
  `mixedContentMode="never"`, flip `thirdPartyCookiesEnabled` and
  `sharedCookiesEnabled` to `false`, and flip
  `injectedJavaScriptForMainFrameOnly` to `true` so the EIP-1193 provider
  is NOT installed in cross-origin iframes.
- `services/chains/evm/injectedScript.ts` — capture `window.location.origin`
  at page-load (top frame only) and bind it to every EIP-1193 request. The
  injected script is delivered via `injectedJavaScript` (top frame), not
  `injectedJavaScriptBeforeContentLoaded` into subframes.
- `services/bridge/DappBridge.ts` + `services/bridge/inspectors/` — at every
  inbound request, compare the declared origin against the current top-frame
  origin reported by `onNavigationStateChange` / `onShouldStartLoadWithRequest`.
  Mismatch → reject with EIP-1193 `4100`/`4901` and log.
- `react-native-webview` — ensure the pinned version in `package.json` is
  ≥ 11.0.0 per spec §6.

## Rules (non-negotiable)

- A WebView older than 83.0.4103.106 MUST NOT load dApps. No opt-out.
- `originWhitelist` MUST exclude `http://` and `file://` schemes.
- Every EIP-1193 request MUST carry a top-frame origin and be rejected if
  that origin disagrees with the native-tracked top frame at call time.
- Sub-frame messages MUST NOT reach the bridge handler. If they arrive,
  drop them.

## Acceptance

- [ ] Launching the dApp browser on an Android device with WebView <
      83.0.4103.106 shows the upgrade screen and refuses to render the
      dApp URL.
- [ ] WebView props above are set in `components/dapps-browser/` and
      covered by a snapshot / prop test.
- [ ] A unit test for the bridge handler rejects a message whose declared
      origin disagrees with the tracked top-frame origin.
- [ ] `injectedScript.ts` compile output shows top-frame origin capture and
      per-request binding.
- [ ] Regression: previously working dApps on a current WebView load and
      connect unchanged.
- [ ] pnpm check:syntax passes.

## Out of scope

- Per-session nonce on the injected provider (task 19, TWV-2026-015).
- SSL/SPKI pinning of RPC/backend hosts (task 23, TWV-2026-026).
- iOS WKWebView version gating (iOS bundles WebKit with the OS; handled by
  OS minimum in `app.config.ts`).
