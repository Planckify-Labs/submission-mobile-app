# Task 64 — Official distribution discipline; SHA-256 in About screen

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-065, §7, §9

## Why this matters

Fake Ledger Live and Trezor Bridge installers delivered via paid search
ads have stolen hundreds of thousands cumulatively. App distribution via
web downloads has no user-enforceable authenticity check — even signed
binaries only prove the signer's identity. TakumiAI ships primarily via
Apple App Store and Google Play; the discipline is to stay there,
publish the official identifiers, and surface the expected app-signing
fingerprint in-app so users can verify.

## Scope

Distribution / brand-protection operational task. Deliverables:

- Publish an official-links list in the repository root (`README.md`
  section) and in-app (new `app/about.tsx` screen or extension of an
  existing About screen):
  - Apple App Store URL
  - Google Play Store URL
  - Verified website URL
  - Verified social accounts (X, GitHub, Discord, etc.)
- In-app About screen shows:
  - iOS Bundle ID
  - Android Package name
  - Expected SHA-256 of the app-signing certificate (iOS) / signing
    key (Android). Users can compare this to what the OS reports.
  - Version + build number + commit hash.
  - Prominent copy: "Never download a TakumiAI desktop or browser
    component from search results. Official links above."
- Team runbook (not committed to the repo if it contains internal
  URLs — keep in the private ops folder) for monitoring Google / Bing
  / DuckDuckGo / app-store impersonators (cross-link to task 37 /
  TWV-2026-020). Include a takedown playbook and trademark-registration
  status.
- For any future desktop companion: distribute only via signed .dmg /
  .pkg / Windows MSIX; pin the desktop signer identity inside the
  mobile app so pairing verifies identity.
- HW-pairing UX (task 58+) warns if a user tries to pair a HW wallet
  via a previously-unseen channel; nudge to official flows.

## Rules (non-negotiable)

- Mobile app ships only via App Store and Play Store. No sideloaded
  "official" builds outside beta channels.
- About screen displays the expected signing-cert SHA-256; updates to
  that value require a security-team-approved PR.
- Official-links list is the single source of truth; support docs
  reference it rather than duplicating URLs.
- Brand-impersonation monitoring runs at least weekly; findings are
  logged and escalated to legal / takedown.

## Acceptance

- [ ] `README.md` has an official-links section.
- [ ] About screen (or extension of existing one) shows Bundle ID,
      Package name, signing-cert SHA-256, version, build, commit.
- [ ] Monitoring runbook exists (location documented — private ops
      folder is acceptable).
- [ ] Pre-implementation notes for desktop-companion distribution
      captured.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Building a desktop companion.
- Active trademark-registration legal work (tracked separately).
- Automated impersonation-monitoring tooling; weekly manual review is
  acceptable at this scale.
