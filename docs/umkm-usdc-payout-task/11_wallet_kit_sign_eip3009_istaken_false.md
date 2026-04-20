# Task 11 — `WalletKitAdapter.signTransferWithAuthorization` (EVM)

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §5.4, §5.5 (wallet-kit surface),
§11 M2

## Why this matters

EIP-3009 `TransferWithAuthorization` is the one new signing primitive
Nanopayments (and raw x402) need. It's behavior-identical to the existing
`signTypedData` plumbing — the point of this task is to expose it through
the same `WalletKitAdapter` port so no consumer ever branches on namespace
(memory `feedback_chain_extension_discipline.md`).

## Scope

- Add the `signTransferWithAuthorization?` method to `WalletKitAdapter` in
  `services/walletKit/types.ts` exactly as in §5.5. Optional — Solana kit
  leaves it `undefined`.
- Implement it on `services/walletKit/EvmWalletKit.ts`:
  - Build the EIP-712 domain: `{ name: "USD Coin", version: "2", chainId,
    verifyingContract: usdc }` (USDC deployments use this static name/version
    pair). Do not hardcode `chainId` — read from `args.chain`.
  - Types:
    ```
    TransferWithAuthorization: [
      { name: "from",        type: "address" },
      { name: "to",          type: "address" },
      { name: "value",       type: "uint256" },
      { name: "validAfter",  type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce",       type: "bytes32" },
    ]
    ```
  - `message` from args (`valueMicros` → `value`).
  - Sign via existing `viem` account signer; return the 65-byte `0x…` sig.
- Adapter returns **signature only**. No broadcast, no POST. Submission is
  task 13's job.
- `SolanaWalletKit.signTransferWithAuthorization` stays undefined
  (§5.5 locked decision). Callers detect presence, not namespace.
- Unit test under `services/walletKit/EvmWalletKit.test.ts`: given a fixture
  private key + fixture args, produce a deterministic signature and verify
  it against the EIP-712 digest in a second pass.

## Rules (non-negotiable)

- **Signer ≠ submitter.** This method returns a signature and nothing else.
- **Branch on presence, not namespace.** UI that invokes this does
  `if (kit.signTransferWithAuthorization) { … }` — not `if (ns === "eip155")`.
- **No side effects on `TWallet`.** Don't bump counters or write to
  secure storage.
- **Chain hopping is rejected at build time.** If `args.chain.namespace !==
  "eip155"`, throw a typed error — this is a programmer error, not a runtime
  user error.

## Acceptance

- [ ] `services/walletKit/types.ts` exports the method.
- [ ] `EvmWalletKit` implements it, Solana does not.
- [ ] Unit test passes with a deterministic signature fixture.
- [ ] Grep shows no consumer of the method yet — task 15 wires it.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Building the typed-data payload from a `PaymentIntent.nanopay` block
  (task 12 — kept pure so it's testable without a wallet).
- Submission to the proxy (task 13).
