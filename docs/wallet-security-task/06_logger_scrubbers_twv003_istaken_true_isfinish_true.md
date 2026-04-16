# Task 06 — Logger/Sentry scrubbers for seed-like strings

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-003, §7 (non-regression), §9 (DiD checklist rows)

## Why this matters

Slope Wallet forwarded every interaction event (including seed-phrase
input state) to a self-hosted Sentry instance; ~9,200 wallets drained,
~$4.1M. The attack requires no cleverness — just a default observability
SDK with no `beforeSend` scrubber. The spec points at
`services/bridge/redact.ts` as the existing redaction layer and says
"even if no observability SDK is configured today, bake in scrubbers
now before someone adds observability later." §9 "Observability" row
requires scrubbers that drop BIP-39 word runs, 64-char hex, and
32-byte base58.

## Scope

1. Extend `services/bridge/redact.ts` with three detector predicates:
   - BIP-39-like word run (regex `\b(?:\w+\s+){11,23}\w+\b` as a
     coarse failsafe; layer on a wordlist check for precision).
   - 0x-prefixed 64-character hex (private-key shape).
   - 32-byte base58 (Solana-shape private key — relevant if any
     future chain adapter crosses the same redactor).
2. Expose a single `scrubLoggerPayload(input: unknown): unknown`
   function that any observability adapter must call before emitting.
   Walk objects/arrays, preserve shape, replace matched strings with
   a fixed placeholder (e.g. `[REDACTED_SEED]`).
3. Wire the scrubber into every existing logging surface:
   `services/bridge/events.ts`, any `console.log` wrapper, and
   (pre-emptively) a documented `Sentry.init` / `PostHog.init`
   `beforeSend` / `beforeBreadcrumb` snippet in `services/bridge/sinks/`
   or an equivalent docs-adjacent location the next engineer will
   see when adding observability.
4. Add a lint rule (or unit test) that fails on raw
   `console.log(wallet…)` / `console.log(mnemonic…)` / any direct
   log of objects whose keys match `/mnemonic|seed|privateKey|pk/i`.

## Rules (non-negotiable)

- **Scrubber is default-on.** Any future log adapter added to the app
  must route through `scrubLoggerPayload` before emission.
- **No false negatives on the known shapes.** BIP-39 word run, 0x-hex
  64, base58 32 must all redact in every string position (top-level,
  nested object value, array element, error message).
- **Placeholder is fixed and uniform.** Tests can grep for it.
- **No behaviour regression for non-sensitive logs.** Send-tx success
  logs, RPC error messages, and dApp-browser nav events continue to
  flow unchanged.

## Acceptance

- [ ] `services/bridge/redact.ts` exports `scrubLoggerPayload` with
      unit tests covering the three detector predicates and nested
      payload shapes.
- [ ] Every existing log call site routes through the scrubber;
      grep proves no bypass path.
- [ ] A documented `beforeSend` / `beforeBreadcrumb` snippet lives
      beside the sinks module so a future observability integration
      cannot skip it.
- [ ] Unit test feeds a fake mnemonic through a simulated Sentry
      event and asserts the breadcrumb value is `[REDACTED_SEED]`.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Integrating Sentry or PostHog itself (out of this backlog).
- URL sanitisation on AI agent outputs — TWV-2026-032 (Phase 2,
  task 24).
- Zod schema validation at the bridge boundary — TWV-2026-021
  (Phase 3, task 38).
