# Hardware-wallet pairing UX spec

**Spec references:** `wallet-security-vulnerabilities-spec.md`
TWV-2026-046 (attestation + anti-klepto, task 58), TWV-2026-047
(numeric-comparison BLE + multi-pair warn, task 59), TWV-2026-048
(firmware disclosure + release-notes link, task 60).

**Status:** Design-property spec. No HW-pairing transport ships in the
current codebase. This document is the pre-implementation contract —
any PR that introduces HW-wallet support (BLE or USB) must satisfy every
rule below before it can merge.

## Pre-implementation checklist (merges block on any unchecked box)

- [ ] Attestation (§1) implemented per vendor; failure blocks pairing.
- [ ] Firmware-allowlist check (§2) runs on every connect, not only
      enrollment.
- [ ] Anti-klepto / auxiliary-entropy protocol (§3) enforced where the
      device supports it.
- [ ] Software signer uses RFC 6979 + aux entropy (§3.4) so the in-app
      path is not worse than the HW path.
- [ ] BLE transport rejects "Just Works" pairing mode (§4.1).
- [ ] On-device numeric-comparison confirmation is user-driven; no
      timeout auto-accepts (§4.2).
- [ ] Multi-pair detection banner is non-dismissible in-session (§4.3).
- [ ] Firmware version visible on the paired-device status screen
      (§5.1).
- [ ] Release-notes URL is pinned per vendor; never dApp- or
      device-supplied (§5.2).
- [ ] Dev / non-release firmware triggers a persistent warning (§5.3).

## 1. Attestation at pairing time (TWV-2026-046)

Perform the vendor's attestation protocol before the **first** signing
operation. Pairing completes only after attestation succeeds.

- **Ledger:** `GET_ATTESTATION` APDU + Ledger root-CA verification.
  Attestation response is pinned to the expected root; dev-signed
  attestation (non-production root) is flagged as a hard block unless
  the user has explicitly enabled developer mode in Takumi's advanced
  settings.
- **Trezor:** PIN-shared attestation challenge; compare the on-device
  display's fingerprint to what the mobile app renders. User must
  confirm on the Trezor.
- **Keystone / Foundation Passport:** QR-based attestation handshake;
  air-gapped-first flow.

Failure path: pairing UI shows "Device attestation failed — do not
use this device for signing" with a link to vendor support. No
fallback; signing is not enabled.

## 2. Firmware allowlist (TWV-2026-046 + TWV-2026-048)

- Ship an in-bundle allowlist of vendor-signed firmware release hashes
  per vendor. Updates to the allowlist are code PRs, not runtime fetches.
- On every pairing connect (not only enrollment), query the device's
  firmware version + signing root, and verify against the allowlist.
- **Firmware outside allowlist:** persistent banner; signing is not
  blocked (would break legitimate new releases before we update the
  list) but every sign is gated behind an explicit "I understand"
  acknowledgement.
- **Firmware on the denylist** (known-compromised or withdrawn): hard
  block. Signing is disabled. User sees "Your device firmware is known
  to be compromised. Update via the vendor's official channel before
  using this device for signing."

## 3. Anti-klepto / auxiliary-entropy (TWV-2026-046)

Dark Skippy class of attack: malicious firmware derives ECDSA / Schnorr
nonces from seed chunks. After two or three signed txs, lattice
attacks recover the master seed. The countermeasure is a public-nonce
commitment protocol that binds vendor-supplied nonces to wallet-supplied
auxiliary entropy.

### 3.1 Protocol

