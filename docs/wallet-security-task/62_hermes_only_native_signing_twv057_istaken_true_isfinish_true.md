# Task 62 — Hermes-only RN engine; native-layer signing

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-057, §7, §9

## Why this matters

On jailbroken iOS or rooted Android, an attacker can read the running
process memory. Any secret held plaintext in the JS heap — a
freshly-decrypted private key, a signature just computed, a session
token — is recoverable. Minimising JS-heap dwell for key material is
the structural defence: Hermes (lower memory overhead, smaller
reverse-engineering surface than JSC) combined with native-side signing
so the decrypted key never reaches JS.

## Scope

Architecture / design-property task. Deliverables:

- Audit `app.config.ts` for `jsEngine: "hermes"`; if absent, flag as a
  blocker to be fixed as part of this task (the change itself is
  trivial — one line — but auditing includes verifying no fallback
  JSC path exists in any platform-specific build config).
- Audit `services/walletService.ts`: identify every code path that
  currently returns the decrypted private key to JS. Write a design
  note enumerating these call sites and propose a migration where the
  signing operation is invoked in a native module that:
  - Takes a Keychain / Keystore handle (not a plaintext key).
  - Performs the signature in native code.
  - Returns only the signature to JS.
  The JS layer never holds the key material.
- Short-term palliatives until the native-signing migration lands:
  minimise key dwell in JS (pass to signing call immediately, null
  out references afterwards acknowledging GC-timing caveats); rotate
  agent-session tokens frequently so memory-dumped material expires.
- Add a jailbreak / root heuristic check (`expo-device` + custom
  indicators) that raises a soft warning ("your device appears
  modified — use at your own risk"). The warning is advisory; the
  wallet does not refuse to run, because detection is unreliable.
- Flag TWV-2026-057 as a review gate on `services/walletService.ts`.
  Any future PR that touches the signing path must reference this
  task and confirm the JS-heap-dwell-minimisation invariants.

## Rules (non-negotiable)

- Hermes is the required JS engine; JSC fallback is not allowed in
  production builds.
- Once the native-signing migration ships, JS paths that return a
  plaintext private key are forbidden; reviewers block such PRs.
- Jailbreak / root detection is advisory, not a gate — attackers
  bypass detection routinely.
- Agent-session tokens are short-lived; a long-lived bearer token in
  JS heap is a finding.

## Acceptance

- [ ] Audit of `app.config.ts` + `services/walletService.ts`
      completed; design note captured with call-site inventory.
- [ ] Native-signing migration plan documented (no implementation
      required in this task — this is the design step).
- [ ] Jailbreak / root heuristic plan documented with the exact
      `expo-device` indicators to be used.
- [ ] Review gate recorded.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Shipping the native-signing migration (separate follow-up task; this
  task only establishes the invariant and inventory).
- JSC-specific hardening (we are moving off JSC, not patching it).
- Remote-attestation integration (covered by tasks 33, 34).
