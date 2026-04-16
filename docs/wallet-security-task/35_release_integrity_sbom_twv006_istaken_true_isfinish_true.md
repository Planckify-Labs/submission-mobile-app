# Task 35 — Release integrity, SBOM, reproducible builds

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-006, §7, §9

## Why this matters

Atomic Wallet lost ~$100M in June 2023 from a still-undisclosed
release-pipeline compromise: fully-patched users were fully exposed
because the binary itself shipped exfiltration code. Release integrity
is the only thing standing between a developer-workstation or
EAS-secret leak and every end-user's seed phrase. This task is
ongoing/policy — it turns §6's "validate EAS, publish SHA-256" bullet
into a written, repeatable checklist with named owners.

## Scope

This is a policy/runbook task, not a code task. Deliver:

- A `docs/runbooks/release-integrity.md` write-up covering:
  - EAS Build hardening: protected secrets, source-commit review per
    build, no mnemonics or test seeds ever injected into any build
    profile (dev, preview, production).
  - Hardware-backed code-signing posture: Apple ADP cert stays in
    hardware (keychain or HSM), Android uses Play App Signing (upload
    key local, signing key held by Google).
  - Per-release SBOM generation: `pnpm audit --prod` and an
    `npm-audit-report` / CycloneDX artefact stored alongside the
    release tag. CI fails the release job if new high/critical advisories
    appear without a documented waiver.
  - Reproducible-build effort: document what is and isn't
    reproducible today (Hermes bytecode, native shared objects), and
    publish the SHA-256 of store-submitted binaries in the About
    screen (pairs with Task 64, TWV-2026-065).
  - Pre-publish checklist: clean `pnpm install --frozen-lockfile`,
    lockfile diff review, signed release note, store-page diff
    review.
- Assign named owners for: release captain, SBOM reviewer, key
  custodian. Record in the runbook.
- Flag TWV-2026-006 as a standing gate on every production release
  PR template (checkbox: "SBOM generated, lockfile diff reviewed,
  SHA-256 published").

## Rules (non-negotiable)

- No seed material — real or test — ever lives on a developer laptop
  or in any EAS environment variable.
- Every production build traces to exactly one reviewed git commit;
  no ad-hoc `eas build` from a dirty tree.
- SBOM artefacts are retained for the lifetime of the release (so
  post-incident we can answer "what was shipped").
- Code-signing keys never leave hardware. No exported `.p12` lying
  on disk.

## Acceptance

- [ ] `docs/runbooks/release-integrity.md` landed and linked from the
      root README's "Operations" section.
- [ ] Release captain, SBOM reviewer, and key custodian assigned by
      name in the runbook.
- [ ] Release PR template updated with the TWV-2026-006 checklist
      item.
- [ ] CI job enforces `pnpm install --frozen-lockfile` and fails on
      dirty-tree builds for the production profile.
- [ ] Existing release has an archived SBOM in the runbook's
      specified location (proves the process works end-to-end).
- [ ] pnpm check:syntax passes.

## Out of scope

- Full byte-for-byte reproducible builds across machines (tracked
  separately; Hermes + native toolchain work).
- Third-party auditor engagement for release-signing review.
- Migration to a different CI host or signing service.
