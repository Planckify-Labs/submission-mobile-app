# Sui chain support — engineering spec

**Status:** Draft (research + design, no code yet)
**Author:** Claude (research synthesis)
**Date:** 2026-05-05
**Companion:** `docs/sui-chain-support-task/` (task breakdown — to be filled)
**Related:** `docs/solana-chain-support-spec.md` (the precedent we mirror), `docs/solana-adapter-spec.md`

---

## 0. Goal & non-goals

### Goal
Add **first-class Sui chain support** to the mobile app, mirroring the
space-docking architecture used for Solana so that:

1. A user can **create / import a Sui wallet** alongside their EVM and Solana wallets, sharing the same BIP-39 mnemonic where applicable.
2. A user can **send / receive SUI and Sui-native fungible coins** from the mobile UI.
3. The wallet is **ready to be exposed to Agent Mode** (read tools + sign-and-execute) by adding tool descriptors that route through the existing `WalletKitAdapter` seam.
4. The wallet is **ready to be exposed to the in-app dApp browser** via a future `SuiAdapter` implementing the [Wallet Standard Sui extension](https://github.com/wallet-standard/wallet-standard/blob/main/extensions/sui.md). The dApp-side surface (`getInjectedScript`, request handlers, approval flows) is **scaffolded but disabled** in this milestone — the user explicitly deferred the WebView integration to a later session.

### Non-goals (this milestone)
- Sui dApp-bridge wiring (injected `window.sui` provider, approval sheets, inspectors). Scaffold only — no `<WebView>` wiring, no inspectors, no approval renderers.
- zkLogin, multisig, sponsored transactions ("gas station"), or Sui Name Service (SuiNS) resolution. zkLogin/multisig are flagged as **future work** in §13.
- Migration of pre-0.7.0 (32-byte) Sui addresses. The legacy address-balance-migration concern from the Sui docs page is acknowledged in §3.5; we generate addresses via the **current 32-byte BLAKE2b derivation** only.
- WalletConnect/CAIP-27 changes for Sui. The CAIP-2 prefix `sui` is already mapped at `services/walletconnect/caipMapping.ts:38`; deeper WC integration is a separate spec.
- TakumiPay on-chain settlement on Sui (no Sui Move package exists).

---

## 1. Background — what the Sui Wallet Standard requires

### 1.1 Spec source
- Sui-extension to the Wallet Standard:
  https://github.com/wallet-standard/wallet-standard/blob/main/extensions/sui.md
- Sui docs (implementer guide):
  https://docs.sui.io/onchain-finance/asset-custody/wallets/wallet-standard
- Authoritative TS types: `@mysten/wallet-standard` (npm).

### 1.2 Supported chains (CAIP-2-shaped)
| Chain id     | Network    |
|--------------|------------|
| `sui:mainnet`  | Mainnet  |
| `sui:testnet`  | Testnet  |
| `sui:devnet`   | Devnet   |
| `sui:localnet` | Local dev|

### 1.3 Required Wallet Standard features
| Feature                              | Purpose                              |
|--------------------------------------|--------------------------------------|
| `standard:connect`                   | User authorizes account exposure     |
| `standard:disconnect`                | Revoke origin's access               |
| `standard:events`                    | `change` notifications (accounts/chains/features) |
| `sui:signTransaction`                | Sign without execution               |
| `sui:signAndExecuteTransaction`      | Sign + submit to a fullnode          |
| `sui:signPersonalMessage`            | Sign arbitrary UTF-8 / bytes for SIWS-style auth |
| `sui:signTransactionBlock` (legacy)  | Compatibility with older dApps        |
| `sui:signAndExecuteTransactionBlock` (legacy) | "                          |
| `sui:reportTransactionEffects` (opt) | dApp-side cache hint after execution |

`ReadonlyWalletAccount` shape returned by `wallet.accounts`:
```ts
{
  address: string,             // 0x-prefixed 32-byte hex (66 chars total)
  publicKey: Uint8Array,       // raw 32-byte ed25519 pubkey (no flag byte)
  chains: ["sui:mainnet", ...],
  features: ["sui:signTransaction", "sui:signPersonalMessage", ...],
  label?: string,
  icon?: `data:image/...`
}
```

### 1.4 Cryptography (the only viable scheme for v1)
- **Ed25519** (default for SDK + every major wallet).
- Address formula:
  ```
  flag = 0x00                 // ed25519
  pubkey = 32 bytes
  sui_address = "0x" + blake2b_256(flag || pubkey)
  ```
  (Secp256k1 = flag `0x01`, Secp256r1 = `0x02`. We do **not** support Secp variants in v1.)
- **BIP-39 → Sui keypair**: `Ed25519Keypair.deriveKeypair(mnemonic, path)` where the **default path is `m/44'/784'/0'/0'/0'`** (Sui registered coin type 784, fully hardened SLIP-0010 ed25519). Phantom-style "first account" parity matches Sui Wallet, Suiet, Surf.
- **Private-key import format** (Sui Wallet 0.7.0+): bech32 `suiprivkey1...` payload. Legacy 32-byte hex / base64 inputs are also accepted by `Ed25519Keypair.fromSecretKey` after our parser detects them.

### 1.5 Transaction signing
1. Build a Programmable Transaction Block (`Transaction` in `@mysten/sui/transactions`).
2. Serialize to BCS: `await tx.build({ client })` returns `Uint8Array`.
3. Wrap with **intent**: prepend three intent bytes `[0x00 (TransactionData), 0x00 (V0), 0x00 (Sui)]` then BLAKE2b-256 hash the result. (`@mysten/sui/cryptography` exports `messageWithIntent` + signing helpers — we should never reimplement this.)
4. Sign the digest with ed25519 → 64-byte signature.
5. Concatenate `flag(1) || sig(64) || pubkey(32)` and base64-encode → "Sui signature" (97 bytes encoded).
6. Submit `{bytes, signature}` to `client.executeTransactionBlock` (legacy `SuiClient`) or `client.core.executeTransaction` (new `SuiGrpcClient`).

Personal-message signing uses the same intent flow with intent-scope `0x03` ("Personal message").

---

## 2. Current EVM & Solana wallet implementation — how the project already absorbs new chains

The codebase is already designed for chain-agnostic extension via a "space-docking" pattern. Two registries flank a tagged-union `TWallet`:

```
                  ┌──────────────────────────────────────┐
                  │        TWallet (tagged)              │
                  │  namespace: 'eip155'|'solana'|'sui'  │
                  └──────┬───────────────────────────────┘
                         │
        ┌────────────────┴─────────────────┐
        ▼                                   ▼
┌───────────────────────┐        ┌──────────────────────────┐
│ ChainAdapterRegistry  │        │  walletKitRegistry       │
│ (dApp-bridge surface) │        │  (mobile UI + agent      │
│   EvmAdapter          │        │   surface)               │
│   SolanaAdapter       │        │   EvmWalletKit           │
│   ⟵ SuiAdapter (new)  │        │   SolanaWalletKit        │
└───────────────────────┘        │   ⟵ SuiWalletKit (new)   │
                                  └──────────────────────────┘
```

### 2.1 The blessed key dwell site — `services/walletService.ts`
- Single source of decrypted seed material in JS heap (TWV-2026-057).
- EVM: `getAccountForWallet(wallet)` returns viem `HDAccount | PrivateKeyAccount`.
- Solana: `getSolanaSignerForWallet(wallet)` returns `KeyPairSigner` (non-extractable WebCrypto key).
- Caches per-address; `clearAccountCache()` wipes both maps on lock/logout.
- Uses `signingSecureGet/Set` (auth-gated `expo-secure-store`) for the **wallet bundle** (TWV-2026-060) and `walletSecureGet/Set` (non-auth) for the public address index.
- BIP-39 entropy comes from `react-native-quick-crypto` + `react-native-get-random-values`. Validated by `@scure/bip39`.

### 2.2 `TWallet` shape — already namespace-aware
`constants/types/walletTypes.ts:32`:
```ts
export interface TWallet {
  name; address; balance;
  source: "Created" | "Imported" | "Social";
  type:   "PrivateKey" | "SeedPhrase" | "Social" | "Smart4337" | "Smart7702";
  namespace: "eip155" | "solana" | "sui";   // sui already declared
  account: any;          // chain-specific signer surface
  privateKey?: string;   // hex (EVM) or base58 32B seed (Solana)
  seedPhrase?: string;   // BIP-39 mnemonic
  solana?: TSolanaFields;
  // … sui slot to add
}
```
The discriminator `namespace` is the *only* thing shared code branches on; chain-specific data is parked under an optional sub-object so screens that don't know about Sui can keep working.

### 2.3 `WalletKitAdapter` — first-party operations port
`services/walletKit/types.ts`. Implementations (`EvmWalletKit`, `SolanaWalletKit`) cover **wallet creation, signers, native + token reads, native + token sends, message signing, max-amount estimation, formatting, explorer URL building**. Optional capability methods (`signTransferWithAuthorization`, `signX402SvmPayment`, `sendUserOpWithUsdcPaymaster`, `sendAnchorInstruction`) are presence-checked rather than namespace-branched. New chains either:
- implement the core methods + skip optional capabilities they don't have, or
- add a new optional method with `?` to the interface and let consumers presence-check (the "chain extension discipline" memory).

### 2.4 `ChainAdapter` — dApp-bridge surface
`services/chains/types.ts`. `EvmAdapter` (`services/chains/evm/EvmAdapter.ts`) and `SolanaAdapter` (`services/chains/solana/SolanaAdapter.ts`) implement `getInjectedScript / handleRequest / executeApproval / onStateChange`. Boot wires them through `services/bridge/boot.ts`.

### 2.5 Boot order (today)
```
app/_layout.tsx
  → pollyfills.ts (CSPRNG + quick-crypto)
  → bootWalletKits() in services/walletKit/boot.ts
        register EvmWalletKit
        register SolanaWalletKit
  → screen mount → bootBridge(...)
        register EvmAdapter
        register SolanaAdapter
        installSolanaSigner(walletKitRegistry.get('solana'))
```

### 2.6 Agent Mode hooks
`components/home/TakumiAgent/AgentMode.tsx:425` builds `walletContext` from kit hooks, *not* from chain-specific code. `chain_id: 0` for non-EVM namespaces is already handled — server reads `namespace` as discriminator. `services/agent-executors/solana.ts` shows the pattern for adding new namespace-specific tools while reusing the same `WalletKitAdapter` seam.

### 2.7 Existing scaffolding for Sui
- `services/chains/types.ts:4` already lists `"sui"` in the `Namespace` union.
- `services/chains/sui/` exists (empty).
- `services/walletKit/sui/` exists (empty).
- `services/walletconnect/caipMapping.ts:38` maps `sui → sui`.
- `services/walletKit/deriveAll.ts` notes "future Sui kit" — partial-success path is already in place.
- `docs/sui-chain-support-task/` exists (empty) — task breakdown lands there.

**Net implication:** all the seams for adding Sui are already in place. We are not refactoring; we are filling templated slots.

---

## 3. Proposed architecture

### 3.1 Library choices
| Concern                         | Library                                 | Why                          |
|---------------------------------|-----------------------------------------|------------------------------|
| Keypair, signing, intent prefixes, BCS | `@mysten/sui` (subpaths: `keypairs/ed25519`, `cryptography`, `transactions`, `client`) | Official MystenLabs SDK; handles intent + flag-byte composition correctly. |
| Wallet Standard event types & helpers (when we wire dApps) | `@mysten/wallet-standard` | Re-uses `ReadonlyWalletAccount`, Wallet Standard chain constants. |
| Hashing for address derivation (only if we cannot import `toSuiAddress`) | `@noble/hashes/blake2b` | Already in tree. Fallback only — prefer the SDK helper. |

**No** new RN native modules. `@mysten/sui` runs in Hermes when paired with `react-native-quick-crypto` (already polyfilled), `react-native-get-random-values`, and the existing `pollyfills.ts` `TextEncoder`. Validate during task 0 before the rest of the work begins (see §10).

### 3.2 Files we will add
File names mirror the Solana layout exactly so reviewers diffing the two trees see a 1:1 mapping. Where the Solana side ships e.g. `transferService.ts` + `splTransferService.ts` we ship `transferService.ts` + `coinTransferService.ts`. Naming drift here is the kind of thing that bites three months later when someone greps `splTransferService.ts` looking for "the token-transfer code" and misses Sui — keep them parallel.

```
constants/types/walletTypes.ts       # add TSuiFields, extend TWalletCreationParams
constants/configs/chainConfig.ts     # add { namespace: 'sui', network, rpcUrl, … } variant
services/chains/sui/
  derivation.ts                      # mnemonic → 32B ed25519 secret; default path
  derivation.test.ts                 # test vectors against @mysten/sui
  codec.ts                           # bech32 ↔ bytes, intent helpers, address derivation
  codec.test.ts
  payloads.ts                        # SuiConnectPayload, SuiSignTxPayload, …
  errorCodes.ts                      # typed Sui errors (mirrors solana/errorCodes.ts)
  errorCodes.test.ts
  tokenKind.ts                       # detectSuiTokenKind (Coin / Regulated / Closed Loop)
  tokenKind.test.ts
  transferService.ts                 # buildAndSendSuiTransfer (native SUI)
                                     #   mirrors solana/transferService.ts shape
  transferService.test.ts
  coinTransferService.ts             # buildAndSendSuiCoinTransfer (Coin<T> + Regulated + Closed Loop dispatch)
                                     #   mirrors solana/splTransferService.ts shape
  coinTransferService.test.ts
  injectedScript.ts                  # SCAFFOLD ONLY — returns "/* sui disabled */"
  signer.ts                          # SCAFFOLD — installSuiSigner for the future bridge wiring;
                                     #   mirrors solana/signer.ts shape so flipping
                                     #   FEATURE_SUI_DAPP_BRIDGE is one-line later.
  SuiAdapter.ts                      # SCAFFOLD — implements ChainAdapter; handleRequest throws -32601
services/walletKit/sui/
  SuiWalletKit.ts                    # main implementation; delegates to chains/sui helpers
  SuiWalletKit.test.ts
utils/walletUtils.ts                 # createSuiWalletFromMnemonic / fromPrivateKey, validators
docs/sui-chain-support-spec.md       # this file
docs/sui-chain-support-task/*.md     # one task per work item (see §10)
```

**Pattern note — why no `signPersonalMessage.ts` / `signTransaction.ts` under `walletKit/sui/`.**
The Solana kit only carries a pure helper file when there's a *special* signing primitive that's reused outside the kit (e.g. `signX402SvmPayment.ts` for the gasless payment rail). Generic message + transaction signing happens inline inside `SolanaWalletKit.signAuthMessage` / `sendNativeTransfer`, delegating to `getSolanaSignerForWallet` and the SDK's own helpers. Sui v1 has no special primitive — `Ed25519Keypair.signPersonalMessage` and `client.signAndExecuteTransaction({signer: kp, …})` from `@mysten/sui` already wrap the intent + BLAKE2b round-trip safely. So we keep signing inline in the kit. Add a pure helper file only if and when a future feature (gasless txs, sponsored wrapping, x402-Sui rail) needs to call the primitive from a non-kit site.

### 3.3 Files we will modify
| File | Change |
|------|--------|
| `services/walletService.ts` | Add `getSuiSignerForWallet(wallet)` mirroring `getSolanaSignerForWallet`. Add the cache map alongside `solanaSignerCache`. Extend `clearAccountCache()` to wipe it. Cite `TWV-2026-070` analogue (new gate `TWV-2026-XXX` to be issued — see §6). |
| `services/walletKit/boot.ts` | Register `createSuiWalletKit()` after Solana. |
| `services/walletKit/deriveAll.ts` | No code change — already iterates over `Namespace[]`. Tests must be updated to assert Sui derivation. |
| `services/bridge/boot.ts` | Register `SuiAdapter` (scaffold). Behind `if (FEATURE_SUI_DAPP)` so it stays dark in v1. |
| `services/agent-executors/index.ts` | Add `SUI_EXECUTORS`; extend `EXPECTED_MOBILE_TOOLS`. |
| `services/agent-executors/sui.ts` (new) | `get_wallet_sui_balance`, `get_sui_balance`, `send_sui`, `get_wallet_sui_coins`, `send_sui_coin`. |
| `utils/walletUtils.ts` | `createSuiWalletFromMnemonic`, `createSuiWalletFromPrivateKey`, `isValidSuiAddress`, `isValidSuiPrivateKey`. Extend `createWalletFromParams` source switch. |
| `components/wallet/create/*` | Add Sui rows to the namespace picker (already pluralised by `walletKitRegistry.getAll()`); private-key import sheet narrows by `kit.validatePrivateKey` so no UI rewrite. |
| `app/send.tsx` (and friends) | No change expected — they already dispatch through `walletKitRegistry.get(activeChain.namespace)`. Verify path. |

### 3.4 The `TSuiFields` shape (analogue of `TSolanaFields`)
```ts
export interface TSuiFields {
  /** 0x-prefixed 32-byte hex (canonical Sui address). */
  suiAddress: string;
  /** Raw 32-byte ed25519 public key, hex. */
  pubkeyHex: string;
  /** SLIP-0010 ed25519 path. */
  derivationPath?: string;     // default `m/44'/784'/0'/0'/0'`
  /** Signing scheme; only `ed25519` in v1. */
  scheme: "ed25519";
}
```
`TWallet.privateKey` (string) holds the **Sui-canonical bech32 form** (`suiprivkey1…`) so the dwell site can re-decode without re-running BIP-39 derivation. `TWallet.address` carries the same value as `suiAddress` so chain-agnostic UI keeps rendering.

### 3.5 Address-derivation correctness — the migration concern
The `address-balance-migration` doc URL the user shared returned 404, but the Sui docs cover the historical context: pre-mainnet Sui addresses were 20 bytes; current addresses are 32 bytes computed from `BLAKE2b-256(flag || pubkey)`. We **only generate v1 (32-byte) addresses** and accept only 32-byte hex addresses (`0x` + 64 hex chars) on send. Any imported private key whose derived address differs from a user-provided "expected address" is rejected during import — we do not perform on-chain "balance migration" calls because that's a fullnode-side concern handled automatically once the user lands on a current-format address.

If a user pastes a legacy 20-byte address as the recipient, validation rejects with a typed `InvalidSuiAddressLegacyError` so the UX can point them at the migration runbook on Sui's side. (Implementation detail; not a blocker.)

### 3.6 RPC & network configuration
`ChainConfig` becomes a 3-armed union:
```ts
export type ChainConfig =
  | { namespace: "eip155"; chain: TChain; iconUrl?; isTestnet? }
  | { namespace: "solana"; cluster: "mainnet-beta" | "devnet"; rpcUrl; rpcSubscriptionsUrl?; iconUrl?; isTestnet? }
  | { namespace: "sui";    network: "mainnet" | "testnet" | "devnet"; rpcUrl: string; iconUrl?; isTestnet? };
