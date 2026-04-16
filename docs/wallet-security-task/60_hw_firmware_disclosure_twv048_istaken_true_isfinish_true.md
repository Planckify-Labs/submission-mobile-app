# Task 60 — HW pairing: show firmware version + release-notes link

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-048, §7, §9

## Why this matters

The Ledger Recover controversy (May 2023) taught the ecosystem that
firmware updates on any HW wallet are a trust event — they can
silently change the device's custody model (e.g., enabling a seed
export path). Users should never flash firmware blindly; the pairing
UX has to surface the firmware version and link to vendor release
notes so users can make an informed decision before signing.

## Scope

Design-property task. Deliverables:

- Extend `docs/hw-pairing-ux-spec.md` (from tasks 58 and 59) with a
  firmware-disclosure section:
  - At pairing time and on every subsequent connect, display the HW
    device's firmware version in the pairing screen.
  - Link to the vendor's release notes page for that version (curated
    URL allowlist per vendor — Ledger, Trezor, Keystone, etc.).
  - Warn if the firmware is non-release / developer mode
    (vendor-specific heuristic; e.g., Ledger dev-signed firmware
    attestation returns a different root).
  - Education copy: "Firmware updates change what your device can do.
    Review release notes before approving. Consider open-source
    hardware (e.g., Trezor with open firmware, Passport, Foundation)
    if seed-export resistance is important to you."
  - Cross-link to task 58's firmware-allowlist: if the firmware is
    outside the allowlist, the banner is persistent, not dismissible.
- Add a pre-implementation checklist to the HW-pairing roadmap: the
  pairing screen cannot ship without firmware-version disclosure +
  release-notes link.
- Flag TWV-2026-048 as a review gate.

## Rules (non-negotiable)

- Firmware version is always visible on the paired-device status
  screen; never hidden behind "advanced" settings.
- Release-notes URLs are pinned per vendor; the wallet does not follow
  a URL the device claims.
- Non-release / developer firmware triggers a non-dismissible warning;
  signing is gated behind explicit acknowledgement.
- Education copy is written by the team, not by the vendor; the
  vendor's marketing is not the source of truth.

## Acceptance

- [ ] `docs/hw-pairing-ux-spec.md` firmware section is present with
      disclosure, release-notes link, dev-firmware warning, and
      education copy.
- [ ] Pre-implementation checklist linked from the HW-pairing roadmap
      entry.
- [ ] Review gate recorded; cross-link to tasks 58, 59.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Shipping the HW pairing feature.
- Maintaining per-vendor release-notes URLs as a live feed.
- Detecting zero-day firmware vulnerabilities (outside scope).
