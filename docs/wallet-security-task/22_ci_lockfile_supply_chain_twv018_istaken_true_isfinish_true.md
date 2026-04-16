# Task 22 — Lockfile-enforced CI + Socket/Snyk gate

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-018, §7, §9

## Why this matters

Supply-chain takeovers are how wallets get drained without a single bug in
the wallet itself: `event-stream` / `flatmap-stream` (Copay, 2018),
`@ledgerhq/connect-kit` (Dec 2023, $600k via Angel Drainer), ongoing
`@solana/web3.js` typosquats. Loose version ranges, unenforced lockfiles,
and no CI gate are the common denominator. TakumiAI's applicability note
in spec §6 TWV-2026-018 calls for hardened `package.json` scripts, pnpm
hooks for lockfile validation, and Dependabot + Socket monitoring — none
of which block a compromised dep from landing today.

## Scope

- CI config (see spec §8 row "CI config") — enforce
  `pnpm install --frozen-lockfile` on every PR build and on EAS Build.
  Build fails if `pnpm-lock.yaml` was not regenerated alongside
  `package.json` changes.
- `package.json` — pin critical deps to **exact** versions (no `^`, no
  `~`): `viem`, `@scure/bip39`, `react-native-webview`, `expo-secure-store`,
  every `@walletconnect/*`, and any dApp connector. Keep a comment next to
  each explaining why it is pinned.
- CI gate — run `pnpm audit --prod` and one of Socket.dev or Snyk on every
  PR. Fail the build on any new `high`/`critical` advisory or any new
  `malware` / `typosquat` signal from Socket. Existing advisories with an
  approved waiver file do not block.
- Install-time script discipline — add `@lavamoat/allow-scripts` (or an
  equivalent pnpm-compatible tool) to prevent install-time scripts from
  running on untrusted packages. Only explicitly allowed packages may run
  `postinstall`.
- PR review rule — any `pnpm-lock.yaml` diff that contains a transitive
  version bump without a matching direct-dep change must be flagged. Add
  a CI check or a CODEOWNERS rule that requires a security reviewer on
  such PRs. See spec §7.
- Subscribe to `security-announce` streams for Expo, Viem, WalletConnect,
  and Ledger; document the subscription in the repo so it is not a single
  person's inbox.

## Rules (non-negotiable)

- No PR may merge if CI was run without `--frozen-lockfile`.
- Critical deps MUST be exact-pinned. A floating range on any of them is a
  build-breaking lint error.
- A Socket/Snyk high/critical finding MUST block merge by default. Waivers
  are per-advisory, reviewed, and expire.
- Install-time scripts run only for allow-listed packages.

## Acceptance

- [ ] CI pipeline runs `pnpm install --frozen-lockfile`; a lockfile-
      out-of-sync PR fails the build.
- [ ] `package.json` shows exact-pinned versions for the critical-dep list
      above, with comments.
- [ ] `pnpm audit --prod` and Socket (or Snyk) run as required checks on
      every PR. A seeded test PR with a known-bad advisory fails.
- [ ] `@lavamoat/allow-scripts` (or equivalent) is wired; a fresh
      `pnpm install` runs zero install-time scripts except for the allowed
      set.
- [ ] A documented subscription-list for upstream security advisories
      lives in the repo.
- [ ] pnpm check:syntax passes.

## Out of scope

- Runtime remote-JS prevention (task 47, TWV-2026-019) — different control.
- Release-integrity / SBOM / reproducible builds (task 35, TWV-2026-006).
- Replacing pnpm with npm/yarn.
