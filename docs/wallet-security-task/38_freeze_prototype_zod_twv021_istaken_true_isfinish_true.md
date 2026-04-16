# Task 38 — `Object.freeze(Object.prototype)` + Zod at bridge boundary

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-021, §7, §9

## Why this matters

Prototype-pollution CVEs in shared libraries (e.g. CVE-2019-10744 in
lodash) let an attacker mutate `Object.prototype` globally, which in
a wallet can swap a recipient address mid-request or flip a
`chainId`. Freezing `Object.prototype` at boot and parsing every
EIP-1193 payload through a Zod schema at the bridge boundary removes
that class of attack from the injected-provider surface. Low-cost
hardening that the spec calls out as a next-refactor item.

## Scope

Small code + policy task:

- Add `Object.freeze(Object.prototype)` and
  `Object.freeze(Array.prototype)` at the top of the app's polyfills
  entry (see spec: `pollyfills.ts`). Include a boot-time self-check
  that `Object.isFrozen(Object.prototype) === true` and logs a hard
  error if not (means a dep has un-frozen it; we want to know).
- Audit `services/chains/evm/payloads.ts` (see spec §6 TWV-2026-021
  applicability note) and adjacent request-dispatch code to confirm
  every EIP-1193 payload is parsed through a Zod schema *before* any
  property read. Record the dispatch entry points and their schemas
  in a short `docs/design-notes/bridge-zod-boundary.md` note.
- Entry-point fix in `app/dapps-browser.tsx`: `handleMessage` today
  calls `JSON.parse(e.nativeEvent.data)` and passes the untyped object
  straight into `bridge.dispatch(parsed)` after mutating it with
  `(parsed as Record<string, unknown>).origin = {...}`. Replace the
  cast with a Zod parse and drop malformed messages silently. This is
  the outermost trust boundary between the WebView and the wallet —
  nothing downstream should touch the raw object.
- For any request shape not yet Zod-validated, add a `TODO(twv-021)`
  marker and file a follow-up task; do not bulk-refactor in this task.
- Flag TWV-2026-021 as a review gate on any PR adding or widening
  an EIP-1193 method handler.

## Rules (non-negotiable)

- Freeze happens before any third-party code runs — top of the
  polyfills file, before any other import side-effect.
- No property read off an incoming bridge payload without Zod
  parsing first; dynamic-key reads on untrusted input are forbidden.
- The boot-time freeze self-check logs, it does not throw (we don't
  brick the app on a dep regression; we surface it).

## Acceptance

- [ ] `Object.freeze` calls land in the polyfills entry with a
      boot-time assertion.
- [ ] Audit of bridge payload parsing recorded in
      `docs/design-notes/bridge-zod-boundary.md`; gaps filed as
      follow-up tasks.
- [ ] Every present Zod schema for an EIP-1193 request shape linked
      from that note.
- [ ] PR template gains a "touches EIP-1193 dispatch? cite
      TWV-2026-021" prompt.
- [ ] `app/dapps-browser.tsx::handleMessage` parses inbound messages
      through a Zod schema; malformed messages are dropped without
      reaching `bridge.dispatch`.
- [ ] Manual smoke: app boots, dApp browser loads a known-good dApp,
      request flows unaffected.
- [ ] pnpm check:syntax passes.

## Out of scope

- LavaMoat / Compartments realm isolation (extension-only; not
  applicable to RN runtime).
- Replacing Zod with an alternative validator.
- Rewriting the full injected-script bundler pipeline.
