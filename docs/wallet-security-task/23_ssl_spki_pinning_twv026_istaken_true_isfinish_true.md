# Task 23 — SSL/SPKI pinning on all backend + RPC hosts

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-026, §7, §9

## Why this matters

On rooted or proxied devices, or when a user installs a corporate /
malicious root CA, TLS is decryptable and modifiable. Any plain HTTPS
traffic from the wallet to the payment API, the agent API, or the RPC
endpoint is inspectable — an attacker can rewrite an RPC response, swap
a simulated asset-delta, or inject an agent reply. The spec specifies
pinning for `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_AI_API_URL`, and the
primary RPC endpoints referenced in `services/rpc/MultiProvider.ts`, plus
`network_security_config.xml` to exclude user-installed CAs on Android 7+.

## Scope

- Android — add / update `network_security_config.xml` to exclude user CAs
  (`<certificates src="system"/>`) on release builds. Wire it into
  `AndroidManifest.xml` via `android:networkSecurityConfig`. Expo managed
  workflow: configure through `app.config.ts` or a config plugin.
- Public-key (SPKI) pinning — pin `sha256//...` hashes for:
  - `EXPO_PUBLIC_API_URL` (TakumiPay API)
  - `EXPO_PUBLIC_AI_API_URL` (Agent API)
  - Primary RPC endpoints used in `services/rpc/MultiProvider.ts`
    (Alchemy, Infura, or whichever is the canonical provider per chain)
  Include at least one backup pin per host for rotation. See spec §6
  TWV-2026-026.
- Implementation — use `react-native-ssl-pinning` or an equivalent native
  module; route all fetches for the pinned hosts through the pinning-aware
  client. Non-pinned hosts continue to use the default client.
- Pin rotation runbook — document where pins live, who rotates them, and
  the dual-pin strategy so a rotation does not lock users out. File under
  the docs folder (location referenced in spec §9).
- Audit — confirm no wallet secret (seed, private key, decrypted mnemonic)
  is ever sent in an API body or log, so that even a pin miss cannot leak
  secrets. See spec §6 TWV-2026-026 bullet.

## Rules (non-negotiable)

- Every pinned host MUST have at least two SPKI hashes (current + backup).
- A pin mismatch MUST fail the request with a distinct error surfaced to
  the user; it MUST NOT fall back to the default trust store.
- `network_security_config.xml` MUST exclude user-installed CAs on release
  builds. Debug builds may trust user CAs (documented).
- Pin rotation changes are release-blocking; a runbook entry MUST exist
  for each rotation.

## Acceptance

- [ ] `network_security_config.xml` is present in the Android build and
      excludes user CAs on release.
- [ ] Fetches to `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_AI_API_URL`, and the
      primary RPC hosts go through the pinning-aware client with two
      `sha256//` hashes per host.
- [ ] A manual MitM (e.g. mitmproxy with a user CA installed) is blocked
      on a release build and surfaces the pin-failure error.
- [ ] No wallet secret (seed, private key, decrypted mnemonic) appears in
      any request body or log — verified by a code scan of
      `services/walletService.ts` and logger writes.
- [ ] Pin-rotation runbook is committed under docs.
- [ ] pnpm check:syntax passes.

## Out of scope

- DNSSEC / RPKI on owned infra (task 40, TWV-2026-027).
- Multi-RPC consensus (task 41, TWV-2026-028).
- iOS ATS tightening beyond App Transport Security defaults.
