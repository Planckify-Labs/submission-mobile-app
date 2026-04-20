# Task 26 — Backend seed + DB setup for Arc + ETH-hardcoding audit

**Status:** Not taken
**Owner:** Backend (`takumipay-api`), coordinates with mobile-app for QA
**Spec reference:** `umkm-usdc-payout-spec.md` §7.1
**Milestone:** Prerequisite for M2. Must ship before any task 10–15 goes
live against staging, because mobile's `useBlockchains()` / `useTokens()`
hooks read Arc metadata from the DB — hardcoding it on mobile would
violate memory `feedback_filter_at_source.md`.

**Where the rows live — seed, not migration.** `blockchains` and `tokens`
are reference / lookup tables, so the Arc rows belong in
`takumipay-api/prisma/seed.ts` (the `pnpm prisma db seed` pipeline from
the root `CLAUDE.md`), not in a one-shot migration. Seeds are idempotent
by convention (upsert on a unique key), survive local DB resets, and
give dev / staging / prod the same shape by running the same script.
A migration is only needed here if an existing schema constraint blocks
the new rows (see "Schema check" below).

## Why this matters

Arc's defining quirk is that **USDC is the native gas token**, not ETH.
Until the DB row exists, mobile can't render Arc balances via the existing
hooks, and any backend code path that reads `native_currency = "ETH"` as an
implicit EVM assumption will misbehave the moment Arc rows land. §7.1
names this explicitly: *"two-row insert + audit grep"*. We do it once,
correctly, and every future chain (Arc mainnet, Solana-Arc settlement, …)
follows the same two-row pattern — zero mobile release required for
additional chains.

## Scope

### 1. `blockchains` seed entry for Arc Testnet

Add to `takumipay-api/prisma/seed.ts`, using an `upsert` so reseeding is
idempotent. Key on `chain_id`:

```ts
await prisma.blockchain.upsert({
  where:  { chain_id: 5042002 },
  update: { /* leave existing edits alone on reseed, or patch rpc_url if you own the canonical value here */ },
  create: {
    chain_id:        5042002,
    name:            "Arc Testnet",
    is_evm:          true,
    rpc_url:         "https://rpc.testnet.arc.network",
    explorer_url:    "https://testnet.arcscan.app",
    native_currency: "USDC",           // NOT 'ETH' — Arc's defining quirk
    is_testnet:      true,
    is_active:       true,
  },
});
```

- `native_currency = 'USDC'` (**not** `'ETH'`).
- If the seed already groups chains into a `const CHAINS = [...]` array,
  extend that array — keep the existing seed organisation, don't invent a
  parallel "arc-seed.ts".

### 2. `tokens` seed entry for USDC-as-native on Arc

Upsert keyed on `(blockchain_id, contract_address)`:

```ts
const arc = await prisma.blockchain.findUniqueOrThrow({ where: { chain_id: 5042002 } });
await prisma.token.upsert({
  where: { blockchain_id_contract_address: {
    blockchain_id:    arc.id,
    contract_address: "0x3600000000000000000000000000000000000000",
  }},
  update: {},
  create: {
    symbol:             "USDC",
    name:               "USD Coin",
    contract_address:   "0x3600000000000000000000000000000000000000",
    decimals:           6,                       // ERC-20 interface view
    blockchain_id:      arc.id,
    is_stablecoin:      true,                    // both flags true — new combo for this project
    is_native_currency: true,
    is_active:          true,
  },
});
```

- `decimals = 6` — the ERC-20 interface view. Every read path
  (`balanceOf`, `transfer`, `transferWithAuthorization`) and every
  mobile-side amount calc stays on 6 decimals. Leave an inline comment
  noting that the 18-decimal "native gas view" only matters on
  `estimateGas` paths that Nanopayments avoids.
- If the composite unique key `(blockchain_id, contract_address)` doesn't
  exist on the `tokens` model yet, add it — upsert needs it, and it's the
  correct uniqueness invariant regardless.

### 3. Schema check (migration only if needed)

This is the first row where **both** `is_stablecoin` and
`is_native_currency` are true on the same token. Verify no CHECK
constraint, Prisma `@@check`, or application-layer validator rejects
that combination. If one does, ship a focused migration that relaxes it
— do not patch it around in code. If nothing rejects it, no migration is
needed; the seed change stands alone.

### 4. ETH-hardcoding audit

Run the §7.1 grep pass **and fix every hit**:

