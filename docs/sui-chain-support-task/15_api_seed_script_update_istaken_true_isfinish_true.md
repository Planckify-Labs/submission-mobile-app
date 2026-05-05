# Task 15 — `takumi-api/src/scripts/prisma/seed.ts` — Sui blockchain rows + USDC token row

**Status:** Not taken
**Owner:** Backend (takumi-api repo)
**Spec reference:** `sui-chain-support-spec.md` §3.7, §3.8, §12 (rollout).

## Why this matters

The mobile token list is API-driven (spec §3.7) — `tokenApi.searchTokens
({ blockchainId })` is the only path the mobile picker / agent
executors read. Without a Sui blockchain row + USDC token row in the
backend database, Phase 3 (Sui kit registered, create-new derives a Sui
wallet) ships to QA looking like the integration is broken: empty token
lists, no balances, agent tools returning "no Sui chain known".

**This task lives in the `takumi-api` repo, not the mobile-app repo.**
It's listed here as a companion so the mobile rollout has a single
source of truth for the dependency.

## Scope

- `takumi-api/src/scripts/prisma/seed.ts`:
  - **A. Blockchain rows** — append to the existing `blockchains`
    array (line ~530), **after** the Monad entry, so existing
    `blockchains[N]` index references stay stable. Keyed on
    `chainSlug`:
    - `sui-mainnet` → `https://fullnode.mainnet.sui.io:443`,
      explorer `https://suivision.xyz`, `isEVM: false`,
      `isTestnet: false`.
    - `sui-testnet` → `https://fullnode.testnet.sui.io:443`,
      explorer `https://testnet.suivision.xyz`, `isEVM: false`,
      `isTestnet: true`.
  - **B. USDC token row** on Sui mainnet — appended to the `tokens`
    array (~line 813). Uses `contractAddress` to carry the Sui
    CoinType (`0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC`)
    — same column-reuse pattern Solana uses for SPL mints. Decimals 6.
    `isStablecoin: true`, `peggedCurrency: "USD"`,
    `logoUrl: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png"`.
- The `<SUI_MAINNET_INDEX>` placeholder in spec §3.8 = the actual
  array slot picked at PR time, after appending the Sui rows. Don't
  hard-code a literal — future seed insertions shift indices and
  silent drift becomes an outage.
- Re-seed dev + staging; verify mobile picker renders Sui mainnet +
  testnet rows and the agent's `search_tokens` returns USDC on
  mainnet.

## Rules (non-negotiable)

- **Append, don't insert.** Inserting between existing rows shifts
  every `blockchains[N]` index — silent drift. The Sui rows go at the
  end of the array, after Monad.
- **`update: {}` for token rows.** Re-seed never overwrites an
  ops-edited token row (logo, isActive, decimals).
- **`update` on blockchain rows refreshes `rpcUrl` + `blockExplorer`
  only.** Gateway / x402 / paymaster / bundler / `solanaCluster` /
  `takumiPayProgramId` columns must remain absent — Sui has none of
  those in v1 (matches the Solana mainnet entry posture).
- **No new schema columns.** `chainSlug` is the discriminator (no
  `suiNetwork` enum), `contractAddress` carries the CoinType (no new
  `coinType` field). Future schema additions land in a follow-up
  migration.
- **Public Mysten fullnode is the v1 endpoint.** Swap to a paid
  provider via re-seed once mobile traffic warrants it (mirrors the
  Solana rollout).

## Acceptance

- [ ] Two new blockchain rows present after re-seed (`sui-mainnet`,
      `sui-testnet`).
- [ ] One new token row (USDC on `sui-mainnet`).
- [ ] Re-seed in dev + staging is idempotent (no duplicate rows; no
      ops-overwrite).
- [ ] Mobile dev-client (with mobile PR 3 staged but not merged) reads
      the Sui rows from `/blockchains` and the USDC row from
      `/tokens?blockchainId=<sui_row_id>`.
- [ ] **Merged before mobile Phase 3 (PR 3) lands in any environment.**

## Out of scope

- TakumiPay Move package on Sui — out of scope per spec §13. When
  that lands, add a `suiTakumiPayPackageId` column to `Blockchain`
  alongside `takumiPayProgramId`.
- SuiNS columns / configuration — deferred.
- Devnet row — not required for v1; add if QA explicitly requests.
- Mobile-side token caching — already MMKV-cached with the Solana
  pattern (5-min TTL).
