# Task 06 — `walletUtils.ts` — validators + `createSuiWalletFrom{PrivateKey,Mnemonic}`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-chain-support-spec.md` §3.3, §3.4, §3.5, §8.1.

## Why this matters

`utils/walletUtils.ts` is the namespace-dispatching entry point for the
"Add Wallet" sheet, the "Import" sheet, and the create-new-flow's
`createWalletFromParams` switch. Without Sui creators + validators here,
the UI cannot dock the kit: the namespace picker has nothing to offer
and the import sheet's `kit.validatePrivateKey` returns `undefined`.

## Scope

- `utils/walletUtils.ts`:
  - `isValidSuiAddress(address: string): boolean` — strict canonical
    form: `0x` + 64 lowercase hex chars (66-char total). Rejects
    legacy 20-byte addresses with a typed
    `InvalidSuiAddressLegacyError` (caught and surfaced upstream by
    Task 14's send-sheet guard).
  - `isValidSuiPrivateKey(input: string): boolean` — predicate-form
    of `decodeSuiPrivateKey` (Task 04). Catches the typed decoder
    error and returns `false` instead of throwing.
  - `createSuiWalletFromMnemonic(mnemonic: string, name: string):
    Promise<TWallet | null>`:
    1. Validate mnemonic via `@scure/bip39`.
    2. Build keypair via `mnemonicToSuiKeypair` (Task 03).
    3. Populate `TWallet`:
       - `namespace: "sui"`
       - `type: "SeedPhrase"`, `source: "Created"`
       - `address` = `keypair.toSuiAddress()`
       - `privateKey` = bech32 `encodeSuiPrivateKey(seed)` (Task 04)
       - `seedPhrase` = mnemonic
       - `sui` = `{ suiAddress, pubkeyHex, scheme: "ed25519" }`
  - `createSuiWalletFromPrivateKey(privateKey: string, name: string):
    Promise<TWallet | null>` — same shape; `type: "PrivateKey"`,
    `source: "Imported"`, `seedPhrase: undefined`.
  - Extend the `createWalletFromParams` source-switch with
    `case "SuiSeedPhrase":` and `case "SuiPrivateKey":`.

## Rules (non-negotiable)

- **`TWallet.privateKey` for Sui is bech32, not raw bytes.** The dwell
  site decodes on the way in (Task 04 + 05). This keeps secret-byte
  storage uniform with the user-visible export format.
- **`address === sui.suiAddress`.** Chain-agnostic UI reads
  `wallet.address`; downstream Sui-aware code reads `wallet.sui.suiAddress`.
  Drift between the two is a bug — assert in tests.
- **No SDK calls outside the dedicated helpers.** This file delegates
  to `mnemonicToSuiKeypair`, `encodeSuiPrivateKey`, and
  `decodeSuiPrivateKey`. Importing `Ed25519Keypair` directly here is
  a review block.
- **Failures return `null`, not throw.** Mirrors
  `createSolanaWalletFromMnemonic` semantics so the existing wrapper
  logic (`then(orThrow)`) stays uniform.

## Acceptance

- [ ] All four functions exported with the signatures above.
- [ ] `isValidSuiAddress` rejects: legacy 20-byte hex, mixed-case hex,
      non-hex chars, missing `0x`.
- [ ] `isValidSuiPrivateKey` accepts: `suiprivkey1…` (good vector),
      32-byte hex, base64. Rejects: empty string, 31-byte, 33-byte,
      non-base64 garbage.
- [ ] `createSuiWalletFromMnemonic` round-trip: mnemonic → wallet,
      `wallet.address` byte-equal to Task 03 golden vector.
- [ ] `createWalletFromParams({ source: "SuiSeedPhrase", … })` returns
      a populated `TWallet` with `namespace === "sui"`.
- [ ] `pnpm check:syntax` passes; `pnpm run test` passes.

## Out of scope

- Kit consumption (Task 08).
- Send-sheet legacy-address guard wiring (Task 14).
- Import-sheet UI changes — the existing sheet narrows by
  `kit.validatePrivateKey`, no UI rewrite needed.
