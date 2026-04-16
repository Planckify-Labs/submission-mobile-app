# Task 32 — Token balances with auto-discovery + spam filtering

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.2a

## Why this matters

Users need to see all their tokens without manually adding each one. The current
app only shows ETH balance with a hardcoded token list. This task adds
auto-discovery from the indexer and client-side spam filtering so airdrop scams
don't pollute the portfolio.

## Scope

Create:

- `services/tokens/types.ts` — `TokenBalance` type (contractAddress, symbol,
  name, decimals, balance, price, logoURI, chainId, namespace, isSpam, source).
  Source enum: `"default-list" | "user-added" | "auto-discovered" | "dapp-watch-asset"`.
- `services/tokens/tokenList.ts` — bundled default token list (top ~500 tokens
  per supported chain, derived from Uniswap/CoinGecko lists). Functions:
  `getDefaultTokens(chainId)`, `addUserToken(token)`, `hideToken(contractAddress, chainId)`,
  `pinToken(contractAddress, chainId)`.
- `services/tokens/spamFilter.ts` — heuristic spam detection:
  - Indexer-side: pass through `isSpam` from Alchemy response.
  - No verified logo + zero-value airdrop + contract < 7 days old → auto-hide.
  - Token name mimics known token (Levenshtein distance < 3 from top-100) → warn badge.
  - User can manually mark as spam → persisted in `expo-sqlite`.
- `hooks/queries/useTokenBalances.ts` — TanStack Query hook wrapping
  `useIndexer().getTokenBalances`. Returns tokens grouped:
  - Main list (default + user-added + pinned discovered).
  - Discovered section (auto-discovered, not yet pinned/hidden).
  - Hidden (spam, user-hidden).

## Rules (non-negotiable)

- **Never auto-add discovered tokens to the main list.** They appear in
  "Discovered" until the user pins them.
- **Spam filter must be deterministic** given the same inputs — no randomness.
- **Levenshtein comparison** uses the top-100 token names list bundled in the app.
- **`expo-sqlite`** for persistence of user preferences (pin/hide/spam).

## Acceptance

- [ ] `tokenList.ts` loads bundled list and supports user additions/hides/pins.
- [ ] `spamFilter.ts` correctly flags known spam patterns (unit tests with fixtures).
- [ ] `useTokenBalances` returns grouped tokens with correct sections.
- [ ] Discovered tokens do not appear in the main list by default.
- [ ] Levenshtein distance check catches "USDC" vs "USDC.e" false positive correctly
      (should NOT flag legitimate variants).
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Portfolio total + price display (task 33).
- Portfolio screen UI components (task 33).
- Expanded spam filtering (phishing names, honeypot) — task 45.

## Depends on

- Task 31 (indexer abstraction).

## Unblocks

- Task 33 (prices + portfolio UI).
