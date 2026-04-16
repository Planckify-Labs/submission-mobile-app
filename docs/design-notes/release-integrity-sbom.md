# Release integrity, SBOM, reproducible builds — TWV-2026-006

**Owner:** CI + mobile-app · **Spec ref:** TWV-2026-006.

> **Status:** CI scope. The mobile-app side records the
> SHA-256 in the About screen (TWV-2026-065 / Task 64 already
> shipped); CI side ships the SBOM, the reproducible-build
> infrastructure, and the public attestation.

## Hard rules

1. Every store-distributed build (App Store, Play Store, EAS
   internal) ships with a CycloneDX SBOM published to
   `https://takumi.wallet/.well-known/sbom-<version>.json`.
2. The build is reproducible: a second builder running on a clean
   machine from the same commit produces a byte-identical artifact.
3. The CycloneDX SBOM lists every transitive dep with version + SRI
   hash. The wallet binary's SHA-256 is published alongside.
4. The About screen (`app/about.tsx`) renders the binary's commit
   hash + SHA-256 (already shipped — TWV-2026-065). Users on a
   compromised channel can manually compare against the published
   value.

## Review gate

Any PR that touches the build / release pipeline MUST cite
TWV-2026-006 and re-run the reproducibility check before merge.

## Pre-implementation checklist (for the CI work)

- [ ] EAS build configured with `--non-interactive` + pinned tool
      versions (Node, JDK, Xcode, Android SDK).
- [ ] CycloneDX SBOM generated via `cyclonedx-bom`; uploaded to
      `https://takumi.wallet/.well-known/sbom-<version>.json` on every
      release.
- [ ] Reproducible-build verification job runs on a second runner;
      mismatched artifacts block the release.
- [ ] App Store / Play Store listing links to
      `https://takumi.wallet/security` for the published SHAs.
