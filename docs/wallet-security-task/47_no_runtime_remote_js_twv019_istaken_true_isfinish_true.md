# Task 47 — No runtime remote JS loading in app process

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-019, §7, §9

## Why this matters

The `@ledgerhq/connect-kit-loader` compromise (Dec 2023, $600k via
Angel Drainer) replaced a CDN-loaded script with a drainer that
affected SushiSwap, Kyber, Revoke.cash, and Zapper. Any wallet
process that loads JS at runtime from outside the signed bundle is
one CDN compromise away from the same outcome. We're 99% there —
Expo/Hermes ships everything at build time — but this task audits
and proves it, and freezes the rule as a non-negotiable going
forward.

## Scope

Code-audit + policy task:

- Grep the repo for remote-loading patterns and document findings in
  `docs/design-notes/no-remote-js.md`. The patterns to search are:
  - String-to-code evaluation primitives (the dynamic-code builtins
    that take a string and return executable behaviour).
  - Dynamic `import` with a runtime-computed URL, as opposed to a
    static string that the bundler resolves at build time.
  - WebView `injectedJavaScript` or `injectJavaScript` call sites
    whose payload originates from network rather than from the
    bundle.
  - Remote URLs referenced by `services/chains/evm/injectedScript.ts`
    (spec §6 applicability note) — confirm it is bundled, not
    fetched.
- Expected result: zero findings inside the app process. If any
  match surfaces, file it as an immediate Phase-1-style fix, not a
  Phase-3 track item.
- Note the dApp-browser exception: dApps loaded inside the WebView
  load their own remote JS — that is their problem. The wallet
  protects itself via simulation, calldata decoding, and allowlist
  checks. Record this boundary in the design note.
- Flag TWV-2026-019 as a review gate on any PR adding a dependency
  loader or a scripting/code-evaluation surface.

## Rules (non-negotiable)

- No string-to-code evaluation in app code, in any form.
- No dynamic `import` whose URL argument is computed at runtime.
- Injected provider script is bundled at build time from source in
  this repo; no fetch from CDN or npmjs-style URL.
- The dApp-browser boundary is explicit: code inside the WebView is
  not part of the wallet process, and its remote loading is not our
  concern for this control.

## Acceptance

- [ ] Grep audit recorded in `docs/design-notes/no-remote-js.md`
      with the exact patterns searched and the (expected-zero)
      findings.
- [ ] Any finding inside app code filed as an immediate fix ticket
      referencing TWV-2026-019.
- [ ] `services/chains/evm/injectedScript.ts` confirmed as
      build-time-bundled; the note links to the bundler config that
      includes it.
- [ ] PR template gains a "adds dynamic code loading? cite
      TWV-2026-019" prompt.
- [ ] Lint/CI rule considered (or filed as follow-up) to fail on
      string-to-code evaluation primitives appearing in diff.
- [ ] pnpm check:syntax passes.

## Out of scope

- OTA update mechanism hardening (Tasks 09 / 32, TWV-2026-055 /
  TWV-2026-056); OTA is signed code, not runtime remote JS.
- dApp-side CSP or SRI enforcement.
- Migrating away from Expo.