```
Static defaults in `supportedChains` add **Sui mainnet only** (`https://fullnode.mainnet.sui.io:443`) so a fresh install lands the user on mainnet — same posture as Solana (`mainnet-beta` default). Testnet / devnet rows arrive via the backend `/blockchains` feed alongside any RPC overrides; server-side rows for Sui are a separate work item, not blocking on this spec.

### 3.7 Token list — API-driven, no static seeding
USDC on Sui mainnet (CoinType `0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC`) and any other Sui coins are served by the backend token feed (`tokenApi.searchTokens({ blockchainId })`) — the same path Solana SPL tokens use today (see `services/agent-executors/solana.ts:268`). We do **not** hard-code USDC or any other Sui coin into the mobile bundle. The mobile app's contract is:
- Backend `/blockchains` returns a Sui row with `id`, `isEVM: false`, `isTestnet`, `rpcUrl`.
- Backend `/tokens?blockchainId=<sui_row_id>` returns the coin list (CoinType + decimals + logo + `isStablecoin` + `peggedCurrency`).
- `SuiWalletKit.getTokenBalance(address, chain, coinType)` uses the CoinType verbatim against `client.getBalance({ owner, coinType })`.

Cache key naming mirrors Solana: `cached_sui_tokens_<blockchainId>` / `cached_sui_tokens_ts_<blockchainId>` with the same 5-minute stale window.

