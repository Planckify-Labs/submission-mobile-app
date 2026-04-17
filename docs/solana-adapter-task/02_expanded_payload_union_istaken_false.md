# Task 02 — Expanded `SolanaApprovalPayload` union

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §4.3, §4.5.

## Why this matters

Today `services/chains/solana/payloads.ts` carries three shapes
(`connect` / `signMessage` / `signTx`). Every 1a/1b task downstream
depends on the full union landing first: the adapter routes on
`SolanaApprovalPayload.kind`, inspectors patch `payload.simulation` /
`payload.decoded`, renderers pattern-match on the shape. Building this
in one commit prevents the "each task grows the union" sprawl that
makes review expensive.

## Scope

- `services/chains/solana/payloads.ts` — add/expand per §4.3:
  - `SolanaCluster = "mainnet-beta" | "devnet" | "testnet"`.
  - `SolanaChain` — union of six short-form + CAIP-2 genesis-hash
    variants. Keep as **exported literal-string union**, not `string`.
  - `canonicalizeChain(input: string): SolanaChain` — normalises
    genesis-hash form to short form for routing; returns the input
    unchanged if already short. Throws `-32602` on unknown.
  - `SolanaConnectPayload { cluster, onlyIfTrusted }`.
  - `SolanaSignInPayload` — full SIWS field set (domain, address?,
    statement?, uri?, version?, chainId?, nonce?, issuedAt?,
    expirationTime?, notBefore?, requestId?, resources?).
  - `SolanaSignMessagePayload { address, message, display:
    "utf8"|"base64" }`.
  - `SolanaTxVersion = "legacy" | 0`.
  - `SolanaSignTxPayload` — `mode`, `address`, `cluster`, `version`,
    `transaction` (base64), `options` (commitment / skipPreflight /
    maxRetries / preflightCommitment / minContextSlot), `simulation?`,
    `decoded?`.
  - `SolanaSignAllTransactionsPayload` — `address`, `cluster`,
    `transactions[]`.
  - `SolanaSwitchClusterPayload { from, to }`.
  - `SolanaWatchTokenPayload` — `mint`, `symbol?`, `name?`, `decimals?`,
    `image?`, `tokenStandard?`, `verified?` (filled by adapter).
  - `SolanaSimulationSummary` — `unitsConsumed`, `balanceChanges[]`,
    `tokenChanges[]` (with `tokenProgram` tag), `warnings[]`, `logs[]`.
  - `SolanaSimulationWarning` — tagged union of all §4.3 codes
    (`writable.*`, `nonce.authority-mismatch`, `lookup-table.expanded`,
    `token2022.*`, `ata.close-authority-change`, `setAuthority`).
  - `SolanaDecodedInstruction` — tagged union for `system`, `spl-token`,
    `token-2022`, `compute-budget`, `memo`, `unknown`.
- Union type `SolanaApprovalPayload` with a discriminator (`kind`)
  matching `ApprovalKind` enums.
- Zod schemas co-located (`payloads.zod.ts` or inline) for every input
  shape crossed from the injected script — used by Task 21.

## Rules (non-negotiable)

- **No `any` and no `unknown` leaking past this file.** Every payload
  field is fully typed; `SolanaDecodedInstruction.data` is the only
  `unknown` and is narrowed by the decoder.
- **`transaction` stays base64.** Base58 signatures are separate; do
  not conflate. Renderers always read the base64 form.
- **`cluster` is `SolanaCluster`, `chain:` wire value is
  `SolanaChain`.** The former is the internal RPC-routing key; the
  latter is what the dApp sends. Canonicalise at the boundary.
- **No behavioural code.** This task is pure types + `canonicalizeChain`.

## Acceptance

- [ ] `pnpm check:syntax` passes across the whole app with the new
      union in place.
- [ ] `canonicalizeChain` unit tests — short → short, genesis → short,
      unknown → throws `-32602`.
- [ ] Every new shape reachable from `SolanaApprovalPayload`.

## Out of scope

- Populating `simulation` / `decoded` (Tasks 11, 12).
- Renderers / sheets (Tasks 07, 15–19).
- Injected script wire format (Task 03).
