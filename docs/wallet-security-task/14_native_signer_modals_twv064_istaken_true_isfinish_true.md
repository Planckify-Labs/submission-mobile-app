# Task 14 — Native RN modals for signer UI; disable WebView fullscreen

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-064, §7 (non-regression), §9 (DiD checklist rows)

## Why this matters

A dApp inside the in-app WebView can `requestFullscreen` and render a
pixel-perfect replica of the wallet's signature prompt — or a fake
"wallet unlock" screen. If the real signer UI is also HTML (e.g. a
modal inside the same WebView), the user cannot tell which surface
they are actually tapping. Tapjacking + credential phish in one. The
spec points at `components/dapps-browser/` and the signer UI. §9
"Signatures" row: "Signer UI rendered as native RN modals, never HTML
overlays; WebView JS fullscreen API disabled."

The in-app browser entry is `app/dapps-browser.tsx` (the RN equivalent
of a wallet-extension-hosted browser). Current WebView props there set
`allowsInlineMediaPlayback` and `mediaPlaybackRequiresUserAction={false}`
but do NOT pin `allowsFullscreenVideo={false}` and do not neutralise the
JS fullscreen API — a dApp can therefore request fullscreen and paint a
convincing signer chrome. `ApprovalHost` (mounted at the bottom of
`dapps-browser.tsx`) already renders native; this task guarantees it
stays the only signer surface and locks fullscreen down.

## Scope

1. Audit every signer prompt reachable from the dApp browser — Connect
   sheet, `personal_sign` prompt, `eth_signTypedData_v4` prompt, tx
   approval. All of these must render as **native React Native
   modals** over the WebView, not HTML inside it. Any remaining HTML
   signer surface is refactored out.
2. In `app/dapps-browser.tsx` (the `<WebView>` block, around the
   existing `allowsInlineMediaPlayback` / `mediaPlaybackRequiresUserAction`
   props):
   - Add `allowsFullscreenVideo={false}` (both iOS and Android).
   - Keep `allowsInlineMediaPlayback={true}` (video stays inline
     rather than going fullscreen).
   - Inject JS at load that no-ops
     `document.documentElement.requestFullscreen` /
     `Element.prototype.requestFullscreen` and the vendor variants
     (`webkitRequestFullscreen`, `mozRequestFullScreen`,
     `msRequestFullscreen`). Fold this into the existing
     `injectedJavaScript` builder.
3. Add a persistent, native-drawn trusted-UI indicator on every
   signer prompt (a small coloured strip with the wallet icon
   rendered from native code) — something a WebView cannot overlay
   because it sits above the WebView in the RN view hierarchy.
4. Require a hardware/system gesture (iOS edge swipe, Android back
   button) to dismiss the signer prompt; WebView-rendered "cancel"
   buttons must not be accepted as a dismissal path.

## Rules (non-negotiable)

- **Signer UI is 100% native RN.** No HTML overlay, no WebView-rendered
  prompt, ever.
- **Fullscreen API is disabled in the WebView.** Video plays inline;
  JS `requestFullscreen` returns rejected promise.
- **Trusted-UI indicator is unfakeable.** It renders above the
  WebView in the RN hierarchy and is never duplicated in HTML.
- **dApp compatibility parity (§7.1.5).** Dapps that relied on
  fullscreen video still work (inline playback); ones that tried to
  fullscreen to spoof are now blocked.

## Acceptance

- [ ] Every signer prompt is a native RN modal; grep
      `components/dapps-browser/` and `app/dapps-browser.tsx` for any
      HTML prompt shows none. `ApprovalHost` remains the only signer
      surface.
- [ ] `app/dapps-browser.tsx` WebView sets `allowsFullscreenVideo={false}`;
      the injected JS builder neutralises the fullscreen API; manual
      test attempts `requestFullscreen` from a test page and is
      rejected.
- [ ] Trusted-UI indicator visible on every signer prompt; a
      WebView-rendered test page attempting to cover it cannot.
- [ ] Manual regression: inline video playback on a supported dApp
      still works; `personal_sign` and typed-data signatures complete
      unchanged from the user's POV.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Origin-pinning per-request on the injected provider —
  TWV-2026-015 (Phase 2, task 19).
- WebView hardening (min system version, origin allowlist) —
  TWV-2026-013 (Phase 2, task 18).
- IDN punycode rendering in the URL bar — TWV-2026-052 (Phase 2,
  task 30).
- Signed push notifications — TWV-2026-054 (Phase 2, task 31).