### 3.8 API-side seed script — required companion change
**File:** `takumi-api/src/scripts/prisma/seed.ts`

The mobile token list is API-driven (see §3.7), so a Sui row must exist in the backend before the mobile picker / agent executors render anything useful. Two additions land in `seed.ts`:

**A. Blockchain rows** — appended to the existing `blockchains` array (line ~530), **after** the Monad entry, so existing `blockchains[N]` index references stay stable. Sui has no EIP-155 chainId (same as Solana), so the rows are keyed on `chainSlug`. We do **not** invent a `solanaCluster`-style discriminator column for Sui in this milestone — instead we reuse `chainSlug` directly (`sui-mainnet` / `sui-testnet`) and let the mobile resolver match on slug. If a `suiNetwork` enum column is wanted later for parity with `solanaCluster`, that's a schema migration in a follow-up.

```ts
// Sui mainnet — keyed by chainSlug; isEVM:false. Public Mysten fullnode
// for v1; swap in Alchemy/Triton when traffic warrants (mirrors the
// Solana rollout — public endpoint first, paid endpoint via re-seed).
prisma.blockchain.upsert({
  where: { chainSlug: "sui-mainnet" },
  update: {
    rpcUrl: "https://fullnode.mainnet.sui.io:443",
    blockExplorer: "https://suivision.xyz",
  },
  create: {
    name: "Sui",
    chainSlug: "sui-mainnet",
    rpcUrl: "https://fullnode.mainnet.sui.io:443",
    blockExplorer: "https://suivision.xyz",
    isEVM: false,
    isActive: true,
    isTestnet: false,
  },
}),
prisma.blockchain.upsert({
  where: { chainSlug: "sui-testnet" },
  update: {
    rpcUrl: "https://fullnode.testnet.sui.io:443",
    blockExplorer: "https://testnet.suivision.xyz",
  },
  create: {
    name: "Sui Testnet",
    chainSlug: "sui-testnet",
    rpcUrl: "https://fullnode.testnet.sui.io:443",
    blockExplorer: "https://testnet.suivision.xyz",
    isEVM: false,
    isActive: true,
    isTestnet: true,
  },
}),
```

