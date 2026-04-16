# Supply-chain CI gates — TWV-2026-018

**Owner:** mobile-app + CI · **Spec ref:** TWV-2026-018.

> **Status:** This task is CI scope. The JS-side enforcement is the
> `pnpm-lock.yaml` commit + `--frozen-lockfile` in `package.json`'s
> install scripts; everything else needs CI-config changes outside the
> mobile-app repo's reach.

## Hard rules

1. `pnpm install --frozen-lockfile` in CI — no implicit lockfile
   updates ever land via a build.
2. Socket / Snyk gate runs on every PR. Block merge on:
   - new dependencies added without a docs note,
   - any package with a >7d-old advisory,
   - any post-install script that wasn't there before.
3. Pinned exact versions for the wallet-critical deps:
   `viem`, `@scure/bip39`, `@scure/bip32`, `react-native-webview`,
   `expo-secure-store`, `expo-local-authentication`, `expo-crypto`,
   any `@walletconnect/*` (TWV-2026-030).
4. Renovate / Dependabot configured to require manual review for
   minor + major bumps on the pinned set; patches auto-merge only
   after CI green.

## CI checklist

- [ ] `pnpm install --frozen-lockfile` in `.github/workflows/*.yml`.
- [ ] Socket app installed on the GitHub org; gate enabled for the repo.
- [ ] `pnpm-lock.yaml` change in a PR triggers an automatic Socket
      review comment.
- [ ] `package.json` lists wallet-critical deps with `=` not `^`.

## Review gate

Any PR that adds a transitive dep on the wallet-critical set OR
introduces a post-install script MUST cite TWV-2026-018 and have an
explicit Socket "approve" from a second reviewer.
