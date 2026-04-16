# Task 13 — Explorer-URL allowlist; reject dApp-supplied `blockExplorerUrls`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-049, §7 (non-regression), §9 (DiD checklist rows)

## Why this matters

`wallet_addEthereumChain` (EIP-3085) accepts `blockExplorerUrls` from
the dApp. If the wallet stores them and later renders "View on
Explorer" links in tx history, those links point at the attacker's
Etherscan-clone phishing page — which prompts the user to "claim your
reward" back via a deeplink and harvests a signature. Same shape of
attack as TWV-2026-016 but the *explorer* UI surface, not the RPC.
The spec points at `services/chains/evm/chainStore.ts`. §9 "DApp
browser / EIP-1193" row requires validation against the chainid.network
registry with "Custom — unverified" banner on mismatch.

## Scope

1. In `services/chains/evm/chainStore.ts`, validate every incoming
   `blockExplorerUrls` (also `iconUrls`, `nativeCurrency.name` —
   mentioned in spec) from `wallet_addEthereumChain` against a pinned
   per-chainId allowlist built from chainid.network + internal
   overrides.
2. If the host matches the allowlist, store as "verified" and render
   explorer links normally.
3. If not, store as "custom explorer — not verified". All UI that
   renders the link must:
   - Show a "Custom explorer — not verified" banner.
   - Require a long-press (not a single tap) to open.
   - Open in an in-app WebView with strict `originWhitelist`
     (`https://*` only).
4. Same discipline for `iconUrls` (no HTML, no URL autolinking) and
   `nativeCurrency.name` (treat as an untrusted string — strip
   control chars, clip length).
5. Add a curated allowlist module (JSON or TS) seeded from
   chainid.network for the chains currently in the registry.

## Rules (non-negotiable)

- **Allowlist per chainId.** A URL valid on chain A is not valid on
  chain B.
- **Non-matching explorers are usable but hostile-by-default.**
  Banner, long-press, in-app WebView only. §7.1.1 — we warn and
  restrict, we don't silently drop.
- **dApp-supplied strings are never rendered as HTML.** Only as
  plain text inside RN `<Text>`; no URL autolinking.
- **Chain list preserved (§7.1.7).** Chains currently in
  `chainStore` are grandfathered; if their pre-existing explorer
  URL isn't in the pinned allowlist, mark it verified via the
  "internal overrides" layer rather than regressing the link.

## Acceptance

- [ ] Allowlist module exists and is seeded for every chain
      currently in `services/chains/evm/chainStore.ts`.
- [ ] Unit test: `wallet_addEthereumChain` with a legit
      `blockExplorerUrls` → stored as verified. With an attacker
      URL → stored as "custom — unverified" and banner-wrapped.
- [ ] "View on Explorer" link for a custom-unverified chain requires
      long-press and opens in the in-app WebView with
      `originWhitelist=['https://*']`.
- [ ] Manual regression: re-add an existing chain via the dApp
      browser; explorer links still work on verified chains.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- RPC chainId trust — TWV-2026-016 (task 07), sibling issue.
- Silent chain-switch prevention — TWV-2026-017 (Phase 3, task 36).
- Live scam-domain feed on dApp origins — TWV-2026-051 (Phase 2,
  task 29).
