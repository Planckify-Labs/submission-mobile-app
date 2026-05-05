# Task 05 — `walletService.getSuiSignerForWallet` + cache + `clearAccountCache`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-chain-support-spec.md` §2.1, §3.3, §6 (TWV-2026-XXX).

## Why this matters

`services/walletService.ts` is the **only blessed dwell site** for
decrypted seed material in the JS heap (TWV-2026-057). Adding a Sui
signer anywhere else — inside the kit, inside a hook, inside an
adapter — rebreaks the invariant. This task issues a new wallet-
security gate (TWV-2026-XXX) for the Sui equivalent of the EVM and
Solana dwell paths, with the same cache + `clearAccountCache` discipline.

## Scope

- `services/walletService.ts`:
  - Add module-level `suiSignerCache = new Map<string, Ed25519Keypair>()`.
  - Add `getSuiSignerForWallet(wallet: TWallet): Promise<Ed25519Keypair | null>`:
    1. Return early `null` if `wallet.namespace !== "sui"`.
    2. Cache hit on `wallet.address` → return.
    3. If `wallet.privateKey` (canonical bech32 `suiprivkey1…`) is
       present, decode via `decodeSuiPrivateKey` (Task 04) and pass
       to `Ed25519Keypair.fromSecretKey(seed)`.
    4. Else if `wallet.seedPhrase` is present, call
       `mnemonicToSuiKeypair` (Task 03) with
       `wallet.sui?.derivationPath` (default applied inside the helper).
    5. Cache the keypair by `wallet.address`; return.
    6. The local `seed`/intermediate `Uint8Array` binding never escapes
       function scope — no closure capture, no return of bytes.
  - Extend `clearAccountCache()` to wipe `suiSignerCache` alongside the
    EVM and Solana caches.
- Add a TWV-2026-XXX block comment above `getSuiSignerForWallet`
  documenting the invariants (single dwell, no logging, SDK-only intent
  helpers). The exact gate number is issued at PR time — coordinate with
  the wallet-security review queue.

## Rules (non-negotiable)

- **No fallback to plaintext logging.** `__DEV__` breadcrumbs limited
  to `"derivation failed"` — never include `seed`, `privateKey`,
  `mnemonic`, `pubkey`, or any byte of them.
- **No second decode site.** Every consumer (kit, executors, future
  adapter) goes through `getSuiSignerForWallet`. The cache exists so
  the per-call cost is amortised; reaching into the cache externally
  is forbidden.
- **`clearAccountCache()` wipes all three maps.** Lock / logout /
  active-wallet swap paths already call it; verify by reading the
  existing call sites for parity.
- **No Secp256k1 / Secp256r1 fallback in v1.** If a `TSuiFields.scheme
  !== "ed25519"` row appears, throw `UnsupportedSuiSchemeError` — do
  not silently downgrade.
- **TWV-2026-002 carryover.** `walletService.ts` already throws if
  loaded before the CSPRNG polyfill — Sui derivation rides on the same
  guard. Do not add a second check; do not bypass the existing one.
- **TWV-2026-060 carryover.** Sui `TWallet` rows live in the single
  `WALLET_BUNDLE_KEY` blob alongside EVM and Solana rows, gated by one
  biometric prompt. **No Sui-specific keystore branch** — reuse the
  existing `signingSecureGet/Set` (auth-gated) for the bundle and
  `walletSecureGet/Set` (non-auth) for the public address index.

## Acceptance

- [ ] `getSuiSignerForWallet` exported from `walletService.ts`.
- [ ] `suiSignerCache` declared at module scope; never exported.
- [ ] `clearAccountCache()` wipes the new map.
- [ ] Unit tests in `walletService.test.ts`:
      - cache miss → keypair built, cached
      - cache hit → no re-derivation
      - non-Sui wallet → returns `null`
      - `clearAccountCache()` → next call rebuilds
- [ ] TWV-2026-XXX block comment present and references §6 invariants.
- [ ] `pnpm check:syntax` passes; `pnpm run test` passes.

## Out of scope

- Kit consumption (Task 08).
- Validators / wallet creators (Task 06).
- Transfer-service `signAndExecute` plumbing (Task 07).
