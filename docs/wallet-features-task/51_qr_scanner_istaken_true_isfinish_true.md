# Task 51 — QR scanner: addresses, ENS, EIP-681, WC URIs

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.9

## Why this matters

QR codes are the primary way to transfer addresses and initiate WalletConnect
sessions in person. A wallet without a scanner forces users to manually copy-paste.

## Scope

Create:

- QR scanner screen using `expo-camera`:
  - Camera viewfinder with scanning overlay.
  - Decode QR contents and classify:
    - Ethereum address (raw `0x` hex, 42 chars) → open send flow with recipient.
    - ENS name (contains `.eth`, `.crypto`, etc.) → resolve → open send flow.
    - EIP-681 URI (`ethereum:*`) → parse via `deeplinks/eip681.ts` → pre-fill.
    - WalletConnect URI (`wc:*`) → initiate pairing via task 49.
    - Unknown → show "Unrecognized QR code" toast.
  - Haptic feedback on successful scan.
  - Flash/torch toggle button.
- **Entry points** (floating action button or scan icon):
  - Portfolio screen header.
  - Send flow recipient input.
  - dApp browser (for `wallet_scanQRCode` method from bridge spec §10.1 P2).
- **`wallet_scanQRCode` bridge method**: dApps can invoke the scanner
  programmatically. Returns the scanned string to the dApp via the bridge.
  Requires permission prompt: "[DApp] wants to use your camera to scan a QR code".

## Rules (non-negotiable)

- **Camera permission** must be requested with a clear explanation before
  opening scanner. Use `expo-camera` permission flow.
- **Single scan per open** — once a valid QR is decoded, close the scanner
  and act on it. Don't keep scanning.
- **`wallet_scanQRCode` requires user permission** — never expose camera
  without explicit approval.
- **Torch toggle** for low-light scanning.

## Acceptance

- [ ] Scanner opens with camera viewfinder and overlay.
- [ ] Raw Ethereum address scanned → opens send flow.
- [ ] ENS name scanned → resolves → opens send flow.
- [ ] EIP-681 URI scanned → parses and pre-fills send.
- [ ] WC URI scanned → initiates pairing.
- [ ] Unknown QR → "Unrecognized" toast.
- [ ] `wallet_scanQRCode` bridge method works from dApps.
- [ ] Camera permission requested properly.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- QR code generation (for receiving — future task).
- Multi-code scanning.

## Depends on

- Task 50 (deep link router — for EIP-681/WC handling).
- Task 40 (ENS resolution — for ENS name QR codes).
