# Stellar chain support — engineering spec

**Status:** Draft (research + design, no code yet)
**Author:** Claude (research synthesis, via `stellar-dev` plugin skills +
direct verification against SEP-0005/SEP-0023 text, official
developers.stellar.org docs, `js-stellar-base` SDK source, the npm
registry, and this project's actual `../api` sibling repo — see §14
Sources for the full citation list)
**Date:** 2026-07-07
**Companion:** `docs/stellar-chain-support-task/` (task breakdown — to be filled)
**Related:** `docs/sui-chain-support-spec.md` (the precedent we mirror — same
space-docking pattern, adapted for a fundamentally different ledger model),
`docs/solana-chain-support-spec.md`

---

## 0. Goal & non-goals

### Goal
Add **first-class Stellar chain support** to the mobile app, mirroring the
space-docking architecture used for Solana/Sui so that:

1. A user can **create / import a Stellar wallet** alongside their EVM,
   Solana, and Sui wallets, sharing the same BIP-39 mnemonic where possible.
2. A user can **send / receive XLM and Stellar assets (USDC, EURC, …)**
   from the mobile UI, including the trustline-establishment step Stellar
   requires before an account can hold a non-native asset.
3. The wallet is **ready to be exposed to Agent Mode** (read tools +
   sign-and-execute) by adding tool descriptors that route through the
   existing `WalletKitAdapter` seam.
4. The wallet is **positioned for the "Local Finance & Real-World Access"
   / "Payment & Consumer Applications" hackathon tracks** — Stellar's
   anchor network (SEP-6/24/31) is the natural rail for bridging pulsa /
   PLN / merchant-payment flows to on-chain settlement. This spec does
   **not** implement anchor integration; it lays the chain-support
   foundation that a follow-up spec builds on (§13).

### Non-goals (this milestone)
- Stellar dApp-bridge wiring (injected provider, approval sheets,
  inspectors). Scaffold only, disabled by a feature flag — mirrors the
  Sui milestone's posture.
- Soroban smart-contract invocation (SAC transfers via a contract client,
  custom contracts). v1 uses **classic operations only** (`payment`,
  `changeTrust`, `createAccount`). SAC/Soroban is flagged as future work
  (§13) — see also the risk in §11 about RPC vs Horizon for this reason.
- SEP-6/24/31 anchor integration (fiat on/off-ramp, cross-border corridors).
  This is the actual "real-world access" payoff but is a separate spec
  once chain support lands — an anchor integration needs a *funded,
  working* Stellar wallet to build on top of.
- **Literal SEP-10** (challenge-transaction-based web auth, the form
  Stellar anchors expect). TakumiPay's own login does **not** use SEP-10
  for any chain today (verified against `api/src/auth/` — see §4.2) —
  it uses a bespoke per-namespace "Sign-In-With-X" message+signature
  scheme (`SiwsService` for Solana, `SiwsSuiService` for Sui). Stellar
  gets the same treatment (`SiwsStellarService`) and **is in scope for
  this milestone** (§4.2, §10) — only literal SEP-10 (needed if/when an
  anchor integration requires it) is deferred to §13.
- Multisig, path payments, liquidity pools, claimable balances, sponsored
  reserves. Flagged as future work (§13); sponsored reserves in
  particular would remove the biggest onboarding friction (§11) and
  should be an early follow-up.
- Muxed accounts (`M...`), contract addresses (`C...`) as send
  destinations. v1 sends only to plain `G...` ed25519 account IDs.

---

## 1. Background — the Stellar ledger model (what's different from EVM/Solana/Sui)

Stellar is not account-abstraction-shaped like Solana/Sui (no arbitrary
on-chain objects) and not EVM-shaped (no contract bytecode driving
transfers by default). It's closer to a purpose-built payments ledger:
accounts, a fixed operation set, and assets identified by
**(code, issuer)** pairs rather than mint addresses or coin types. Four
properties drive almost every design decision below.