1. Wallet generates 32 bytes of auxiliary entropy `r_app`.
2. Wallet sends `r_app` to the device along with the sighash.
3. Device computes a public-nonce commitment `R` derived from its own
   nonce `r_dev` and `r_app` (vendor-specific; Ledger's LSAG /
   Trezor's anti-klepto spec). Device returns `R` and the signature.
4. Wallet verifies the commitment contains `r_app`'s contribution.

### 3.2 Vendor support

- **Trezor:** supports anti-klepto per the Trezor firmware spec;
  enable by default.
- **Ledger:** partial — Ledger Live implements anti-klepto for BTC
  but not yet universally. Warn for unsupported apps.
- **Keystone:** open-firmware; anti-klepto commitments supported in
  recent firmware.

### 3.3 Unsupported devices

If the device does not advertise a public-nonce scheme, the UI warns
at signing time: "Dark-Skippy detection is unavailable on this device.
Consider updating firmware or using a device that advertises anti-
klepto support." Signing proceeds on explicit user acknowledgement.

### 3.4 Software signer (in-app)

Cross-link: `services/walletService.ts`. RFC 6979 deterministic nonces
PLUS an auxiliary-entropy leg so the in-app signing path matches the
HW path's resistance. The software signer is not allowed to regress
below the HW path we are gating.

Review gate: any PR touching `services/walletService.ts`'s signing
path must confirm RFC 6979 + aux entropy is the path taken.

## 4. BLE pairing (TWV-2026-047)

Kraken Security Labs (2020) demonstrated the "Just Works" attack. The
pairing mode is the difference between a secure pairing and a
companion-app spoof.

### 4.1 Allowed modes

- **Numeric comparison:** both device and phone display a 6-digit
  code; user confirms equal on both.
- **Out-of-band (OOB):** fingerprint material transferred via an
  out-of-band channel (e.g., QR code, NFC tap).

### 4.2 Disallowed modes

- **Just Works:** rejected. Pairing fails with copy: "This device's
  BLE pairing mode is not secure. Enable numeric-comparison pairing
  in your device settings, or use USB pairing."
- **Passkey Entry (device display):** acceptable only when combined
  with on-device display verification; a blind passkey entry is
  rejected.

### 4.3 On-device fingerprint confirmation

UI waits for the user to confirm on the device's physical display.
No mobile-side timeout auto-accepts; if the user taps the mobile
"Yes" button before the device confirmation arrives, the UI shows
"Waiting for device confirmation…" and blocks pairing completion.

### 4.4 Multi-pair detection

If the device reports it is already paired with another companion app
or mobile, show a non-dismissible banner: "Your device is also paired
with another companion app. Confirm this is expected before signing."
User must tap "Understood" to proceed. Banner persists until the user
unpairs from the other companion (user is linked to vendor support
instructions).

### 4.5 Physical-security copy

Shown once at first pairing: "Pair hardware wallets only with their
official companion apps when you first receive them. Devices bought
open-box, from secondary sellers, or returned to a marketplace have
been seen compromised in transit. Take the standard anti-tamper steps
the vendor documents before first use."

## 5. Firmware disclosure (TWV-2026-048)

Post-Ledger-Recover lesson: firmware updates are a **trust event**, not
a routine maintenance task. Users must be able to make an informed
decision before signing.

### 5.1 Always-visible version

On the paired-device status screen, the firmware version is always
visible — not hidden under "Advanced". Format: `Ledger Nano X
v2.2.4`, `Trezor T v2.7.0`, etc.

### 5.2 Release-notes link (pinned)

A "What's new" link next to the firmware version opens the vendor's
release-notes page for that exact version. URLs are pinned per vendor
inside the bundle:

- `https://support.ledger.com/hc/en-us/articles/XXXXXXXX` for
  Ledger Nano X v2.2.4 (example)
- `https://wiki.trezor.io/Firmware_revision_history` etc.

The wallet does not follow a URL the device claims — a device that
reports "release notes at http://attacker.example" is ignored and
the pinned URL is used instead.

### 5.3 Dev / non-release firmware warning

If attestation indicates dev-signed firmware (non-production root) or
the version string includes `dev`, `rc`, or `engineering`:

- Persistent banner "This device is running non-release firmware.
  Signing is permitted but proceeds at your own risk. Takumi cannot
  verify the signing path on pre-release firmware."
- Not dismissible in-session; reappears on every connect.

### 5.4 Education copy (team-authored)

Shown on first firmware-update banner:

> Firmware updates change what your device can do. A firmware release
> can add a seed-export path, change signing behaviour, or alter key
> custody. Review release notes before approving an update. If
> seed-export resistance matters to you, consider open-source-firmware
> hardware such as Trezor or Passport.

This copy is Takumi's, not the vendor's. Vendor marketing is not the
source of truth for what a firmware update does.

## 6. Review gates

- `docs/wallet-security-task/58_hw_pairing_attestation_twv046_*` — this
  spec §1, §2, §3.
- `docs/wallet-security-task/59_hw_pairing_ble_numeric_twv047_*` —
  §4.
- `docs/wallet-security-task/60_hw_firmware_disclosure_twv048_*` —
  §5.
- `services/walletService.ts` — RFC 6979 + aux entropy on the software
  signing path (§3.4). A design-note comment lives at the top of that
  file alongside the TWV-2026-057 review gate.

Any PR that adds HW-pairing transport code (`services/hw-pairing/`,
BLE / USB / QR handler) must reference this spec and check off the
pre-implementation list at the top.

## 7. Cross-links

- Task 62 / TWV-2026-057 — native-signing design (replaces Viem JS-heap
  key dwell; compatible with the aux-entropy leg described here).
- Task 51 / TWV-2026-039 — independence property for guardian /
  multisig sets. A HW-rooted guardian satisfies §1 of that spec.
- Task 64 / TWV-2026-065 — distribution discipline. Users must pair
  only with the official companion app bought / downloaded from a
  verified channel.
