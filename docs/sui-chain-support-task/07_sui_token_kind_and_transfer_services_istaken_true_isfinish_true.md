# Task 07 — `errorCodes.ts` + `tokenKind.ts` + `transferService.ts` + `coinTransferService.ts`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-chain-support-spec.md` §3.2, §4.1.

## Why this matters

Sui's fungible-token surface is **not** a single primitive — there are
three kinds (standard `Coin<T>`, regulated `Coin<T>` with DenyList,
Closed Loop `Token<T>`). A naive transfer that ignores the distinction
silently fails for some users — the same bug class that hit Solana
wallets which only handled legacy SPL Token before Token-2022 mints
proliferated. This task lands the detector + dispatcher + typed errors
in one PR so the kit (Task 08) consumes a finished, tested surface.
Filenames mirror the Solana side exactly so the trees diff 1:1.

## Scope

- `services/chains/sui/errorCodes.ts` — exports the typed errors:
  - `SuiUnsupportedTokenKindError`
  - `SuiInsufficientCoinError`
  - `SuiRegulatedCoinDeniedError`
  - `SuiClosedLoopPolicyDeniedError`
  - `SuiClosedLoopPolicyUnresolvedError`
  - `InvalidSuiPrivateKeyEncodingError` (referenced from Task 04)
  - `InvalidSuiAddressLegacyError` (referenced from Task 06 / Task 14)
  - `UnsupportedSuiSchemeError` (referenced from Task 05)
  - `assertSuiErrorCode(err): err is SuiKnownError` (mirror of
    `assertSolanaErrorCode`).
- `services/chains/sui/tokenKind.ts` — `detectSuiTokenKind(client,
  coinType)` per spec §4.1:
  - Coin<T> via `client.getCoinMetadata` (returns `{kind:"coin", regulated:false, decimals}`).
  - Regulated Coin<T> via DenyList lookup (`coin::DenyCapV2` /
    `0x403::deny_list::DenyList` shared object) → `{kind:"coin",
    regulated:true, decimals, denyListId}`.
  - Closed Loop via `TokenPolicyCreated<T>` event lookup → `{kind:
    "closed-loop", decimals, tokenPolicyId}`.
  - Cached per `(chain.network, coinType)` for the session; cleared on
    `clearAccountCache`.
- `services/chains/sui/transferService.ts` — `buildAndSendSuiTransfer
  ({ client, signer, to, mist }) => Promise<digest>`. PTB shape:
  `splitCoins(tx.gas, [tx.pure.u64(mist)]) + transferObjects([out],
  to)`. Mirrors `services/chains/solana/transferService.ts`.
- `services/chains/sui/coinTransferService.ts` —
  `buildAndSendSuiCoinTransfer({ client, signer, to, coinType, amount })
  => Promise<digest>` per spec §4.1:
  - Coin<T> path: pre-fetch all coins of type, `mergeCoins`,
    `splitCoins`, `transferObjects`.
  - Regulated path: same PTB; map `EAddressDeniedForCoin` /
    `ESenderDeniedForCoin` move-aborts to `SuiRegulatedCoinDeniedError`.
  - Closed Loop path: `0x2::token::transfer<T>(token, recipient,
    policy)` move call; map policy aborts to
    `SuiClosedLoopPolicyDeniedError`.
- Tests for all four files. Snapshot the PTB BCS, decode and assert
  command list per spec §9.

## Rules (non-negotiable)

- **Detector re-runs at every transfer.** A stale `metadata.suiTokenKind`
  hint from the API token row can never produce a malformed PTB —
  the chain is the source of truth.
- **Pure modules — no signer creation.** Both `transferService.ts` and
  `coinTransferService.ts` accept `{ client, signer }` injected by the
  kit. They do not call `getSuiSignerForWallet` themselves.
- **Use SDK intent helpers.** Signing routes through `messageWithIntent`
  / `signTransaction` / `signPersonalMessage` in `@mysten/sui` — never
  hand-rolled intent bytes (TWV-2026-XXX).
- **No deny-list pre-flight.** Regulated coins reveal sender/recipient
  identity to the chain on read; surface the chain abort instead. UX
  copy in §4.1 maps to user-friendly strings.
- **NFTs / Kiosk objects out of scope.** Detector returns `null` →
  `SuiUnsupportedTokenKindError`. UX: "This token type isn't supported
  for transfers yet."
- **Filename parity is load-bearing.** `coinTransferService.ts` (not
  `splTransferService.ts`, not `tokenTransferService.ts`) — reviewers
  diffing the Solana and Sui trees three months from now will grep on
  the parallel name.

## Acceptance

- [ ] All four files land with tests.
- [ ] `detectSuiTokenKind` returns the right discriminator for: standard
      Coin (e.g. wrapped ETH), regulated Coin (USDC), Closed Loop Token
      (sample loyalty token), unknown (NFT type tag).
- [ ] `buildAndSendSuiTransfer` produces the canonical native-SUI PTB —
      snapshot test passes.
- [ ] `buildAndSendSuiCoinTransfer` produces the right PTB shape per kind.
- [ ] Regulated Coin deny-list abort maps to
      `SuiRegulatedCoinDeniedError`.
- [ ] Closed Loop policy abort maps to `SuiClosedLoopPolicyDeniedError`.
- [ ] `pnpm check:syntax` passes; `pnpm run test` passes.

## Out of scope

- `getTokenBalance` Closed-Loop branch — lives on the kit
  (Task 08, with helper `getClosedLoopTokenBalance` here if needed).
- `mapUnknownError` wiring in `services/agent-executors/types.ts` —
  Task 11.
- Send-sheet UX copy for the typed errors — Task 14 surfaces them.
