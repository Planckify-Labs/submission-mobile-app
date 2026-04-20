# Task 20 — `services/nanopay/gatewayDeposit.ts`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §5.2 (setup step 1), §5.4
(gasless table), §5.5 (service module list), §6.2 (`GaslessBlock`,
`DepositReceiptRequest/Response`)

## Why this matters

One place resolves "how does this user's first Gateway deposit happen?" —
Paymaster-wrapped on Base/Arbitrum, plain `sendTransaction` elsewhere. The
service composes tasks 11 and 19 so `/onboarding/nanopay-deposit` (task 21)
stays a thin UI.

## Scope

- Create `services/nanopay/gatewayDeposit.ts`:
  ```ts
  export interface DepositInput {
    wallet:             TWallet;
    chain:              ChainConfig;                     // source chain with user's USDC
    gatewayWallet:      `0x${string}`;
    amountMicros:       bigint;
    useCirclePaymaster: boolean;                         // from GaslessBlock.deposit
  }
  export interface DepositResult {
    txHash:        `0x${string}`;
    useCirclePaymaster: boolean;
  }
  export const sendGatewayDeposit = async (i: DepositInput, kit: WalletKitAdapter): Promise<DepositResult> => { … };
  ```
- Decision tree:
  1. If `useCirclePaymaster` **and** `kit.sendUserOpWithUsdcPaymaster` is
     defined → build an EIP-2612 `permit` over USDC for the paymaster
     (`deadline = now + 10m`), then call `sendUserOpWithUsdcPaymaster` with
     calls `[approve(paymaster), depositFor(gatewayWallet, user, amount)]`
     (or the equivalent single-call sequence Circle Paymaster expects —
     confirm against `developers.circle.com/paymaster`).
  2. Else → plain `kit.sendTokenTransfer` (existing method) of USDC to the
     `GatewayWallet` contract's `depositFor` function. If the existing
     method doesn't support arbitrary `data`, extend it under a new
     `kit.sendContractCall` helper (this is the "tokenized write path" §7
     references — implement here if not already present).
- Return `{ txHash, useCirclePaymaster }` exactly as the caller needs for
  `DepositReceiptRequest`.
- Unit tests with both branches mocked.

## Rules (non-negotiable)

- **Adapter-only chain I/O.** No direct `viem.writeContract` in this file.
- **Permit signing stays inside the kit** via an existing
  `signTypedData` entry — don't reach into `viem` from the service layer.
- **Do not broadcast receipt to backend here.** That's task 22.
- **Reject on Solana.** Gateway is EVM-only in v1; a Solana active wallet
  at this point is a programmer error (task 21 filters before calling).

## Acceptance

- [ ] Service exists + both branches unit-tested.
- [ ] No `viem.writeContract` / raw RPC usage in the file (grep).
- [ ] `pnpm check:syntax` passes.

## Out of scope

- UI (task 21).
- Attestation polling (task 22).