**B. USDC token row** on Sui mainnet — appended to the `tokens` array (the section starting at line ~813). Uses `contractAddress` to carry the Sui CoinType (`module::struct` form), reusing the existing column rather than introducing a `coinType` field. Mobile already treats `contractAddress` opaquely on non-EVM rows (Solana uses it for the SPL mint), so this is a no-schema-change reuse. **Decimals: 6** for Circle-issued USDC on Sui (matches every other USDC row in the seed).

```ts
// USDC on Sui mainnet — Circle-issued. CoinType is stored in
// `contractAddress` (same pattern Solana uses for SPL mints). The
// mobile `SuiWalletKit.getTokenBalance` passes this string verbatim
// to `client.getBalance({ owner, coinType })`.
prisma.token.upsert({
  where: {
    blockchainId_contractAddress: {
      blockchainId: blockchains[<SUI_MAINNET_INDEX>].id,
      contractAddress:
        "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
    },
  },
  update: {},
  create: {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    blockchainId: blockchains[<SUI_MAINNET_INDEX>].id,
    contractAddress:
      "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
    logoUrl:
      "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
    isStablecoin: true,
    isActive: true,
    peggedCurrency: "USD",
  },
}),
```

`<SUI_MAINNET_INDEX>` = the array slot of the Sui mainnet blockchain — pick the actual integer at PR time based on where it lands. Don't hard-code a literal in the spec, because future seed insertions (a new EVM testnet, etc.) shift the indices and silent drift becomes an outage. Pattern matches the existing `blockchains[0]` (Ethereum), `blockchains[4]` (Lisk) usage.

**Re-seed safety.** The `update: {}` branches on token rows mean a re-seed never overwrites an ops-edited row (logo, isActive, decimals). For the blockchain rows, the `update` block only refreshes `rpcUrl` + `blockExplorer` — Gateway/x402/Paymaster/bundler fields are correctly absent because Sui has none of those (same posture as the Solana mainnet entry).

**No SuiNS / TakumiPay program ID columns.** TakumiPay on Sui is out of scope (§13). When that lands, add a `suiTakumiPayPackageId` column to `Blockchain` and seed it the same way `takumiPayProgramId` is set on `solana-devnet` (line ~647).

---

## 4. The `SuiWalletKit` interface contract

Implements every required method in `WalletKitAdapter`. Optional capability methods left `undefined`:

```ts
return {
  namespace: "sui" as const,
  supportsTokenTransfer: true,
  supportsPrivateKeyImport: true,
  displayName: "Sui",
  // No `brandColor`. ConnectSheet (`components/dapps-browser/approvals/ConnectSheet.tsx`)
  // is the only consumer and falls back to `DEFAULT_BRAND_COLOR` (neutral
  // grey) when the kit omits it. Sui has no project-assigned chip colour
  // so we don't invent one. EVM (#627EEA) and Solana (#9945FF) are the
  // exceptions, kept as-is.
  requireBiometricForConnect: true,

  formatConnectChipLabel(payload) {
    const network = (payload as { network?: string } | null)?.network ?? "mainnet";
    return `Sui · ${network[0].toUpperCase()}${network.slice(1)}`;
  },
  getChainId(chain) { return chain.namespace === "sui" ? chain.network : null; },
  formatChainLabel(chain) { return chain.namespace === "sui" ? `Sui ${capitalize(chain.network)}` : null; },
  nativeSymbol(chain) { return chain.namespace === "sui" ? "SUI" : null; },
  buildTxExplorerUrl(txDigest, chain) {
    if (chain.namespace !== "sui") return null;
    if (!txDigest) return null;
    // SuiVision (Sui Foundation–backed; most actively maintained explorer
    // with first-class testnet/devnet coverage). Path shape:
    //   https://suivision.xyz/txblock/{digest}            (mainnet)
    //   https://testnet.suivision.xyz/txblock/{digest}    (testnet)
    //   https://devnet.suivision.xyz/txblock/{digest}     (devnet)
    const subdomain = chain.network === "mainnet" ? "" : `${chain.network}.`;
    return `https://${subdomain}suivision.xyz/txblock/${txDigest}`;
  },

  validateAddress: isValidSuiAddress,
  validatePrivateKey: isValidSuiPrivateKey,
  validateMnemonic: (m) => validateMnemonic(m.trim(), englishWordlist),

  createWalletFromPrivateKey: ({ privateKey, name }) =>
    createSuiWalletFromPrivateKey(privateKey, name).then(orThrow),
  createWalletFromMnemonic: ({ mnemonic, name }) =>
    createSuiWalletFromMnemonic(mnemonic, name).then(orThrow),
  generateMnemonic: () => generateWalletMnemonic(),

  getSignerForWallet: (wallet) => getSuiSignerForWallet(wallet),
  signAuthMessage: async (wallet, message) => {
    const kp = await getSuiSignerForWallet(wallet);
    if (!kp) throw new Error("SuiWalletKit.signAuthMessage: no signer");
    const { signature } = await kp.signPersonalMessage(new TextEncoder().encode(message));
    return signature; // base64, includes flag + pubkey
  },

  getNativeBalance: async (address, chain) => {
    assertSui(chain);
    const client = new SuiClient({ url: chain.rpcUrl });
    const { totalBalance } = await client.getBalance({ owner: address });
    return BigInt(totalBalance);
  },
  getTokenBalance: async (address, chain, coinType) => {
    assertSui(chain);
    const client = new SuiClient({ url: chain.rpcUrl });
    const { totalBalance } = await client.getBalance({ owner: address, coinType });
    return BigInt(totalBalance);
  },

  // Pattern parity with SolanaWalletKit: the kit creates the client +
  // resolves the signer from the dwell site, then delegates the actual
  // PTB construction + submission to a pure transfer-service module.
  // Mirrors `services/walletKit/solana/SolanaWalletKit.sendNativeTransfer`
  // calling `buildAndSendSolTransfer`.
  sendNativeTransfer: async ({ wallet, to, amount, chain }) => {
    assertSui(chain);
    const signer = await getSuiSignerForWallet(wallet);
    if (!signer) throw new Error("No Sui signer for wallet");
    const client = new SuiClient({ url: chain.rpcUrl });
    return buildAndSendSuiTransfer({ client, signer, to, mist: amount });
  },
  // Delegates to the fungible-coin transfer service which dispatches on
  // token kind (Coin<T> / Regulated Coin<T> / Closed Loop Token<T>) —
  // see §4.1. Mirrors `SolanaWalletKit.sendTokenTransfer` →
  // `buildAndSendSplTransfer`, which itself auto-detects SPL Token vs
  // Token-2022 by reading the mint owner.
  sendTokenTransfer: async ({ wallet, to, amount, chain, contractAddress: coinType }) => {
    assertSui(chain);
    const signer = await getSuiSignerForWallet(wallet);
    if (!signer) throw new Error("No Sui signer for wallet");
    const client = new SuiClient({ url: chain.rpcUrl });
    return buildAndSendSuiCoinTransfer({ client, signer, to, coinType, amount });
  },

  estimateMaxTransferable: async ({ balance, chain, from }) => {
    assertSui(chain);
    // Reserve `MAX_GAS_BUDGET_MIST` (named constant) — Sui has a fixed
    // upper bound + storage rebate; safe default 0.05 SUI = 50_000_000 MIST.
    const reserve = MAX_GAS_BUDGET_MIST;
    return balance > reserve ? balance - reserve : 0n;
  },

  formatNativeAmount: (raw, chain) => {
    assertSui(chain);
    return `${(Number(raw) / 1e9).toFixed(4)} SUI`;
  },
  parseNativeAmount: (human, chain) => {
    assertSui(chain);
    return BigInt(Math.round(parseFloat(human) * 1e9));
  },
  truncateAddress: (a, opts) =>
    truncateAddressUtil({ address: a, startLength: opts?.start ?? 6, endLength: opts?.end ?? 4 }),
};
```

**Decimals reminder.** SUI is 9-decimal (1 SUI = 10⁹ MIST). The kit owns this constant.

### 4.1 Token-kind detection and dispatch — Sui's "SPL vs Token-2022" analogue

Sui's fungible-token surface is **not** a single primitive. There are three kinds, and any token-transfer feature that ignores the distinction will silently fail for some users — the same bug class that bit Solana wallets which only handled the legacy SPL Token program before Token-2022 mints proliferated. The kit detects the kind at the moment of transfer and dispatches the correct PTB shape.

| Kind | Type tag shape | Transfer instruction | Notes |
|------|----------------|----------------------|-------|
| **`Coin<T>`** (standard) | `<package>::<module>::<Symbol>` | `tx.splitCoins` + `tx.transferObjects` | The vast majority of tokens — wrapped assets (Wormhole / LayerZero), liquid-staking tokens (haSUI, afSUI), DeFi coins. |
| **Regulated `Coin<T>`** (DenyList) | Same as Coin<T> | Same as Coin<T> | Circle-issued **USDC**, **USDT** — `coin::transfer`-compatible, but the runtime can reject the tx if either party is on the DenyList. We surface that as a typed error; we do not pre-flight the deny-list (it's a privacy-leaky read and the chain is the authoritative gate). |
| **Closed Loop `Token<T>`** (`0x2::token::Token<T>`) | `<package>::<module>::<Symbol>` (no `Coin` wrapper) | `0x2::token::transfer` (or whatever `TokenPolicy<T>` allows) | Loyalty points, regulated allow-list tokens. NOT a Coin<T> — `splitCoins` won't work. Requires a reference to the shared `TokenPolicy<T>` object. |

Sui does **not** have direct equivalents of Token-2022's transfer-fee / transfer-hook / confidential-transfer extensions. The closest mechanism is `TokenPolicy<T>`'s rule chain on Closed Loop tokens, which is enforced inside `0x2::token::transfer`.

#### Detection algorithm — `services/chains/sui/tokenKind.ts` (new file)

```ts
/**
 * `detectSuiTokenKind` — single-source-of-truth resolver. Cached
 * per-(chain.network, coinType) for the session; cache cleared on lock.
 *
 * The detector uses ONLY chain reads — no API trust. The mobile token
 * row may carry a hint via `metadata.suiTokenKind`, but that's a UX
 * pre-fetch optimization (lets the send sheet render the right
 * confirmation copy without an RPC roundtrip), not authority. The
 * actual transfer always re-detects so a mis-seeded API row can never
 * cause a malformed PTB.
 */