```
grep -r "'ETH'"           takumipay-api/src/
grep -r '"ETH"'           takumipay-api/src/
grep -r "nativeCurrency"  takumipay-api/src/
grep -rE "native.*ETH"    takumipay-api/src/
```

Common offender locations called out by the spec:

- Gas-price fetch helpers (they assume ETH pricing / 18-dec formatting).
- Analytics event tagging (`chain_family = "ethereum"` strings — Arc is
  *not* part of the Ethereum family for reporting).
- Balance-formatting utilities that hardcode `decimals: 18` for EVM
  natives. Arc inverts that: read the token row, don't assume.

For each hit: replace with a lookup against the `blockchains` /
`tokens` row. If a helper genuinely needs the native decimals, read it
from the `tokens.decimals` column — do not hardcode.

### 5. Mainnet cut-over note (not executed now, pinned for §10.1)

**Principle: `is_testnet` is a fact about the chain, never a toggle.** A
row with `chain_id = 5042002` is the Arc **testnet** for its entire
lifetime — it keeps `is_testnet: true` forever. When Arc mainnet lights
up, it arrives as a **new row** with its own `chain_id` and
`is_testnet: false`, paired with its own `tokens` entry at the mainnet
USDC contract. The two rows coexist.

Add an inline comment next to the Arc seed entries so the next engineer
doesn't mistakenly mutate the testnet row:

```ts
// Arc Testnet — is_testnet stays true for the life of this row.
// When Arc mainnet launches (§12 Q1), add a SEPARATE seed entry with
// the mainnet chain_id / rpc_url / explorer_url and is_testnet: false,
// plus a paired tokens entry at the mainnet USDC contract. To retire
// this testnet row from user-facing lists, flip is_active = false
// (never is_testnet). No schema changes.
```

Heads-up: spec §7.1 insert 3 phrases the cut-over as *"flip `is_testnet`
to false"* — that wording is loose. The correct read, captured above, is
*add a second row*. Flag a tiny spec edit on the next pass to align the
language.

## Rules (non-negotiable)

- **Seed, not raw SQL or `psql` INSERT.** `pnpm prisma db seed` is the
  documented pipeline in the root `CLAUDE.md`; ship through it so local,
  staging, and prod stay in sync after the next reset.
- **Idempotent upserts only.** Reseeding must be safe — no uniqueness
  violations, no duplicate Arc rows.
- **Single source of truth is the DB.** Once this ships, any backend
  handler that hardcodes Arc chain id, RPC url, or USDC address is a bug.
- **Do not invent a `chain_family` column just to exclude Arc from
  Ethereum analytics.** Read `native_currency` / `is_evm` from the row
  and derive the label — a new column for one chain is premature
  abstraction.
- **Coordinate with mobile QA before enabling the row on staging.** A
  freshly-seeded Arc row becomes visible to every client on the next
  `useBlockchains()` refetch; make sure task 10 has merged the
  `ChainConfig` entry so the app renders it with the right icon.

## Acceptance

- [ ] `prisma/seed.ts` includes the Arc Testnet + USDC-on-Arc upserts.
- [ ] `pnpm prisma db seed` runs cleanly twice in a row against a fresh
      DB (idempotency) and against a DB that already has the Arc rows
      (no-op on second run).
- [ ] `SELECT * FROM blockchains WHERE chain_id = 5042002` returns the
      expected row with `native_currency = 'USDC'`.
- [ ] `SELECT * FROM tokens WHERE contract_address =
      '0x3600…0000' AND is_native_currency = true` returns the expected
      row with `decimals = 6`.
- [ ] Schema-check step: no existing constraint blocks
      `is_stablecoin = true AND is_native_currency = true`. If a
      migration was needed to relax one, it's merged.
- [ ] Every grep hit from §7.1's audit list is either removed or replaced
      with a DB-backed lookup; grep re-runs clean.
- [ ] Mobile smoke: with the row seeded on staging, `useBlockchains()`
      and `useTokens()` surface Arc Testnet + USDC without a mobile
      rebuild.
- [ ] `pnpm test` on `takumipay-api` passes; any new helper that reads
      native decimals has at least one unit test exercising the Arc row.

## Out of scope

- Mobile-side `ChainConfig` entry (task 10).
- `MerchantTreasury.sol` deployment (§7 defers — v1 uses an EOA).
- Arc mainnet seed entries (§10.1 migration, separate PR).
