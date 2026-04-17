# Task 23 — Durable nonce handling + authority mismatch danger

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §6 Phase 1c, §10.4 inv 4.

## Why this matters

Durable-nonce transactions are the offline-signing path —
Phantom / Backpack support them; Drift Vaults, advanced OTC flows,
and some cold-signed institutional flows use them. Without detection,
the sheet shows "recent blockhash, ~60 s" for a tx that's actually
valid indefinitely — user expects it to expire, approves thinking
"worst case it'll just drop," then an attacker broadcasts it 30 days
later. Detecting the nonce authority and surfacing authority
mismatches is a P1c GA blocker for any dApp that uses durable
nonces.

## Scope

- `services/chains/solana/programDecoder.ts` — already decodes
  `AdvanceNonceAccount` (Task 12). Extend to surface:
  - `isDurableNonceTransaction: boolean` — first instruction is
    `AdvanceNonceAccount`.
  - `nonceAuthority: Address` — extracted from that instruction's
    account keys.
- `SolanaSimulationInspector` (Task 11):
  - When `isDurableNonceTransaction`:
    - Lifetime display hint in `simulation`: `lifetime: "durable"`.
    - If `nonceAuthority !== activeWallet.address`:
      - Check if the dApp supplied an authority-pre-approval (an
        existing signature slot in the tx from the authority). If yes
        → `info: "Durable nonce, authority pre-approved"`.
      - If no → `danger: "Nonce authority ({addr}) is not the signing
        wallet — this tx may be re-broadcast without your consent"`.
- `SolanaTransactionSheet` (Task 16):
  - Lifetime row shows "Durable nonce, advances on sign" instead of
    "Recent blockhash, ~60 s".
  - Nonce authority row explicit when not signing wallet.
- `broadcast.ts` (Task 20):
  - Durable path already present in state machine; verify the
    per-intent timeout default (90 s) is correct for authority-is-signer
    case; extend to 10 min on offline-signing flows (§8 Q6).

## Rules (non-negotiable)

- **Authority mismatch always visible.** Invariant 4. If authority ≠
  signer and no pre-signed authority signature is present, the sheet
  renders `danger` and hold-to-approve is required.
- **Lifetime display is not optional.** Durable vs recent-blockhash
  changes the user's mental model of "when this can execute."
- **We do not forge authority signatures.** Signer signs as itself,
  never as the nonce authority.

## Acceptance

- [ ] Fixture: durable tx, authority is signer → lifetime reads
      "durable"; no danger.
- [ ] Fixture: durable tx, authority is 3rd party, no pre-sig →
      danger banner.
- [ ] Fixture: durable tx, authority pre-signed → info banner.
- [ ] Broadcast: durable path timeout behaves per §8 Q6 default.
- [ ] Backpack nonce-signer demo: round-trip works.

## Out of scope

- UI "keep waiting" extension (tracked separately).
- Originating durable-nonce txs from first-party features.