export type SuiTokenKind =
  | { kind: "coin"; regulated: false; decimals: number }
  | { kind: "coin"; regulated: true;  decimals: number; denyListId: string }
  | { kind: "closed-loop"; decimals: number; tokenPolicyId: string };

export async function detectSuiTokenKind(
  client: SuiClient,
  coinType: string,
): Promise<SuiTokenKind | null> {
  // 1. Try Coin<T> path — getCoinMetadata returns null for non-Coin types.
  const meta = await client.getCoinMetadata({ coinType });
  if (meta) {
    // 2. Detect Regulated by querying for a DenyList object via
    //    `client.getDynamicFieldObject` against the well-known
    //    `0x403::deny_list::DenyList` shared object (or the equivalent
    //    `coin::DenyCapV2`), keyed on the type tag. If present → regulated.
    const denyListId = await resolveDenyListForCoin(client, coinType);
    if (denyListId) {
      return { kind: "coin", regulated: true, decimals: meta.decimals, denyListId };
    }
    return { kind: "coin", regulated: false, decimals: meta.decimals };
  }

  // 3. Closed Loop: query for `TokenPolicy<T>` shared object. Mysten's
  //    pattern is to publish the policy alongside the package; we resolve
  //    it via `client.queryEvents` for `TokenPolicyCreated<T>` once,
  //    then cache. If the project uses an unconventional policy id we
  //    surface a typed `SuiClosedLoopPolicyUnresolvedError` so the UX
  //    can ask the user to paste it (rare; loyalty programs typically
  //    integrate via dApp bridge, not raw send).
  const policy = await resolveTokenPolicy(client, coinType);
  if (policy) {
    return { kind: "closed-loop", decimals: policy.decimals, tokenPolicyId: policy.id };
  }

  return null; // unknown / unsupported (e.g. NFTs, kiosk-only assets)
}
```

#### Dispatcher — `services/chains/sui/coinTransferService.ts`

Naming and call shape mirror `services/chains/solana/splTransferService.ts`:
- File name: `coinTransferService.ts` (Solana: `splTransferService.ts`).
- Exported function: `buildAndSendSuiCoinTransfer` (Solana: `buildAndSendSplTransfer`).
- Signature: `({ client, signer, to, coinType, amount }) => Promise<digest>` — the kit owns client/signer creation; this module is pure.

```ts
export async function buildAndSendSuiCoinTransfer(args: {
  client: SuiClient;
  signer: Ed25519Keypair;
  to: string;
  coinType: string;
  amount: bigint;
}): Promise<string> {
  const owner = args.signer.toSuiAddress();
  const kind = await detectSuiTokenKind(args.client, args.coinType);
  if (!kind) throw new SuiUnsupportedTokenKindError(args.coinType);

  if (kind.kind === "coin") {
    // Standard + Regulated path. Pre-fetch the user's coin objects of
    // this type and merge into one before splitting — Sui doesn't have
    // a native ATA, so wallets carry many small Coin<T> objects.
    const { data: coins } = await args.client.getCoins({
      owner, coinType: args.coinType,
    });
    if (coins.length === 0) throw new SuiInsufficientCoinError(args.coinType);

    const tx = new Transaction();
    const [primary, ...rest] = coins.map((c) => tx.object(c.coinObjectId));
    if (rest.length > 0) tx.mergeCoins(primary, rest);
    const [out] = tx.splitCoins(primary, [tx.pure.u64(args.amount)]);
    tx.transferObjects([out], tx.pure.address(args.to));

    try {
      const { digest } = await args.client.signAndExecuteTransaction({
        transaction: tx, signer: args.signer, options: { showEffects: false },
      });
      return digest;
    } catch (e) {
      // Regulated coins: chain returns `EAddressDeniedForCoin` /
      // `ESenderDeniedForCoin` from `coin::deny_list_v2`. Map to a
      // typed error so the UX can render "USDC transfer blocked —
      // address is on the issuer's deny list" instead of a raw move
      // abort. Non-regulated coins surface the original error.
      if (kind.regulated && isDenyListAbort(e)) {
        throw new SuiRegulatedCoinDeniedError(args.coinType, e);
      }
      throw e;
    }
  }

  // Closed Loop path — `0x2::token::transfer<T>(token, recipient, policy)`.
  // The policy object pins what's allowed (allow-listed recipients,
  // mandatory off-chain attestation, etc.). If a rule fails the chain
  // aborts inside the policy; we surface that as a typed error too.
  const tokenObj = await pickClosedLoopTokenInputs(args.client, {
    owner, coinType: args.coinType, amount: args.amount,
  });
  const tx = new Transaction();
  tx.moveCall({
    target: "0x2::token::transfer",
    typeArguments: [args.coinType],
    arguments: [
      tx.object(tokenObj),
      tx.pure.address(args.to),
      tx.object(kind.tokenPolicyId),
    ],
  });
  try {
    const { digest } = await args.client.signAndExecuteTransaction({
      transaction: tx, signer: args.signer, options: { showEffects: false },
    });
    return digest;
  } catch (e) {
    throw new SuiClosedLoopPolicyDeniedError(args.coinType, kind.tokenPolicyId, e);
  }
}
```

For symmetry the native-SUI module follows the same shape: `services/chains/sui/transferService.ts` exports `buildAndSendSuiTransfer({ client, signer, to, mist }) => digest`. The `SuiWalletKit.sendNativeTransfer` sketch in §4 already calls it.

#### Typed errors (new exports in `services/chains/sui/errorCodes.ts`)
Filename mirrors `services/chains/solana/errorCodes.ts`. Solana keeps generic chain-level error decoding here (e.g. `assertSolanaErrorCode`); the Sui equivalent additionally exports the typed transfer errors below since Sui has no analogous Wallet-Standard-spec'd error-code catalogue we need to assert against.

| Class | When |
|-------|------|
| `SuiUnsupportedTokenKindError` | Detector returns `null` (NFT, kiosk-only asset, or unindexed Closed Loop). UX: "This token type isn't supported for transfers yet." |
| `SuiInsufficientCoinError`     | User has no `Coin<T>` of that type, or insufficient balance. |
| `SuiRegulatedCoinDeniedError`  | Issuer DenyList blocked the transfer (USDC/USDT). UX: name the issuer if known. |
| `SuiClosedLoopPolicyDeniedError` | `TokenPolicy<T>` rule rejected the transfer (allow-list miss, off-chain attestation expired, etc.). |
| `SuiClosedLoopPolicyUnresolvedError` | Detector couldn't find `TokenPolicy<T>` for a non-Coin type. |

The Solana side has the same shape — `SolanaAdapter.errorCodes.ts` + per-program decoders. The PRs that introduce these errors must wire them into `mapUnknownError` in `services/agent-executors/types.ts` so agent-mode failures surface useful reasons rather than `String(err)`.

#### `getTokenBalance` — same dispatch
- `Coin<T>` (regulated or not): `client.getBalance({ owner, coinType })`. Already in §4.
- `Closed Loop Token<T>`: `client.getOwnedObjects({ owner, filter: { StructType: "0x2::token::Token<" + coinType + ">" } })` — sum the `balance` fields. Add a small helper `getClosedLoopTokenBalance` so the kit can branch on detector output without leaking Closed-Loop semantics into shared code.

#### What we explicitly defer (call out in UX strings, not just docs)
- **NFTs / Kiosk objects.** Out of scope for `sendTokenTransfer`. A future `sendNftTransfer` lives in a follow-up spec.
- **TokenPolicy rule chains that require off-chain proof** (e.g. "burn-only", "spend-cap-with-attestation"). The detector flags these (`SuiClosedLoopPolicyDeniedError`); the dApp-bridge milestone is the right surface for these flows, not the mobile send sheet.
- **Confidential / shielded coins** (none on Sui mainnet today; future work if/when standardised).

#### API token row — optional `metadata.suiTokenKind` hint
The seed-script change in §3.8 stores USDC as a regular token row. To pre-render the right confirmation copy on the send sheet without an RPC round-trip, the API can optionally populate a `metadata` JSON blob on the Token row (no schema change — `metadata` is JSON):
```json
{ "suiTokenKind": "coin", "regulated": true, "issuer": "Circle" }
```
The mobile detector still re-runs at transfer time so a stale/wrong hint never produces a malformed PTB. Treat the hint as cosmetic-only.

#### Agent-mode coverage
`send_sui_coin` (introduced in §7.2) calls `SuiWalletKit.sendTokenTransfer`, which dispatches through `sendSuiFungibleTransfer`. So Closed Loop and Regulated Coin support drop in for the agent automatically — no per-tool branching. The executor maps the typed errors above to stable `ExecutorErrorCode` values:

| Sui error | Mapped reason |
|-----------|---------------|
| `SuiUnsupportedTokenKindError` | `not_implemented` |
| `SuiInsufficientCoinError`     | `insufficient_funds` |
| `SuiRegulatedCoinDeniedError`  | `invalid_input` (with descriptive message) |
| `SuiClosedLoopPolicyDeniedError` | `invalid_input` |
| `SuiClosedLoopPolicyUnresolvedError` | `not_implemented` |

---

## 5. The `SuiAdapter` (scaffold — disabled in v1)

Skeleton matches `SolanaAdapter`. Methods stubbed:

```ts
class SuiAdapter implements ChainAdapter {
  readonly namespace = "sui" as const;
  getInjectedScript() { return "/* sui injected provider not enabled */"; }
  onStateChange() { return null; }
  async handleRequest(req: ChainRequest): Promise<ChainResult> {
    return { status: "error", code: 4200, message: "Sui dApp bridge not enabled in this build" };
  }
  async executeApproval(): Promise<unknown> { throw new Error("not enabled"); }
}
```

Boot path adds it behind a constant:
```ts
const FEATURE_SUI_DAPP_BRIDGE = false;
if (FEATURE_SUI_DAPP_BRIDGE) ChainAdapterRegistry.register(createSuiAdapter());
```
This makes the future wiring a one-line flip without re-touching boot order.

When the user opens the WebView session that follows this milestone, the work to fill `SuiAdapter` is:
- `getInjectedScript`: emit a `window.sui` provider exposing `standard:connect`, `standard:events`, `sui:signTransaction`, `sui:signAndExecuteTransaction`, `sui:signPersonalMessage`. Use the Wallet Standard event-discoverability shim ("registerWallet").
- `handleRequest`: route the four methods + their legacy aliases (`sui:signTransactionBlock`, `sui:signAndExecuteTransactionBlock`) into approval intents. Mirror `SolanaAdapter.scopeCtxToOrigin` for per-origin grants.
- `executeApproval`: delegate to `SuiWalletKit.signX_X` helpers; never reconstruct keys outside `walletService`.
- A new `services/chains/sui/inspector.ts` to decode PTBs (`Transaction.from(bytes)` then iterate commands) for the approval sheet.

---

## 6. Security invariants (new gates)

Treat the new dwell site like the EVM and Solana ones — single blessed call site, non-extractable signer where the platform allows, no logging.

- **TWV-2026-XXX (SUI)** *(new gate to issue with the implementation PR)*
  - The 32-byte ed25519 secret is reconstructed only inside `getSuiSignerForWallet`.
  - It is fed straight into `Ed25519Keypair.fromSecretKey(seed)` from `@mysten/sui/keypairs/ed25519`. The keypair is cached by address in `suiSignerCache`; `clearAccountCache()` wipes it.
  - The raw `seed` binding is a local `const` that never escapes the function scope. No closure capture, no return of the bytes.
  - Never log the secret. `__DEV__` breadcrumbs limited to `"derivation failed"` strings.
  - The signing primitive must use the Mysten SDK's `messageWithIntent` + `signTransaction` / `signPersonalMessage` helpers — we never construct intent bytes by hand. (Constructing intent ourselves risks re-implementing the bug class the SDK already handles.)

- **TWV-2026-002 carryover.** `walletService.ts` already throws if loaded before the CSPRNG polyfill — Sui derivation rides on the same guard.

- **TWV-2026-060 carryover.** `TWallet` rows (including Sui) live in the single `WALLET_BUNDLE_KEY` blob, gated by one biometric prompt. No Sui-specific keystore branch.

- **No Secp256k1 / Secp256r1 in v1.** The kit's `validatePrivateKey` rejects everything that isn't decodable as a 32-byte ed25519 seed (bech32 `suiprivkey1` payload, raw 32-byte hex, base64). Adding Secp later requires a new gate because the flag-byte and address derivation diverge.

---

## 7. Agent Mode integration

### 7.1 `walletContext` (no schema change)
`AgentMode.tsx` already emits `namespace: activeChain.namespace`. Once `activeChain.namespace === "sui"`, the server reads `namespace=sui` and routes to Sui tools. `chain_id: 0` for non-EVM is unchanged — Sui's network identifier is `chain_name` / `chain_symbol` ("SUI").

### 7.2 New executors — `services/agent-executors/sui.ts`
Mirror the Solana file shape. Tools:
| Tool | Description |
|------|-------------|
| `get_wallet_sui_balance` | Connected wallet's SUI balance on the active network. Returns raw MIST + display string. |
| `get_sui_balance`        | SUI balance for an arbitrary address (falls back to connected wallet). |
| `send_sui`               | Native SUI transfer. Returns transaction digest as `data.digest` (NOT in `tx_hash`, since the wire schema validates `tx_hash` as 0x-hex). |
| `get_wallet_sui_coins`   | List Sui coins (CoinType + balance) owned by the wallet. Mirrors `get_wallet_spl_tokens`. |
| `send_sui_coin`          | Send a non-SUI Sui coin given its `CoinType` + decimals. |

`EXPECTED_MOBILE_TOOLS` in `services/agent-executors/index.ts` extends with the five names above. The server-side registry lands these as `executor: "mobile"` entries — coordinate the rollout the same way the Solana spec coordinated server changes.

### 7.3 No agent-mode WebView dApp surface in v1
Agent Mode does not need the dApp bridge; it talks directly to executors. So agent-mode Sui works the moment §3 + §7.2 land.

---

## 8. UI changes

### 8.1 Wallet creation / import
`components/wallet/create/*` already iterates `walletKitRegistry.getAll()` for the namespace picker (verified by Solana shipping without per-screen edits). The Sui kit appears automatically with its `displayName` / `brandColor`.

`ImportPrivateKeySheet` uses `kit.validatePrivateKey` for narrowing — accepts `suiprivkey1…` once `validateSuiPrivateKey` returns true.

`createWalletFromParams` switch in `utils/walletUtils.ts` adds two new cases: `SuiSeedPhrase` and `SuiPrivateKey`. `TWalletCreationParams.source` union extends with these strings.

### 8.2 Send screen
`app/send.tsx` is namespace-agnostic — it asks the kit for `parseNativeAmount`, `formatNativeAmount`, `sendNativeTransfer`. The only adjustment we anticipate is decimal handling for SUI (9 decimals matches Solana, so the existing string parsing should work; verify in tests).

### 8.3 Multi-chain mnemonic
`services/walletKit/deriveAll.ts` already iterates the requested namespaces; create-new flow (`bootstrap.ts`) chooses the namespace list. We extend that list to `["eip155", "solana", "sui"]` after wallet kits boot — yields three wallets sharing the mnemonic from one create flow. Partial-success path is already in the helper; failures in any one chain don't poison the others.

### 8.4 Chain switcher
`components/asset-explorer/NetworkRadioButtons.tsx` (currently dirty in working tree — keep changes orthogonal) renders rows from the live blockchain feed. Sui rows show up when the backend feed includes them; UI does not need a new branch.

---

## 9. Testing

| Test                                                | Mechanism                                                 |
|----------------------------------------------------|-----------------------------------------------------------|
| Mnemonic → Sui address determinism                  | Vector tests against `Ed25519Keypair.deriveKeypair` (`@mysten/sui`). |
| `validateSuiAddress` accepts canonical, rejects 20-byte legacy + non-hex. | Boundary tests in `walletUtils.test.ts`. |
| `signPersonalMessage` byte-for-byte equivalence with `Ed25519Keypair.signPersonalMessage`. | `signPersonalMessage.test.ts`. |
| `signAndExecuteTransaction` round-trip with the SDK's local helper (no fullnode call). | `signTransaction.test.ts` against a hard-coded BCS payload. |
| `SuiWalletKit.estimateMaxTransferable` reserves `MAX_GAS_BUDGET_MIST`. | Pure test. |
| `detectSuiTokenKind` returns the right discriminator for: standard Coin (e.g. wrapped ETH), regulated Coin (USDC), Closed Loop Token (sample loyalty token), unknown (NFT type tag). | Mock `SuiClient.getCoinMetadata` / `getDynamicFieldObject` / `queryEvents`. |
| `buildAndSendSuiCoinTransfer` produces the right PTB shape per kind: `splitCoins+transferObjects` for Coin<T>, `0x2::token::transfer` move call for Closed Loop. | Snapshot the PTB BCS, decode and assert command list. |
| `buildAndSendSuiTransfer` (native SUI) produces the canonical `splitCoins(tx.gas, [amount]) + transferObjects` PTB. | Snapshot test, mirrors `buildAndSendSolTransfer` test shape. |
| `SuiWalletKit.sendNativeTransfer` / `sendTokenTransfer` delegate to the transfer-service modules without inlining PTB construction (regression guard against drift from the Solana pattern). | Spy on the transfer-service module, assert call shape. |
| Regulated Coin deny-list abort maps to `SuiRegulatedCoinDeniedError`; Closed Loop policy abort maps to `SuiClosedLoopPolicyDeniedError`. | Stub the client to throw the corresponding move-abort string. |
| `deriveWalletsFromMnemonic(mnemonic, ["eip155","solana","sui"])` returns three wallets sharing `seedPhrase`. | Existing test extends. |
| `clearAccountCache()` wipes the new `suiSignerCache`. | `walletService.test.ts` extension. |
| Agent executors: `get_wallet_sui_balance`, `send_sui` (mocked client). | New `services/agent-executors/sui.test.ts`. |
| Boot-order regression: registering `SuiWalletKit` does not break Solana / EVM. | Touched in `bootstrap.test.ts`. |

Run `pnpm check:syntax` and `pnpm biome:check` — both must pass.

---

## 10. Task breakdown (drop into `docs/sui-chain-support-task/`)

Each task lands as its own `NN_<slug>.md` mirroring the Solana task layout.

| # | Task | Pre-reqs | Outputs |
|---|------|----------|---------|
| 00 | Hermes / RN compatibility smoke test for `@mysten/sui` | — | A throw-away `app/_dev/sui-compat.tsx` that calls `Ed25519Keypair.deriveKeypair`, `Transaction.build`, etc. Delete after passing. |
| 01 | Add `TSuiFields` + extend `TWallet` / `TWalletCreationParams` | 00 | `constants/types/walletTypes.ts` |
| 02 | Add Sui variant to `ChainConfig` + static fallback row | 01 | `constants/configs/chainConfig.ts` |
| 03 | `services/chains/sui/derivation.ts` + tests | 00 | Deterministic vectors |
| 04 | `services/chains/sui/codec.ts` (bech32, address derivation, intent helpers) | 03 | Vectors against SDK |
| 05 | Extend `walletService.ts` with `getSuiSignerForWallet` + cache + clear | 03, 04 | New gate `TWV-2026-XXX` |
| 06 | `utils/walletUtils.ts`: validators + `createSuiWallet*` | 05 | Hooks into `createWalletFromParams` |
| 06b | `services/chains/sui/errorCodes.ts` + `tokenKind.ts` + `transferService.ts` + `coinTransferService.ts` + tests. Filenames mirror `services/chains/solana/{errorCodes,transferService,splTransferService}.ts`. Covers Coin<T>, Regulated Coin<T>, Closed Loop Token<T> dispatch per §4.1. | 04 | Vectors + mocked client tests for all three branches; PTB-shape snapshots |
| 07 | `services/walletKit/sui/SuiWalletKit.ts` + tests (consumes 06b — kit delegates to `buildAndSendSuiTransfer` / `buildAndSendSuiCoinTransfer` exactly the way `SolanaWalletKit` delegates to `buildAndSendSolTransfer` / `buildAndSendSplTransfer`). | 05, 06, 06b | Implements adapter |
| 08 | Register kit in `services/walletKit/boot.ts` | 07 | Solana/EVM regression test |
| 09 | Extend create-new flow to include `"sui"` in `deriveWalletsFromMnemonic` namespaces | 08 | Three-wallet output |
| 10 | `services/agent-executors/sui.ts` + register + add to `EXPECTED_MOBILE_TOOLS` | 07 | Coordinate with backend descriptor list |
| 11 | `services/chains/sui/SuiAdapter.ts` *scaffold* + boot-time guard | 07 | Stub returning -32601 |
| 12 | Telemetry + breadcrumbs (no key bytes) | 05 | Sentry tags `chain=sui` |
| 13 | Pre-flight migration check: legacy 20-byte address rejection in send sheet | 06 | Typed error wired to UX |
| 14 | **API seed script update** — add `sui-mainnet` + `sui-testnet` blockchain rows and Sui-mainnet USDC token row to `takumi-api/src/scripts/prisma/seed.ts` (see §3.8). Lands in the API repo, not the mobile repo. Must merge **before** PR 3 is enabled in any environment, otherwise the mobile picker / agent reads return an empty Sui token list. | — | Seed re-runs cleanly in dev + staging. |

Tasks 14+ (live dApp bridge, inspectors, approval renderers, zkLogin, sponsored txs) are explicitly **out of scope** for this milestone and live in a follow-up spec.

---

## 11. Risks & open questions

| Risk | Mitigation |
|------|------------|
| `@mysten/sui` pulls in Node-only crypto (`crypto`, `stream`) that Hermes can't load. | Task 00 verifies before any other work. Worst case: route through the existing Solana playbook (`@noble/hashes` for hashing, `@noble/curves/ed25519` for signing, hand-rolled BCS via `@mysten/bcs`). The Solana derivation file already does this for SLIP-0010 to dodge `cipher-base`. |
| `bech32` decode of `suiprivkey1` not bundled. | `@scure/base` (transitive of `@scure/bip39`) ships a bech32 helper; verify the import path. Alternative: copy the 50-line decoder from `@mysten/sui` source. |
| Backend `/blockchains` feed doesn't yet return Sui rows. | Static `supportedChains` fallback (EVM-style) renders the chain in the picker; backend rollout is decoupled. |
| Public mainnet RPC rate-limits `getBalance` under load. | Use the same `MultiProvider`/rate-limiter pattern from `services/rpc/`. Defer until production load shows it's needed. |
| Sui v1 transaction format may shift (legacy `signTransactionBlock` vs current `signTransaction`). | Bridge scaffold supports both names. Wallet Standard's "legacy methods" list is explicit — we just register both feature names. |
| zkLogin / multisig users will not be able to use the wallet. | Out of scope — calls render an error in the picker if a `TSuiFields.scheme !== "ed25519"` row appears. Future milestone gates them in. |

### Resolved decisions (locked in 2026-05-05)
1. **Default network = `sui:mainnet`.** Static fallback row points at `https://fullnode.mainnet.sui.io:443`. Testnet/devnet rows ship via backend feed only.
2. **Token list is API-driven.** USDC on Sui mainnet (`0xdba…::usdc::USDC`) is served by the backend `/tokens` endpoint, never hard-coded. Mobile uses the same `tokenApi.searchTokens({ blockchainId })` path Solana uses today (5-minute MMKV cache, offline-stale fallback).
3. **Explorer = SuiVision** (`https://suivision.xyz/txblock/{digest}`, with `testnet.` / `devnet.` subdomain prefix for non-mainnet). Picked over Suiscan because SuiVision is Sui-Foundation–backed, has the most reliable testnet/devnet coverage, and exposes the cleanest `txblock/{digest}` URL shape — no query-string hacks. Mysten's first-party explorer was sunset in 2025.
4. **No `brandColor`** in the Sui kit. `ConnectSheet.tsx` (the only consumer) falls back to `DEFAULT_BRAND_COLOR` when the kit omits it. Sui doesn't have a project-assigned chip colour and we're not inventing one.

---

## 12. Roll-out plan

1. **PR 1 (this spec)** — land the spec + empty `docs/sui-chain-support-task/` files (one per task). No code.
2. **API PR (task 14)** — `takumi-api/src/scripts/prisma/seed.ts` gains the Sui blockchain rows + USDC token row (§3.8). Re-seed dev + staging. **Must merge before PR 3 below**, otherwise the mobile picker / agent return an empty Sui token list and the QA build looks broken.
3. **PR 2 (tasks 00–06)** — types, derivation, dwell site, validators. No UI exposure yet (kit not registered).
4. **PR 3 (task 07–09)** — `SuiWalletKit` registered. Create-new flow optionally derives a Sui wallet (feature-flagged in MMKV until QA approves). **Depends on the API PR above.**
5. **PR 4 (tasks 10, 12, 13)** — Agent-mode tools + telemetry + legacy-address guard. Coordinate the server-side tool registry update.
6. **PR 5 (task 11)** — `SuiAdapter` scaffold lands behind `FEATURE_SUI_DAPP_BRIDGE=false`. Sets up the next milestone with one-line ON.
7. **Future spec** — `docs/sui-dapp-bridge-spec.md`: live `window.sui` injected provider, approval sheet, PTB inspector, sign-in-with-Sui (`sui:signPersonalMessage`-based SIWS), reportTransactionEffects relay.

---

## 13. Future work (not in this milestone)
- Sui dApp bridge (PR 6+, separate spec).
- Sponsored transactions / gas station integration.
- zkLogin (Google / Apple → Sui address) — a *new* `TWalletType` and a different dwell site shape (no local secret).
- Multisig accounts (1-of-N from existing wallet rows).
- Sui Name Service (SuiNS) reverse lookup in the address book.
- Sui Move package decoders for the inspector.
- TakumiPay program on Sui — needs a Move package and a new `services/walletKit/sui/sendMoveCall.ts` analogue of `sendAnchorInstruction`.
