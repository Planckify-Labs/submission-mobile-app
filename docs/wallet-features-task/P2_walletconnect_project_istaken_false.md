# Platform Task P2 — WalletConnect project registration

**Status:** Not taken
**Owner:** Infrastructure
**Spec reference:** `wallet-features-spec.md` §4.7
**Type:** Platform integration

## Why this is separate

WalletConnect v2 requires a project ID from the WalletConnect Cloud dashboard.
This is a platform setup task, not a code task.

## Scope

- Register TakumiAI Wallet on WalletConnect Cloud (https://cloud.walletconnect.com).
- Obtain project ID.
- Configure project metadata (name, description, icons, URLs).
- Set up environment variable: `EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID`.
- Verify relay connectivity with the project ID.

## Acceptance

- [ ] WalletConnect Cloud project created.
- [ ] Project ID available as environment variable.
- [ ] Relay connection works with the project ID (verified via test pairing).

## Depends on

- None.

## Unblocks

- Task 49 (WalletConnect v2 transport).