### 1.1 Network identifiers (CAIP-2)
Per the Chain Agnostic Improvement Proposals registry (CAIP-28,
[namespaces.chainagnostic.org/stellar/caip2](https://namespaces.chainagnostic.org/stellar/caip2)) —
Stellar has exactly two public networks, and CAIP-2 identifies them by
network passphrase:

| Chain id         | Network                        | Network passphrase |
|------------------|---------------------------------|---|
| `stellar:pubnet`   | Mainnet ("Public Global Stellar Network") | `Public Global Stellar Network ; September 2015` (`StellarSdk.Networks.PUBLIC`) |
| `stellar:testnet`  | Testnet ("Test SDF Network")   | `Test SDF Network ; September 2015` (`StellarSdk.Networks.TESTNET`) |

Note the CAIP-2 reference is **`pubnet`**, not `mainnet` — Stellar's own
terminology, confirmed by the CAIP-28 spec text above (not assumed).
Internally we still name our `ChainConfig.network` field
`"mainnet" | "testnet"` for consistency with the Solana/Sui variants; the
CAIP mapping layer (§3.9) is where the `mainnet ⇄ pubnet` translation
lives, exactly the seam `services/walletconnect/caipMapping.ts` already
exists for.

### 1.2 Cryptography & key derivation
- **Ed25519** only (no secp256k1 accounts on Stellar).
- **Address = the encoded public key itself.** Unlike Sui (which hashes
  `flag || pubkey` with BLAKE2b to get a derived address), a Stellar
  account ID **is** its StrKey-encoded ed25519 public key. No hashing
  step, no separate address-derivation function once you have the raw
  32-byte public key.
- **StrKey encoding** — [SEP-0023](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0023.md)
  (fetched directly from the stellar-protocol repo, quoted verbatim
  below, not inferred): each strkey is
  `base32(version_byte || payload || crc16(version_byte || payload))`,
  CRC16 using polynomial `x¹⁶ + x¹² + x⁵ + 1`, encoded with
  [RFC 4648 base-32](https://tools.ietf.org/html/rfc4648#section-6)
  **without padding**. The version byte's top 5 bits select the key
  type ("base value"); SEP-0023's own table (only the rows relevant to
  this spec's v1 scope shown):
  | Key type | Base value | First char | Relevance here |
  |---|---|---|---|
  | `STRKEY_PUBKEY` | `6 << 3` = 48 | `G` | **The account address** — an ed25519 public key. |
  | `STRKEY_PRIVKEY` | `18 << 3` = 144 | `S` | **The private-key import format** — an ed25519 secret seed. |
  | `STRKEY_MUXED` | `12 << 3` = 96 | `M` | Muxed account (out of scope, §0). |
  | `STRKEY_CONTRACT` | `2 << 3` = 16 | `C` | Soroban contract address (out of scope, §0). |

  (SEP-0023 also defines `T`/pre-auth-tx, `X`/hash-x, `P`/signed-payload,
  `L`/liquidity-pool, `B`/claimable-balance — none used by this v1
  milestone.) SEP-0023 additionally **requires** implementations to
  reject any strkey whose length is congruent to 1, 3, or 6 mod 8 before
  base-32 decoding, and to reject any input that doesn't round-trip to
  the exact same string on re-encode — cited explicitly because it's a
  named source of real bugs per the SEP's own "Tests" section, not a
  detail we're inventing a guard for.
- **Key derivation** — [SEP-0005](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0005.md)
  (also fetched directly): BIP-0039 mnemonic → BIP-0039 seed →
  **SLIP-0010 ed25519** (fully hardened, same primitive Solana/Sui
  already use in this repo) → path **`m/44'/148'/x'`**, coin_type `148`
  per [SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md).
  SEP-0005 calls `m/44'/148'/0'` the **"primary key"** — one hardened
  level shallower than Solana's `m/44'/501'/0'/0'` or Sui's
  `m/44'/784'/0'/0'/0'` in this codebase, because SEP-0005 itself stops
  at the account level (no change/address-index levels, unlike BIP-44's
  full 5-level path — the SEP's own "Rationale" section explains this is
  because SLIP-0010 ed25519 forbids non-hardened child derivation, and
  Stellar's minimum-balance-per-account design assumes most users use a
  single primary account). SEP-0005 publishes an official first test
  vector we can cite directly rather than trusting a third-party
  package:
  ```
  Mnemonic (12 words): illness spike retreat truth genius clock brain pass fit cave bargain toe
  m/44'/148'/0' → GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6 / SBGWSG6BTNCKCOB3DIFBGCVMUPQFYPA2G4O34RMTB343OYPXU5DJDVMN
  ```
  Per the "chain extension discipline" precedent set by Solana's
  `derivation.ts` (which hand-rolled SLIP-0010 against `@noble/hashes`
  rather than pulling `ed25519-hd-key`, which drags in Node's `stream`
  via `cipher-base` and can't run under Hermes), we **reuse the existing
  in-repo SLIP-0010 walker**
  (`services/chains/solana/derivation.ts#derivePathSlip10Ed25519`)
  rather than adding the community `stellar-hd-wallet` package as a new
  dependency — it's already a generic path walker parameterized only by
  `path`; Stellar just supplies a different path string and reads 3
  hardened segments instead of 4. The SEP-0005 test vector above is the
  vector Task 03 checks our walker's output against.

### 1.3 Account model — sequence numbers and the reserve
- Every transaction consumes the source account's **sequence number**
  (`account.sequence + 1`); the caller must `loadAccount`/`getAccount`
  immediately before building a transaction (same class of problem as
  an EVM nonce, but Stellar has no local nonce-management escape hatch
  — always read-before-build).
- **Accounts must be created on-ledger before they exist.** Per the
  official docs
  ([Stellar Docs — Accounts](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/accounts)):
  "Before an account is funded it does not truly exist. Accounts can
  only exist with a valid keypair … and the required minimum balance of
  XLM." And per the
  [`createAccount` guide](https://developers.stellar.org/docs/build/guides/transactions/create-account):
  "When sending a payment to an account that does not yet exist on the
  Stellar ledger, a `createAccount` operation will be used, and the
  amount you send must be at least 1 XLM." There is no lazy "any valid
  pubkey works" behavior like EVM/Solana/Sui — the mobile kit must
  detect "destination doesn't exist yet" (a 404 from `loadAccount`) and
  switch operation type accordingly (§4.3).
- **The base reserve.** Per the same official Accounts doc: "One base
  reserve is currently 0.5 XLM," every account must hold "a minimum
  balance of two base reserves (currently 1 XLM)," and "every subentry
  after that requires an additional base reserve (currently 0.5 XLM)
  and increases the account's minimum balance." Subentries are
  "trustlines … offers, signers, and data entries," capped at 1,000 per
  account. **Adding a trustline costs 0.5 XLM of now-locked reserve** —
  this is the single biggest UX friction point for a payments app
  onboarding non-crypto-native users onto a stablecoin, and the reason
  "sponsored reserves" (§13,
  [Stellar Docs — Sponsored Reserves](https://developers.stellar.org/docs/build/guides/transactions/sponsored-reserves))
  is the highest-value follow-up, not merely a nice-to-have.
- **Fees are flat, not gas-metered.** Per the official
  [Fees, Resource Limits, and Metering doc](https://developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering):
  the per-operation fee "cannot be lower than 100 stroops per operation
  (the network minimum)," a stroop being "the smallest unit of a lumen,
  one ten-millionth of a lumen (.0000001 XLM)," and the total inclusion
  fee for a classic transaction is "the number of operations in the
  transaction multiplied by the effective base fee for the given
  ledger" — under normal (non-surge) conditions that's the 100-stroop
  floor; the network fee market only matters under surge pricing.

### 1.4 Transaction model
- Built with `TransactionBuilder(sourceAccount, { fee, networkPassphrase })`,
  one or more `Operation.*` calls, `.setTimeout(seconds)`, `.build()`.
  Output is an XDR-encoded envelope, not BCS (Sui) or a Solana `Message`.
- Signing: `transaction.sign(keypair)` appends a `DecoratedSignature`
  (signature + 4-byte signing-key hint) to the envelope. Read directly
  from the official `js-stellar-base` SDK source
  ([`transaction.js#signatureBase`](https://github.com/stellar/js-stellar-base/blob/master/src/transaction.js),
  [`transaction_base.js#hash`](https://github.com/stellar/js-stellar-base/blob/master/src/transaction_base.js))
  rather than assumed: `signatureBase()` builds an XDR
  `TransactionSignaturePayload { networkId: hash(networkPassphrase), taggedTransaction: TransactionSignaturePayloadTaggedTransaction.envelopeTypeTx(tx) }`
  and returns its XDR encoding; `hash()` is `sha256(signatureBase())` —
  that final hash is what gets ed25519-signed. **We never hand-roll
  this** — same "don't reimplement the SDK's intent/hashing logic"
  discipline as the Sui spec §1.5 applied to `messageWithIntent`.
- Submission: classic operations go to **Horizon** (`server.submitTransaction`)
  historically; Stellar RPC's `sendTransaction` now accepts classic-op
  envelopes too. We pick Horizon as the v1 submission path (§3.6) —
  richer classic-history query surface, and the ecosystem's most-used
  classic-tx path today.

### 1.5 Non-native assets — the trustline model (Stellar's "SPL-vs-Token-2022" analogue)
This is the biggest conceptual departure from every chain we already
support, and the one most likely to bite silently if under-modeled:

- A non-native asset is identified by **`(asset_code, issuer_account_id)`**
  — not a single mint/contract address string. `USDC` issued by Circle's
  account is a *different* asset than `USDC` issued by any other account
  with the same 4-letter code; the issuer is part of the identity, not
  metadata about it.
- **An account cannot hold or receive an asset without first submitting
  a `changeTrust` operation** ("establishing a trustline") to that
  specific `(code, issuer)` pair, with an explicit limit. Sending a
  payment to an account with no trustline fails on-chain with
  `op_no_trust` — this is not a client-side-preventable race the way an
  ATA-creation race is on Solana; the trustline is a real ledger
  precondition.
- The issuer can flag a trustline `AUTH_REQUIRED` (must be individually
  approved before it can hold a balance) or `AUTH_REVOCABLE` (issuer can
  freeze/revoke it later). **Checked against Circle's actual mainnet
  USDC issuer account** (via stellar.expert, not assumed): `auth_required: false`
  (any account can open a USDC trustline and receive funds without
  issuer pre-approval — good, matches "freely transferable once
  trusted") but **`auth_revocable: true`** — Circle *can* freeze a given
  holder's USDC balance later. The kit doesn't need to special-case this
  (freezing is enforced by the issuer on-chain, not something the
  sender/receiver client can override or must pre-check), but it's worth
  the app's compliance/support surface knowing this isn't a "free and
  clear forever" trustline the way it might assume by analogy to
  EVM/Solana/Sui token transfers. Don't assume either flag's value for
  arbitrary future assets — always read them off the issuer account
  rather than hard-coding an assumption.
- **SEP-41 / the Stellar Asset Contract (SAC)** bridges a classic asset
  into a Soroban-callable token interface (`balance`, `transfer`,
  `approve`, deterministic contract ID via `asset.contractId(passphrase)`).
  Out of scope for v1 (§0) — classic `changeTrust` + `payment` covers
  the send/receive/balance-read surface a mobile wallet needs without
  touching Soroban RPC simulation/assembly at all.

---

## 2. Current EVM/Solana/Sui architecture — how the project already absorbs a new chain

Unchanged from the Sui precedent (`docs/sui-chain-support-spec.md` §2) —
summarized here for a reader who hasn't seen that spec:

```
                  ┌──────────────────────────────────────────┐
                  │        TWallet (tagged)                  │
                  │  namespace: 'eip155'|'solana'|'sui'|      │
                  │             'stellar'  (new)              │
                  └──────┬─────────────────────────────────────┘
                         │
        ┌────────────────┴─────────────────┐
        ▼                                   ▼
┌───────────────────────┐        ┌──────────────────────────┐
│ ChainAdapterRegistry  │        │  walletKitRegistry       │
│ (dApp-bridge surface) │        │  (mobile UI + agent      │
│   EvmAdapter          │        │   surface)               │
│   SolanaAdapter       │        │   EvmWalletKit           │
│   SuiAdapter          │        │   SolanaWalletKit        │
│   ⟵ StellarAdapter    │        │   SuiWalletKit           │
│     (new, scaffold)   │        │   ⟵ StellarWalletKit    │
└───────────────────────┘        │     (new)                │
                                  └──────────────────────────┘
```

- `services/chains/types.ts` — `Namespace` union gains `"stellar"`.
- `services/walletKit/types.ts` (`WalletKitAdapter`) — every namespace
  implements the required methods; optional capabilities (§4 in
  `types.ts`) are presence-checked, never namespace-branched.
- `services/walletKit/registry.ts` / `bootstrap.ts` / `deriveAll.ts` —
  already iterate `walletKitRegistry.getAll()` / a `Namespace[]` list, so
  registering a `StellarWalletKit` is enough for create-new-wallet,
  agent wallet-context, and the namespace picker to pick it up with
  **zero shared-code edits** — same "we are filling templated slots, not
  refactoring" conclusion as the Sui spec §2.7.
- `services/walletService.ts` — the single blessed dwell site for
  decrypted key material (TWV-2026-057). EVM/Solana/Sui each get a
  `get<Chain>SignerForWallet(wallet)` + a cache map wiped by
  `clearAccountCache()`. Stellar adds a fourth.
- `services/walletconnect/caipMapping.ts` — maps `eip155/solana/sui` →
  themselves today (with `sui:mainnet` special-cased); gains a
  `stellar` entry with the `mainnet → pubnet` reference translation
  (§1.1).

---

## 3. Proposed architecture

### 3.1 Library choices
| Concern | Library | Why |
|---|---|---|
| XDR, `Keypair`, `StrKey`, `TransactionBuilder`, `Operation.*` | `@stellar/stellar-base` | The **offline-only** half of the official SDK — no bundled Horizon/RPC HTTP client. Everything we need for derivation → address → build → sign → XDR lives here. |
| Horizon reads (`loadAccount`, balances, tx history) + submission | Plain `fetch()` against Horizon's REST endpoints, OR `@stellar/stellar-sdk`'s `Horizon.Server` class if Task 00 shows it's Hermes-clean | Horizon is a JSON-over-HTTP REST API — no special client machinery is *required*; `fetch()` is already global in RN/Hermes. Prefer the SDK's `Server` class for the response-shape conveniences (typed balances array, `.next()`/`.prev()` pagination) if it loads cleanly; fall back to hand-rolled `fetch` calls against documented endpoints if it doesn't. |
| SLIP-0010 ed25519 walk | **Reuse** `services/chains/solana/derivation.ts`'s in-module walker (`@noble/hashes` HMAC-SHA512) | Already proven Hermes-safe; Stellar just supplies a different path string. No new dependency. |
| Hashing / checksum for StrKey (fallback only) | `@noble/hashes` (already in tree) | Only needed if `@stellar/stellar-base`'s `StrKey` helper doesn't load under Hermes — CRC16 (§1.2's exact polynomial) + base32 is small enough to hand-roll as a fallback (unlike Sui's full BCS engine, which was deemed too large to hand-roll). |

**`@stellar/stellar-base`'s actual dependency list** — pulled directly
from its published `package.json` (`registry.npmjs.org/@stellar/stellar-base/latest`,
v15.0.0 at time of writing) rather than assumed: `buffer`, `sha.js`,
`base32.js`, `bignumber.js`, `@noble/curves`, `@stellar/js-xdr`. Two
things this confirms, checked against this app's actual
`package.json`/`node_modules` rather than guessed:
- **`buffer`** (the npm ponyfill package, not Node's built-in) is
  **already present in this app's `node_modules`** as a transitive
  dependency of something else in the tree today. Since it's imported
  as a real npm module (not assumed as a Metro/webpack global), Metro
  should bundle it like any other dependency without needing a
  `global.Buffer` shim — but whether `@stellar/stellar-base`'s code
  additionally *assumes* an ambient `global.Buffer` anywhere is exactly
  the kind of thing only Task 00 can settle empirically.
- **`@noble/curves`** is **not currently a direct dependency of this
  app** (`@noble/hashes` and `@noble/ed25519` are, per `pollyfills.ts`,
  but not `@noble/curves` itself) — so unlike the SLIP-0010 walker
  (§1.2, reused verbatim from Solana), the ed25519 primitive
  `@stellar/stellar-base` uses would be **new, unproven-in-this-app**
  code path under Hermes, even though `@noble/*` as a package family has
  a track record here. This is a more precise version of the "less
  certain than the Sui case" risk below — it isn't "unknown dependency
  tree," it's specifically "one new `@noble` package, not yet exercised
  on this app's Hermes runtime."

**No new RN native modules planned.** The open question is whether
`@stellar/stellar-base` (and optionally `@stellar/stellar-sdk`'s
`Horizon`/`rpc` namespaces) load under Hermes without polyfills beyond
what's already installed (`react-native-quick-crypto`,
`react-native-get-random-values`, `pollyfills.ts`'s `TextEncoder`). This
is genuinely less certain than it was for `@mysten/sui` (which the team
had explicit prior confirmation runs cleanly) — **flag as the top risk,
verify in Task 00** before any other Stellar work begins (see §11).

### 3.2 Files we will add
Naming mirrors the Sui/Solana layout so reviewers diffing the trees see
a consistent mapping. Where Sui/Solana ship a single "coin/SPL transfer"
module, Stellar's trustline precondition earns its **own** module
(`trustlineService.ts`) — there's no Sui/Solana analogue to copy the name
from, since neither chain has an on-ledger "you must opt in to hold this
asset" step.

```
services/chains/types.ts             # Namespace union gains "stellar"
constants/types/walletTypes.ts       # add TStellarFields, extend TWallet / TWalletCreationParams
constants/configs/chainConfig.ts     # add { namespace: 'stellar', network, horizonUrl, rpcUrl, … } variant
services/chains/stellar/
  derivation.ts                      # mnemonic → 32B ed25519 seed via m/44'/148'/0'; re-exports the
                                      #   Solana SLIP-0010 walker with a Stellar-specific default path
  derivation.test.ts                 # test vectors against SEP-0005 / stellar-hd-wallet reference outputs
  strkey.ts                          # thin wrapper over @stellar/stellar-base's Keypair/StrKey;
                                      #   isValidStellarAddress / isValidStellarSecretSeed
  strkey.test.ts
  payloads.ts                        # StellarConnectPayload, StellarSignTxPayload, … (scaffold only)
  errorCodes.ts                      # typed Stellar errors (mirrors solana/sui errorCodes.ts)
  errorCodes.test.ts
  accountState.ts                    # detectAccountFunded, computeMinBalance / reserve math
  accountState.test.ts
  trustlineService.ts                # hasTrustline, ensureTrustline (builds+signs+submits changeTrust)
  trustlineService.test.ts
  transferService.ts                 # buildAndSendStellarNativeTransfer — dispatches createAccount
                                      #   vs payment based on accountState.detectAccountFunded
  transferService.test.ts
  assetTransferService.ts            # buildAndSendStellarAssetTransfer — trustline-gated `payment`
                                      #   op for non-native assets; surfaces op_no_trust as a typed error
  assetTransferService.test.ts
  injectedScript.ts                  # SCAFFOLD ONLY — returns "/* stellar disabled */"
  signer.ts                          # SCAFFOLD — installStellarSigner, mirrors sui/solana signer.ts shape
  StellarAdapter.ts                  # SCAFFOLD — implements ChainAdapter; handleRequest throws -32601
services/walletKit/stellar/
  StellarWalletKit.ts                # main implementation; delegates to chains/stellar helpers
  StellarWalletKit.test.ts
utils/walletUtils.ts                 # createStellarWalletFromMnemonic / fromPrivateKey, validators
docs/stellar-chain-support-spec.md   # this file
docs/stellar-chain-support-task/*.md # one task per work item (see §10)
```

### 3.3 Files we will modify
| File | Change |
|------|--------|
| `services/walletService.ts` | Add `getStellarSignerForWallet(wallet)` returning a `Keypair` (from `@stellar/stellar-base`), mirroring `getSuiSignerForWallet`. New `stellarSignerCache` map, wired into `clearAccountCache()`. New gate `TWV-2026-YYY` (§6). |
| `services/chains/types.ts` | `Namespace = "eip155" \| "solana" \| "sui" \| "stellar"`. |
| `services/walletKit/boot.ts` | Register `createStellarWalletKit()` after Sui. |
| `services/walletKit/deriveAll.ts` | No code change — already iterates `Namespace[]`. Tests extend to assert Stellar derivation. |
| `services/bridge/boot.ts` | Register `StellarAdapter` (scaffold) behind `FEATURE_STELLAR_DAPP_BRIDGE = false`. |
| `services/walletconnect/caipMapping.ts` | Add `stellar: "stellar"` to both direction maps; special-case `stellar` the way `sui` is special-cased today, translating internal `network: "mainnet"` ⇄ CAIP-2 reference `"pubnet"` (§1.1) — the one namespace where the internal and CAIP-2 network names diverge. |
| `services/agent-executors/index.ts` | Add `STELLAR_EXECUTORS`; extend `EXPECTED_MOBILE_TOOLS`. |
| `services/agent-executors/stellar.ts` (new) | `get_wallet_xlm_balance`, `get_xlm_balance`, `send_xlm`, `get_wallet_stellar_assets`, `send_stellar_asset`, `establish_stellar_trustline`. |
| `utils/walletUtils.ts` | `createStellarWalletFromMnemonic`, `createStellarWalletFromPrivateKey`, `isValidStellarAddress`, `isValidStellarSecretKey`. Extend `createWalletFromParams` source switch + `TWalletCreationParams.source` union (`"StellarSeedPhrase" \| "StellarPrivateKey"`). |
| `components/wallet/create/*` | No edits expected — namespace picker already iterates `walletKitRegistry.getAll()`; `ImportPrivateKeySheet` narrows via `kit.validatePrivateKey` (accepts `S…` seeds once `isValidStellarSecretKey` returns true). |
| `app/send.tsx` | No change expected — already dispatches through `walletKitRegistry.get(activeChain.namespace)`. The **trustline-establishment step** for a first-time asset receive needs its own small UI surface (§8.2) since it's a distinct signable operation with its own reserve-cost warning — this is the one place Stellar needs a UI addition Sui/Solana didn't. |

### 3.4 The `TStellarFields` shape (analogue of `TSuiFields` / `TSolanaFields`)
```ts
export interface TStellarFields {
  /** StrKey `G…` — the account's public key AND its ledger address (no separate hashing step). */
  stellarAddress: string;
  /** SEP-0005 derivation path. Absent ⇒ default `m/44'/148'/0'`. */
  derivationPath?: string;
  /** Signing scheme; only `ed25519` — Stellar has no other account-signer scheme in v1. */
  scheme: "ed25519";
}
```
`TWallet.privateKey` holds the **StrKey `S…` secret-seed form** (mirrors
Sui parking its bech32 `suiprivkey1…` form there) so the dwell site
re-decodes without re-running BIP-39. `TWallet.address` mirrors
`stellar.stellarAddress`.

### 3.5 Unfunded-account correctness — the "does this address exist yet" problem
Because a Stellar account must be created via `createAccount` before it
can receive a `payment`, `SuiWalletKit`'s pattern of "just try the send,
map the on-chain revert to a typed error" is insufficient here — an
unfunded destination isn't a revert, it's a **precondition the client
must detect and route around before building the transaction**:

```ts
// services/chains/stellar/accountState.ts
export async function detectAccountFunded(
  horizon: Horizon.Server,
  address: string,
): Promise<boolean> {
  try {
    await horizon.loadAccount(address);
    return true;
  } catch (e) {
    if (isNotFoundError(e)) return false; // Horizon 404 = never created
    throw e; // any other failure (network, rate-limit) must not be
             // silently treated as "unfunded" — that would misroute a
             // payment into a createAccount op against a real account.
  }
}
```
`transferService.ts#buildAndSendStellarNativeTransfer` calls this first
and picks `Operation.createAccount({ destination, startingBalance })`
vs `Operation.payment({ destination, asset: Asset.native(), amount })`
accordingly. `startingBalance` must be ≥ the destination's own minimum
reserve (1 XLM baseline, §1.3) — the kit enforces this floor and
surfaces a typed `StellarInsufficientCreateAmountError` rather than
letting the submission fail on-chain with `op_low_reserve`.

Non-native assets **cannot** be the first transfer to a new address —
the destination must exist (via an XLM `createAccount`) and hold a
trustline (via its own signed `changeTrust`) before anyone can pay it
in that asset. `assetTransferService.ts` checks `detectAccountFunded`
and surfaces a distinct `StellarDestinationUnfundedError` so the UX can
say "this address needs to receive XLM first" instead of a generic
failure.

### 3.6 RPC & network configuration
`ChainConfig` becomes a 4-armed union:
```ts
export type ChainConfig =
  | { namespace: "eip155"; chain: TChain; iconUrl?; isTestnet? }
  | { namespace: "solana"; cluster: "mainnet-beta" | "devnet"; rpcUrl; rpcSubscriptionsUrl?; iconUrl?; isTestnet? }
  | { namespace: "sui";    network: "mainnet" | "testnet" | "devnet"; rpcUrl: string; iconUrl?; isTestnet? }
  | { namespace: "stellar"; network: "mainnet" | "testnet"; horizonUrl: string; rpcUrl?: string; iconUrl?; isTestnet? };
```
`rpcUrl` is optional and unused in v1 (classic-only, §0) — reserved for
the future Soroban/SAC milestone (§13) so the shape doesn't need a
second migration later. Static default row: **Stellar mainnet only**
(`horizonUrl: "https://horizon.stellar.org"`), same "fresh install lands
on mainnet" posture as Solana/Sui. Testnet arrives via the backend
`/blockchains` feed.

Horizon is a **shared public endpoint** (no per-provider API key needed
for reads, unlike Solana/Sui's paid-RPC-at-scale story) — rate limits
apply but there's no "pick an RPC provider" decision blocking v1 the way
there was for EVM chains historically.

### 3.7 Token list — API-driven, trustline-aware, no static seeding
Mirrors the Sui/Solana precedent: the backend `/tokens?blockchainId=<stellar_row_id>`
feed is the only source of Stellar asset rows — **no hard-coded USDC in
the mobile bundle.** The one Stellar-specific wrinkle: the existing
`contractAddress` column (already repurposed as "SPL mint" for Solana,
"CoinType" for Sui) now carries the **compound `"{CODE}:{ISSUER}"`
string** for Stellar, e.g.:
```
USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN
```
`StellarWalletKit.getTokenBalance(address, chain, contractAddress)`
splits on `:`, builds `new Asset(code, issuer)`, and reads the matching
entry from `account.balances`. `sendTokenTransfer` does the same split
before delegating to `assetTransferService.buildAndSendStellarAssetTransfer`.

**USDC issuer addresses — verified, not assumed.** Circle's official
[USDC-on-Stellar page](https://www.circle.com/multi-chain-usdc/stellar)
and its own contract-address reference confirm mainnet issuer
`GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`
(cross-checked against independent explorers —
[stellar.expert](https://stellar.expert/explorer/public/asset/USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN-1),
[stellarchain.io](https://stellarchain.io/assets/USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN)).
Circle's [Stellar USDC quickstart](https://developers.circle.com/stablecoins/quickstart-transfer-usdc-stellar)
gives the **testnet** issuer as
`GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` — a
**different** account than mainnet, confirming it should never be
assumed to mirror the mainnet address. Re-verify both against Circle's
live docs at PR time regardless (addresses can rotate) — same "verify
the literal at PR time" discipline the Sui spec applied to its CoinType
constant, just no longer an open question in this spec.

Cache key naming mirrors Sui/Solana: `cached_stellar_tokens_<blockchainId>`
/ `cached_stellar_tokens_ts_<blockchainId>`, 5-minute stale window.

### 3.8 API-side seed script — required companion change
**File:** `api/src/scripts/prisma/seed.ts` — verified against the actual
sibling repo at `../api` (relative to `mobile-app`); **not**
`takumi-api` as the Sui spec's prose says — that repo is at
`/home/cstralpt/takumipay/api` on disk. Two additions, same pattern
already used for Solana/Sui:

**A. Blockchain rows**, keyed on `chainSlug` (`stellar-mainnet` /
`stellar-testnet`) since Stellar has no EIP-155 chainId — identical
posture to the Sui/Solana rows (`Blockchain.chainId` and `.chainSlug`
are both nullable-but-`@unique`; non-EVM chains key on `chainSlug` and
leave `chainId` null). `rpcUrl` is **required** on the `Blockchain`
model (no dedicated `horizonUrl` column exists or is needed) — it
carries the **Horizon** URL (`https://horizon.stellar.org` /
`https://horizon-testnet.stellar.org`), reusing the same single
generic-string-column pattern Solana (Alchemy RPC) and Sui (fullnode
RPC) already established. `blockExplorer` points at StellarExpert.

**B. USDC token row(s)** on Stellar mainnet **and testnet** (both issuer
addresses now confirmed, §3.7 — no reason to defer the testnet row to a
follow-up the way the earlier draft did), `contractAddress` = the
compound `CODE:ISSUER` string from §3.7, **`decimals: 7`**. Per the
official [Stellar Assets doc](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/assets):
"Stellar's scaling system allows for seven decimal places of precision
… the smallest non-zero amount unit … is 0.0000001 (one ten-millionth)"
— this applies to *every* Stellar asset, including USDC, **not** 6 like
USDC's EVM/Solana/Sui decimals. This is an easy transcription bug:
copy-pasting the Sui/Solana USDC seed row verbatim would silently ship
a wrong decimals value. No `metadata`/"asset kind" hint field is needed
the way the Sui spec floated one for `suiTokenKind` — Stellar has no
per-token "kind" to hint at (§1.5), just the trustline precondition,
which is a runtime check, not seed metadata.

**Row resolution — no fragile array indices.** The seed script has
**already moved past** positional `blockchains[N]` lookups (which the
Sui spec's own prose still describes) — it now builds a
`chainBySlug: Map<string, Blockchain>` after the blockchain-row upserts
and exposes a `slugChain(chainSlug)` helper (`src/scripts/prisma/seed.ts`
around the Sui blockchain section) that throws loudly if the slug is
missing. The Stellar token row and any future `SmartContract`/other
rows referencing the Stellar blockchain should resolve via
`slugChain("stellar-mainnet").id`, exactly the way the current Sui
`intent-receipt` rows resolve via `blockchains.find((b) => b.chainSlug === "sui-testnet")`
/ `slugChain(...)` — **no numeric placeholder index needed at all.**

### 3.9 CAIP mapping — the `mainnet ⇄ pubnet` special case
`services/walletconnect/caipMapping.ts` already special-cases `sui`
(non-numeric reference, `sui:mainnet` default). Stellar needs a similar
branch, but with an actual **name** translation rather than just a
default-value fallback:
```ts
if (namespace === "stellar") {
  const ref = chain.network === "mainnet" ? "pubnet" : chain.network; // internal → CAIP-2
  return `stellar:${ref}`;
}
```
And the reverse direction (`stellar:pubnet` → internal `network: "mainnet"`)
needs the mirrored translation. This is the one namespace where internal
and CAIP-2 naming diverge — call it out explicitly in the PR so a future
reader doesn't "simplify" it into the same pattern as EVM/Solana/Sui and
silently break WalletConnect-style Stellar requests.

---

## 4. The `StellarWalletKit` interface contract

Implements every required `WalletKitAdapter` method; optional capability
methods (signTransferWithAuthorization, sendUserOpWithUsdcPaymaster,
ERC-7710 delegation methods, 1Shot relayer methods, `signAndExecuteSuiPtb`,
`sendAnchorInstruction`, …) are left `undefined` — none of those
primitives have a Stellar equivalent in v1.

```ts
return {
  namespace: "stellar" as const,
  supportsTokenTransfer: true,
  supportsPrivateKeyImport: true,
  displayName: "Stellar",
  requireBiometricForConnect: true,

  getChainId(chain) { return chain.namespace === "stellar" ? chain.network : null; },
  formatChainLabel(chain) { return chain.namespace === "stellar" ? `Stellar ${capitalize(chain.network)}` : null; },
  nativeSymbol(chain) { return chain.namespace === "stellar" ? "XLM" : null; },
  buildTxExplorerUrl(hash, chain) {
    if (chain.namespace !== "stellar" || !hash) return null;
    // StellarExpert — the de facto standard explorer, same pick rationale
    // as SuiVision for Sui: most actively maintained, first-class
    // testnet coverage, clean path shape.
    const net = chain.network === "mainnet" ? "public" : "testnet";
    return `https://stellar.expert/explorer/${net}/tx/${hash}`;
  },

  validateAddress: isValidStellarAddress,       // StrKey `G…`, checksum-verified
  validatePrivateKey: isValidStellarSecretKey,   // StrKey `S…`, checksum-verified
  validateMnemonic: (m) => validateMnemonic(m.trim(), englishWordlist),

  createWalletFromPrivateKey: ({ privateKey, name }) =>
    createStellarWalletFromPrivateKey(privateKey, name).then(orThrow),
  createWalletFromMnemonic: ({ mnemonic, name }) =>
    createStellarWalletFromMnemonic(mnemonic, name).then(orThrow),
  generateMnemonic: () => generateWalletMnemonic(),

  getSignerForWallet: (wallet) => getStellarSignerForWallet(wallet),

  // No native "sign arbitrary message" primitive on Stellar — see §4.2
  // for why this is a real protocol mismatch, not just an implementation
  // detail.
  signAuthMessage: async (wallet, message) => {
    const kp = await getStellarSignerForWallet(wallet);
    if (!kp) throw new Error("StellarWalletKit.signAuthMessage: no signer");
    return signStellarAuthChallenge(kp, message); // see §4.2
  },

  getNativeBalance: async (address, chain) => {
    assertStellarChain(chain);
    const horizon = getHorizonClient(chain);
    const account = await horizon.loadAccount(address).catch(mapAccountNotFound);
    const native = account.balances.find((b) => b.asset_type === "native");
    return parseStroops(native?.balance ?? "0");
  },
  getTokenBalance: async (address, chain, contractAddress) => {
    assertStellarChain(chain);
    const { code, issuer } = parseCompoundAssetId(contractAddress);
    const horizon = getHorizonClient(chain);
    const account = await horizon.loadAccount(address).catch(mapAccountNotFound);
    const line = account.balances.find(
      (b) => b.asset_type !== "native" && b.asset_code === code && b.asset_issuer === issuer,
    );
    return parseStroops(line?.balance ?? "0"); // 0n also covers "no trustline yet"
  },

  sendNativeTransfer: async ({ wallet, to, amount, chain }) => {
    assertStellarChain(chain);
    const signer = await getStellarSignerForWallet(wallet);
    if (!signer) throw new Error("No Stellar signer for wallet");
    const horizon = getHorizonClient(chain);
    return buildAndSendStellarNativeTransfer({ horizon, signer, to, stroops: amount, chain });
  },
  sendTokenTransfer: async ({ wallet, to, amount, chain, contractAddress }) => {
    assertStellarChain(chain);
    const signer = await getStellarSignerForWallet(wallet);
    if (!signer) throw new Error("No Stellar signer for wallet");
    const horizon = getHorizonClient(chain);
    const { code, issuer } = parseCompoundAssetId(contractAddress);
    return buildAndSendStellarAssetTransfer({ horizon, signer, to, code, issuer, amount, chain });
  },

  estimateMaxTransferable: async ({ balance, chain, from }) => {
    assertStellarChain(chain);
    const horizon = getHorizonClient(chain);
    const account = await horizon.loadAccount(from).catch(mapAccountNotFound);
    const reserve = computeMinBalance(account) + STELLAR_FEE_RESERVE_STROOPS; // named constants
    return balance > reserve ? balance - reserve : 0n;
  },

  formatNativeAmount: (raw, chain) => {
    assertStellarChain(chain);
    return `${(Number(raw) / 1e7).toFixed(4)} XLM`; // 7 decimals — see §1.3 / §3.8 decimals note
  },
  parseNativeAmount: (human, chain) => {
    assertStellarChain(chain);
    return BigInt(Math.round(parseFloat(human) * 1e7));
  },
  truncateAddress: (a, opts) =>
    truncateAddressUtil({ address: a, startLength: opts?.start ?? 6, endLength: opts?.end ?? 4 }),
};
```

**Decimals reminder.** XLM (and, distinctively, *every* Stellar asset —
including USDC/EURC) is 7-decimal fixed point (1 XLM = 10,000,000
stroops). This is a hard Stellar-wide invariant, not a per-asset
metadata field the way EVM/Solana/Sui `decimals` is — worth a comment at
the call site so a future reviewer doesn't "fix" it to read `decimals`
off the token row.

### 4.1 Trustline handling — dedicated pre-flight, not inline in the send path
Unlike Sui's `detectSuiTokenKind` (which classifies an *existing*
on-chain object into one of three transfer shapes), Stellar's trustline
step is something the **sender's UI must proactively offer to the
receiver** — there is no "kind" to detect, only a yes/no "does the
destination already trust this asset" check, and if not, a distinct
signable operation (`changeTrust`) that only the **destination account's
own key** can authorize. This has a UX consequence Sui/Solana don't:
**you cannot always complete an asset send in one flow** — if the
destination hasn't opted in, the payment cannot succeed no matter what
the sender signs.

`services/chains/stellar/trustlineService.ts`:
```ts
export async function hasTrustline(
  horizon: Horizon.Server,
  address: string,
  code: string,
  issuer: string,
): Promise<boolean> {
  const account = await horizon.loadAccount(address).catch(mapAccountNotFound);
  return account.balances.some(
    (b) => b.asset_type !== "native" && b.asset_code === code && b.asset_issuer === issuer,
  );
}

/** Establishes a trustline FOR THE CALLER'S OWN WALLET (self-service —
 *  e.g. before receiving USDC for the first time). Cannot establish a
 *  trustline on behalf of someone else; that's a different account's
 *  signature. */
export async function ensureTrustline(args: {
  horizon: Horizon.Server;
  signer: Keypair;
  code: string;
  issuer: string;
  limit?: string; // defaults to max
}): Promise<{ alreadyTrusted: boolean; hash?: string }> {
  const already = await hasTrustline(args.horizon, args.signer.publicKey(), args.code, args.issuer);
  if (already) return { alreadyTrusted: true };
  const account = await args.horizon.loadAccount(args.signer.publicKey());
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: args.horizon.networkPassphrase })
    .addOperation(Operation.changeTrust({ asset: new Asset(args.code, args.issuer), limit: args.limit }))
    .setTimeout(180)
    .build();
  tx.sign(args.signer);
  const { hash } = await args.horizon.submitTransaction(tx);
  return { alreadyTrusted: false, hash };
}
```

`assetTransferService.buildAndSendStellarAssetTransfer` calls
`hasTrustline` against the **destination** before building the payment
and throws a typed `StellarNoTrustlineError` if absent — this maps to a
friendly "recipient hasn't set up USDC yet" message rather than letting
the submission round-trip to Horizon just to get `op_no_trust` back.

#### Typed errors (new exports in `services/chains/stellar/errorCodes.ts`)
| Class | When |
|-------|------|
| `StellarAccountNotFoundError` | `loadAccount` 404s for a **source** (funded-sender) lookup — the wallet itself has never received XLM. |
| `StellarDestinationUnfundedError` | Destination has no ledger entry yet and the operation isn't `createAccount`. |
| `StellarNoTrustlineError` | Destination exists but has no trustline to the asset being sent. |
| `StellarInsufficientReserveError` | Establishing a trustline / sending would drop the source below its minimum balance. |
| `StellarInsufficientCreateAmountError` | `createAccount` `startingBalance` is below the new account's own minimum reserve. |
| `StellarSequenceNumberRaceError` | `tx_bad_seq` — another submission consumed the sequence number first (e.g. a rapid double-tap); UX should retry with a freshly reloaded account, not surface a raw code. |

These wire into `mapUnknownError` in `services/agent-executors/types.ts`
the same way the Sui spec §4.1 required for its typed errors, so
agent-mode failures map to `agentErrorCopy` reasons (project memory:
[[project_agent_tool_error_standard]]) instead of `String(err)`.

### 4.2 `signAuthMessage` — mirrors the existing SIWS-Sui/SIWS-Solana pattern, not literal SEP-10
Initial research (before checking the API repo) assumed Stellar's only
auth primitive was SEP-0010's challenge-transaction dance, which would
have been a real interface mismatch against
`signAuthMessage(wallet, message: string): Promise<string>`. **Checked
against the actual backend (`api/src/auth/`) and that assumption was
wrong for this codebase specifically** — TakumiPay's own login does not
implement literal SEP-10/SIWE for any chain. It implements a **bespoke
per-namespace "Sign-In-With-X" scheme**:

- `api/src/auth/siws/` (Solana) and `api/src/auth/siws-sui/` (Sui) each
  export a `buildMessage`/`parseMessage`/`verify` service. `verify()`
  checks the signature against the **raw signed message bytes** using
  that chain's own SDK-native "verify personal message" primitive
  (Sui: `Ed25519PublicKey.verifyPersonalMessage`, which internally
  applies Sui's intent-prefix + BLAKE2b framing per §1.5).
- `auth.service.ts#verifySignature` dispatches on a **magic substring**
  in the plaintext message (`"wants you to sign in with your Sui
  account:"` / `"...Solana account:"` / `"...Ethereum account:"`) —
  there's no explicit namespace parameter at verify-time, just message
  sniffing.
- `auth.controller.ts`'s nonce endpoint branches on `chainSlug.startsWith("sui-")`
  / `"solana-"` today (`NonceDto.chainSlug`, kebab-case, mutually
  exclusive with the EVM `chainId` field).

**Stellar fits this mold more simply than Sui did**, because
`@stellar/stellar-base`'s `Keypair.sign(data: Buffer)` /
`Keypair.verify(data, signature)` are **raw ed25519 sign/verify with no
built-in framing** — unlike Sui, which wraps personal messages with an
intent-scope byte + BLAKE2b before signing (§1.5). So:

- **Mobile:** `StellarWalletKit.signAuthMessage(wallet, message)` =
  `keypair.sign(Buffer.from(message, "utf8"))`, base64-encoded —
  directly analogous to the doc-comment on `SiwsSuiService`
  ("mirrors mobile path: `kit.signAuthMessage(wallet, message)` calls
  `keypair.signPersonalMessage(utf8Bytes)`") but *without* Stellar
  needing an intent-wrapping step at all.
- **Backend (new, in scope this milestone — task 17):**
  `api/src/auth/siws-stellar/` mirroring `siws-sui/`'s file shape
  (`siws-stellar-message.ts` + `siws-stellar.service.ts`), whose
  `verify()` does `StrKey.decodeEd25519PublicKey(address)` +
  `Keypair.fromPublicKey(address).verify(messageBytes, signatureBytes)`
  — no chain-SDK dynamic-import gymnastics needed (unlike the Sui
  service's ESM/CJS interop workaround, since `@stellar/stellar-base`
  can be a normal CJS-compatible dependency).
- `auth.controller.ts` gains a `chainSlug.startsWith("stellar-")` branch
  calling `generateNonce(walletAddress, "stellar")`; `auth.service.ts#verifySignature`
  gains a `"wants you to sign in with your Stellar account:"` substring
  branch dispatching to the new service. `NonceCacheService.getNonce`/`deleteNonce`
  already take a generic namespace string — `"stellar"` is a new literal,
  no schema change.

This turns out to be **low-effort and in scope for this milestone**
(§10 task 17), not a deferred backend-coordination risk — the
distinction from §0/§13 is that **literal SEP-10** (needed only if a
future anchor integration requires it, since anchors expect the real
challenge-transaction spec, not TakumiPay's bespoke scheme) remains
future work.

### 4.3 Agent-mode coverage
`send_xlm` / `send_stellar_asset` (§7.2) call `sendNativeTransfer` /
`sendTokenTransfer`, which already carry the createAccount-dispatch and
trustline-check logic — so the agent gets the same unfunded-destination
and no-trustline guardrails automatically, no per-tool branching needed.
`establish_stellar_trustline` is a **new tool with no analogue on any
other chain** — Sui/Solana never needed an agent tool whose only job is
"opt this wallet into holding an asset" since neither chain has an
opt-in step. Its typed-error → `ExecutorErrorCode` mapping:

| Stellar error | Mapped reason |
|---|---|
| `StellarAccountNotFoundError` / `StellarDestinationUnfundedError` | `stale_precondition` (project memory: [[project_agent_tool_error_standard]] — recovery class fits: "fund the account first, then retry") |
| `StellarNoTrustlineError` | `invalid_input` (with descriptive message pointing at the missing trustline) |
| `StellarInsufficientReserveError` / `StellarInsufficientCreateAmountError` | `insufficient_funds` |
| `StellarSequenceNumberRaceError` | `stale_precondition` (retry after reload) |

---

## 5. The `StellarAdapter` (scaffold — disabled in v1)

Unlike Sui (which has a ratified Wallet Standard extension spec to
implement, §1 of the Sui spec), **Stellar has no single formalized
injected-provider standard** the ecosystem converges on the way Sui/Solana
do. Freighter's own `window.freighterApi`-shaped object and the
"Stellar Wallets Kit" abstraction (a client-side multi-wallet SDK, not an
injected-provider spec wallets implement) are the closest things —
**this needs its own research pass before implementation**, flagged
explicitly rather than guessed at here (§11). The scaffold below is
therefore even more provisional than the Sui spec's §5:

```ts
class StellarAdapter implements ChainAdapter {
  readonly namespace = "stellar" as const;
  getInjectedScript() { return "/* stellar injected provider not enabled */"; }
  onStateChange() { return null; }
  async handleRequest(req: ChainRequest): Promise<ChainResult> {
    return { status: "error", code: 4200, message: "Stellar dApp bridge not enabled in this build" };
  }
  async executeApproval(): Promise<unknown> { throw new Error("not enabled"); }
}
```
Boot path adds it behind `const FEATURE_STELLAR_DAPP_BRIDGE = false;` —
same one-line-flip posture as Sui.

---

## 6. Security invariants (new gate)

Same dwell-site discipline as EVM/Solana/Sui.

- **TWV-2026-YYY (Stellar)** *(new gate to issue with the implementation PR)*
  - The 32-byte ed25519 seed is reconstructed only inside
    `getStellarSignerForWallet`, fed straight into
    `Keypair.fromRawEd25519Seed(seed)` from `@stellar/stellar-base`.
    Cached by address in `stellarSignerCache`; wiped by `clearAccountCache()`.
  - Never log the seed or the StrKey `S…` secret. `__DEV__` breadcrumbs
    limited to fixed strings ("derivation failed").
  - Signing must go through `Transaction.sign(keypair)` / `Keypair.sign(data)`
    — never construct the network-passphrase-hash-then-sign sequence by
    hand (§1.4).
- **TWV-2026-002 carryover** — Stellar derivation rides the same CSPRNG
  polyfill guard as every other chain.
- **TWV-2026-060 carryover** — Stellar `TWallet` rows live in the single
  biometric-gated `WALLET_BUNDLE_KEY` blob; no Stellar-specific keystore
  branch.

---

## 7. Agent Mode integration

### 7.1 `walletContext`
No schema change — `AgentMode.tsx` already emits `namespace:
activeChain.namespace`; once that's `"stellar"` the server routes to
Stellar tools the same way it does for `"sui"` today.

### 7.2 New executors — `services/agent-executors/stellar.ts`
| Tool | Description |
|------|-------------|
| `get_wallet_xlm_balance` | Connected wallet's XLM balance. Raw stroops + display string. |
| `get_xlm_balance` | XLM balance for an arbitrary address (falls back to connected wallet). |
| `send_xlm` | Native XLM transfer; dispatches createAccount vs payment per §3.5. Returns `data.hash` (Horizon tx hash), not `tx_hash` — same wire-schema reasoning the Sui spec gave for `data.digest`. |
| `get_wallet_stellar_assets` | Lists the wallet's trustlines (code + issuer + balance + limit). Mirrors `get_wallet_spl_tokens` / `get_wallet_sui_coins`. |
| `send_stellar_asset` | Sends a non-native asset given `code` + `issuer`; surfaces `StellarNoTrustlineError` if the destination hasn't opted in. |
| `establish_stellar_trustline` | New primitive with no cross-chain analogue (§4.3) — opts the *connected* wallet into holding a given asset. |

`EXPECTED_MOBILE_TOOLS` extends with the six names above.

---

## 8. UI changes

### 8.1 Wallet creation / import
No per-screen edits expected — `walletKitRegistry.getAll()` already
drives the namespace picker. `ImportPrivateKeySheet` narrows via
`kit.validatePrivateKey` (`S…` StrKey). `createWalletFromParams` switch
gains `StellarSeedPhrase` / `StellarPrivateKey` cases.

### 8.2 Send screen — the one Stellar-specific addition
`app/send.tsx` stays namespace-agnostic for the actual transfer call,
but sending a **non-native** Stellar asset to a recipient needs a
pre-flight `hasTrustline` check (§4.1) so the sender sees "recipient
hasn't set up this asset yet" *before* attempting the send, not as a
post-hoc error. This is new UI surface, not present in the Sui/Solana
send flow (neither chain has a receiver-side opt-in gate) — likely a
small inline banner in the existing send confirmation step rather than
a new screen.

### 8.3 Receive screen — trustline self-service
The receive flow for a **new** asset (first time this wallet holds
USDC, say) needs an explicit "trust this asset" action —
`ensureTrustline` (§4.1) — with a reserve-cost disclosure ("this will
lock 0.5 XLM as a minimum balance"). This is the first point in the app
where a "receive" action requires the *receiver* to sign something
before money can arrive, which every other chain in this app doesn't
require.

### 8.4 Multi-chain mnemonic
`services/walletKit/deriveAll.ts` needs no change — extend the
create-new-flow namespace list to `["eip155", "solana", "sui", "stellar"]`.
Partial-success path (a Stellar derivation failure doesn't poison the
other three) is already in the helper (verified by reading
`deriveWalletsFromMnemonic` directly, §2).

---

## 9. Testing

| Test | Mechanism |
|---|---|
| Mnemonic → Stellar `G…` address determinism | Vector test against SEP-0005's own published first test vector (§1.2: 12-word mnemonic `illness spike retreat truth genius clock brain pass fit cave bargain toe` → `m/44'/148'/0'` → `GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6` / `SBGWSG6BTNCKCOB3DIFBGCVMUPQFYPA2G4O34RMTB343OYPXU5DJDVMN`), not a third-party package's output. |
| `isValidStellarAddress` accepts canonical StrKey `G…`, rejects bad checksum / wrong version byte / `M…`/`C…` prefixes. | Boundary tests. |
| `Keypair.sign` / `Transaction.sign` round-trip against a hard-coded XDR payload (no Horizon call). | `strkey.test.ts` / `transferService.test.ts`. |
| `detectAccountFunded` returns `false` on Horizon 404, rethrows on other errors (rate-limit, network). | Mocked Horizon client. |
| `buildAndSendStellarNativeTransfer` picks `createAccount` for an unfunded destination, `payment` for a funded one. | Spy on `Operation.createAccount` vs `Operation.payment`. |
| `hasTrustline` / `ensureTrustline` — trustline present vs absent vs already-at-limit. | Mocked account `balances` array. |
| `buildAndSendStellarAssetTransfer` throws `StellarNoTrustlineError` before submitting when the destination lacks a trustline (never lets it round-trip to `op_no_trust`). | Mocked Horizon. |
| `estimateMaxTransferable` reserves `(2 + subentries) × base_reserve + fee_reserve`. | Pure test, varying `num_subentries`. |
| `formatNativeAmount` / `parseNativeAmount` use 7 decimals, not 6. | Regression guard against the USDC-decimals transcription bug flagged in §3.8. |
| `deriveWalletsFromMnemonic(mnemonic, [..., "stellar"])` returns four wallets sharing `seedPhrase`. | Existing test extends. |
| `clearAccountCache()` wipes `stellarSignerCache`. | `walletService.test.ts` extension. |
| Agent executors: `get_wallet_xlm_balance`, `send_xlm`, `establish_stellar_trustline` (mocked Horizon). | New `services/agent-executors/stellar.test.ts`. |
| Boot-order regression: registering `StellarWalletKit` doesn't break EVM/Solana/Sui. | `bootstrap.test.ts`. |

Run `pnpm check:syntax` and `pnpm biome:check` — both must pass.
Per [[feedback_limit_test_workers]], run the new Stellar test files
directly rather than the full `pnpm test` suite while iterating.

---

## 10. Task breakdown (drop into `docs/stellar-chain-support-task/`)

| # | Task | Pre-reqs | Outputs |
|---|------|----------|---------|
| 00 | **Hermes/RN compatibility smoke test** for `@stellar/stellar-base` (and optionally `@stellar/stellar-sdk`'s `Horizon`/`rpc` namespaces) | — | Throw-away `app/_dev/stellar-compat.tsx` exercising `Keypair.fromRawEd25519Seed`, `StrKey.encodeEd25519PublicKey`, `TransactionBuilder`+`Operation.payment`+`.sign()`+`.toXDR()`, and a `fetch()`-based Horizon `loadAccount` call. Delete after passing. This is the highest-uncertainty task in the whole spec (§11) — do not start 01+ until it passes. |
| 01 | Add `TStellarFields` + extend `TWallet` / `TWalletCreationParams` | 00 | `constants/types/walletTypes.ts` |
| 02 | Add Stellar variant to `ChainConfig` + static mainnet fallback row | 01 | `constants/configs/chainConfig.ts` |
| 03 | `services/chains/stellar/derivation.ts` + tests (reuses Solana's SLIP-0010 walker with `m/44'/148'/0'`) | 00 | Deterministic vectors vs SEP-0005 reference |
| 04 | `services/chains/stellar/strkey.ts` (validators, `G…`/`S…` wrappers) | 03 | Vectors against SDK |
| 05 | Extend `walletService.ts` with `getStellarSignerForWallet` + cache + clear | 03, 04 | New gate `TWV-2026-YYY` |
| 06 | `utils/walletUtils.ts`: validators + `createStellarWallet*` | 05 | Hooks into `createWalletFromParams` |
| 06b | `services/chains/stellar/errorCodes.ts` + `accountState.ts` + `trustlineService.ts` + tests | 04 | Reserve math, unfunded-account detection, trustline check/establish |
| 07 | `services/chains/stellar/transferService.ts` + `assetTransferService.ts` + tests | 05, 06b | createAccount/payment dispatch; trustline-gated asset payment |
| 08 | `services/walletKit/stellar/StellarWalletKit.ts` + tests (consumes 07) | 05, 06, 07 | Implements adapter |
| 09 | Register kit in `services/walletKit/boot.ts` | 08 | EVM/Solana/Sui regression test |
| 10 | Extend create-new flow to include `"stellar"` in `deriveWalletsFromMnemonic` namespaces | 09 | Four-wallet output |
| 11 | `services/agent-executors/stellar.ts` + register + `EXPECTED_MOBILE_TOOLS` | 08 | Coordinate with backend descriptor list |
| 12 | `services/chains/stellar/StellarAdapter.ts` *scaffold* + boot-time guard | 08 | Stub returning -32601 |
| 13 | `services/walletconnect/caipMapping.ts` — `stellar ⇄ pubnet` translation (§3.9) | 09 | Round-trip test |
| 14 | Send-screen trustline pre-flight banner + receive-screen "trust this asset" action (§8.2, §8.3) | 08 | UI surfaces |
| 15 | Telemetry + breadcrumbs (no key bytes) | 05 | Sentry tags `chain=stellar` |
| 16 | **API seed script update** — `stellar-mainnet` + `stellar-testnet` blockchain rows (via `slugChain()`, no index placeholder) + USDC token row (§3.8), **decimals: 7** | — | Lands in `api/src/scripts/prisma/seed.ts` (sibling repo, `../api`), must merge before task 09 is enabled anywhere, else the picker/agent see an empty Stellar token list |
| 17 | **API auth wiring** — `api/src/auth/siws-stellar/` (`SiwsStellarService`, mirrors `siws-sui/`) + `auth.controller.ts` `chainSlug.startsWith("stellar-")` branch + `auth.service.ts#verifySignature` message-substring branch (§4.2). Mobile side: `StellarWalletKit.signAuthMessage` = `keypair.sign(utf8Bytes)`. | 08 | Stellar login round-trips through the existing nonce/verify/login flow |

The dApp-bridge research spike (§5) is the only piece explicitly **out
of scope** for this milestone's task list — it needs its own follow-up
spec once §0's non-goals are revisited. Literal SEP-10 (§4.2, §13)
likewise stays deferred.

---

## 11. Risks & open questions

| Risk | Mitigation |
|------|------------|
| `@stellar/stellar-base`'s ed25519 backend (`@noble/curves`) is a package this app doesn't currently depend on directly, unlike the SLIP-0010 walker it reuses from Solana (§3.1) — a genuinely new, unproven-on-this-Hermes-runtime code path, not just "an unknown dependency tree" in the abstract. | Task 00 verifies before any other work. If it fails: the SDK's other pure-JS deps (`sha.js`, `base32.js`, `bignumber.js`, `@stellar/js-xdr`) are small and likely fine; hand-roll only the ed25519 signing piece against the already-Hermes-proven `@noble/ed25519` (already in `pollyfills.ts`) if `@noble/curves` specifically is the failure point, rather than reimplementing XDR from scratch. |
| No formalized "Wallet Standard"-equivalent for Stellar dApp injected providers (§5). | Out of scope for this milestone (scaffold only); needs a dedicated research spike before any dApp-bridge implementation spec is written — do not assume Freighter's shape is "the" standard without checking what LOBSTR / xBull / Stellar Wallets Kit actually expect from an injected provider. |
| Trustline reserve cost (0.5 XLM per asset, per §1.3's cited official figure) is real friction for a consumer app onboarding non-crypto users — the exact friction point this hackathon's "Local Finance & Real-World Access" track cares about solving, not creating. | Not fixed in this milestone; **sponsored reserves** ([`beginSponsoringFutureReserves`/`endSponsoringFutureReserves`](https://developers.stellar.org/docs/build/guides/transactions/sponsored-reserves), letting TakumiPay's own account pay a new user's trustline reserve) is flagged as the highest-priority §13 follow-up — likely worth pulling into v1 scope if the hackathon demo needs a frictionless "receive USDC" flow. |
| Backend `/blockchains` feed doesn't yet return Stellar rows. | Static `supportedChains` fallback renders the mainnet chain in the picker; backend rollout (task 16) is decoupled but blocking for the token list specifically. |
| Public Horizon (`horizon.stellar.org`) rate-limits under load. | Same posture as the Sui spec's public-fullnode risk — defer a paid/dedicated Horizon provider until production load shows it's needed. |
| `SiwsStellarService` (task 17) is new code on the API side, not just a mobile change — easy to under-scope as "mobile-only" work during planning. | Called out explicitly in the task table; budget it as a real (if small) backend PR, not a footnote. |

### Resolved decisions
1. **Default network = `stellar:pubnet`** (internal `network: "mainnet"`). Static fallback row points at `https://horizon.stellar.org`. Testnet ships via backend feed only.
2. **Classic operations only in v1** — no Soroban/SAC/RPC simulation path. Keeps the milestone's surface area comparable to the Sui/Solana precedents instead of also taking on Soroban's simulate → assemble → sign → submit lifecycle.
3. **Explorer = StellarExpert** (`stellar.expert/explorer/{public|testnet}/tx/{hash}`) — SDF-adjacent, actively maintained, first-class testnet coverage. Same selection rationale the Sui spec applied to SuiVision.
4. **Token list is API-driven**, compound `CODE:ISSUER` string reusing the existing `contractAddress` column — no schema change, same pattern Solana (mint) and Sui (CoinType) already established.
5. **Horizon over RPC for v1 submission/reads** — RPC is Soroban-contract-focused and 7-day-history-limited; Horizon has the richer classic-tx query surface this milestone actually needs. Revisit when Soroban support lands (§13).

---

## 12. Roll-out plan

1. **PR 1 (this spec)** — land the spec + empty `docs/stellar-chain-support-task/` files. No code.
2. **PR 2 (task 00)** — Hermes compatibility smoke test. **Gates everything else** — if this fails, the library-choice section (§3.1) needs revisiting before any further PR is planned.
3. **API PR (task 16)** — seed script gains Stellar blockchain rows + USDC token row (7 decimals!). Re-seed dev + staging. Must merge before PR 5 below.
4. **PR 3 (tasks 01–06)** — types, derivation, dwell site, validators. No UI exposure yet.
5. **PR 4 (tasks 06b–08)** — trustline/account-state/transfer services + `StellarWalletKit`, registered behind a feature flag until QA approves.
6. **PR 5 (tasks 09–10, 13–14)** — create-new flow includes Stellar; CAIP mapping; send/receive UI additions. **Depends on the API PR.**
7. **PR 6 (tasks 11, 15)** — agent-mode tools + telemetry. Coordinate the server-side tool registry update.
8. **PR 7 (task 12)** — `StellarAdapter` scaffold behind `FEATURE_STELLAR_DAPP_BRIDGE=false`.
9. **API PR (task 17)** — `SiwsStellarService` + controller/service branches so Stellar wallets can log in through the existing nonce/verify flow. Independent of task 16; can land in parallel with PR 3–5.
10. **Future spec** — sponsored reserves (frictionless receive), SEP-6/24/31 anchor integration (the actual "local finance / real-world access" payoff), literal SEP-10 (only if an anchor requires it), Soroban/SAC support.

---

## 13. Future work (not in this milestone)

- **Sponsored reserves** (`beginSponsoringFutureReserves`) — removes the
  0.5 XLM trustline-reserve friction for new users; the single highest-
  leverage follow-up given this spec's stated hackathon motivation.
- **SEP-6 / SEP-24 anchor integration** — programmatic and hosted
  fiat deposit/withdrawal. This is the concrete mechanism for bridging
  IDR-denominated pulsa/PLN/merchant-payment flows to Stellar-settled
  stablecoins — the actual "Local Finance & Real-World Access" /
  "Payment & Consumer Applications" story, not just chain support for
  its own sake.
- **SEP-31** cross-border payment corridors, if a remittance angle is
  pursued.
- **Literal SEP-10 web authentication** — only needed if a future anchor
  integration requires it specifically; TakumiPay's own login is covered
  in v1 by the bespoke `SiwsStellarService` (§4.2, task 17), the same
  pattern already used for Solana/Sui. Revisit alongside SEP-45 if
  smart-account/passkey wallets are ever added.
- Soroban/SAC support — invoking the token contract interface directly,
  needed if a future DeFi/lending integration on Stellar (mirroring the
  Sui DeFi work in [[project_sui_defi_phase3_no_vault_standard]]) is
  pursued.
- Stellar dApp-bridge (injected provider, approval sheets, inspector) —
  blocked on the "what's the actual standard" research spike (§5, §11).
- Multisig, path payments, liquidity pools, claimable balances, muxed
  accounts (`M…`) as send destinations.
- Smart Account Kit / passkey-based Stellar wallets — an entirely
  different dwell-site shape (no local ed25519 secret), out of scope
  the same way Sui zkLogin was out of scope for its milestone.

---

## 14. Sources

Every Stellar-specific factual claim in this spec (version bytes,
derivation path, reserve/fee amounts, decimals, issuer addresses,
network passphrases, signature-base construction) was checked against
one of these — either fetched directly (SEP text, SDK source, npm
registry) or confirmed via web search against the primary source, not
asserted from training-data recall. Anything not resolvable this way
(e.g. the exact injected-provider shape in §5) is explicitly flagged as
an open question rather than guessed.

- [SEP-0005 — Key Derivation Methods](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0005.md) (fetched verbatim) — derivation path, coin type, test vector.
- [SEP-0023 — Strkeys](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0023.md) (fetched verbatim) — version-byte table, CRC16 polynomial, base-32 rules.
- [Stellar Docs — Accounts](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/accounts) — base reserve, minimum balance, subentries.
- [Stellar Docs — Create an account](https://developers.stellar.org/docs/build/guides/transactions/create-account) — `createAccount` / 1 XLM minimum.
- [Stellar Docs — Fees, Resource Limits, and Metering](https://developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering) — 100-stroop base fee.
- [Stellar Docs — Assets](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/assets) — 7-decimal amount precision.
- [Stellar Docs — Sponsored Reserves](https://developers.stellar.org/docs/build/guides/transactions/sponsored-reserves) — §13 follow-up.
- [`js-stellar-base` source](https://github.com/stellar/js-stellar-base) (`src/transaction.js`, `src/transaction_base.js`, `src/network.js`, fetched directly) — signature-base construction, network passphrases.
- [`@stellar/stellar-base` npm registry entry](https://registry.npmjs.org/@stellar/stellar-base/latest) — exact dependency list (§3.1).
- [CAIP-28 — Stellar Namespace](https://namespaces.chainagnostic.org/stellar/caip2) — `stellar:pubnet`/`stellar:testnet` CAIP-2 identifiers.
- [Circle — USDC on Stellar](https://www.circle.com/multi-chain-usdc/stellar) + [Circle — Stellar USDC quickstart](https://developers.circle.com/stablecoins/quickstart-transfer-usdc-stellar) — mainnet/testnet USDC issuer addresses, cross-checked against [stellar.expert](https://stellar.expert/explorer/public/asset/USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN-1) and [stellarchain.io](https://stellarchain.io/assets/USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN).
- `stellar-dev` plugin skills (`assets`, `dapp`, `data`, `standards`) — trustline/SAC mechanics, Horizon/RPC API shapes, SEP routing map, ecosystem reference.
- This repo's own `docs/sui-chain-support-spec.md` and `/home/cstralpt/takumipay/api` source (`prisma/schema.prisma`, `src/scripts/prisma/seed.ts`, `src/auth/`) — architecture precedent and the corrections in §3.8/§4.2 (verified against the actual sibling repo, not assumed from the Sui spec's prose).
