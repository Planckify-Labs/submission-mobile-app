# Task 33 — Token price feeds + portfolio aggregation UI

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.2a (price feeds), §6 Phase A

## Why this matters

Users need to see the USD value of their holdings, 24h change, and a portfolio
total. This is the most-viewed screen in any wallet app.

## Scope

Create:

- `services/tokens/prices.ts` — price feed aggregation:
  - Batched `getTokenPrices` via indexer (cached 60s).
  - Portfolio total computed client-side by summing `balance * price` for all
    non-hidden tokens.
  - Native currency conversion (user-configurable: USD, EUR, IDR, etc.) using
    a simple exchange rate feed.
- `hooks/queries/useTokenPrices.ts` — TanStack Query hook for price data.
- `components/portfolio/TokenRow.tsx` — single token row: logo, symbol, balance,
  USD value, 24h change (green/red).
- `components/portfolio/PortfolioChart.tsx` — portfolio total value display with
  24h change percentage. Simple numeric display for v1 (chart visualization is
  a fast-follow).
- `components/portfolio/SpamBadge.tsx` — badge component for spam/warn states.
- Update portfolio screen (existing `app/(tabs)/index.tsx` or equivalent) to use
  `useTokenBalances` + `useTokenPrices` and render `TokenRow` list with
  `PortfolioChart` header.

## Rules (non-negotiable)

- **Price refresh interval: 60s.** Do not poll more aggressively.
- **Stale prices show with a "stale" indicator** rather than disappearing.
- **Portfolio total excludes hidden/spam tokens.**
- **Currency preference** persisted in `expo-sqlite` or `AsyncStorage`.

## Acceptance

- [ ] Token prices fetched and cached at 60s intervals.
- [ ] Portfolio screen shows token list with USD values and 24h change.
- [ ] Portfolio total computed correctly across all non-hidden tokens.
- [ ] `SpamBadge` renders for spam and warn states.
- [ ] Currency preference persists across app restarts.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Line chart / sparkline visualization (fast-follow).
- Price alerts (task 58).

## Depends on

- Task 31 (indexer), Task 32 (token balances).

## Unblocks

- Phase A exit criteria (portfolio shows all balances with prices).
