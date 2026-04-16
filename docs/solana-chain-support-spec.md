# Solana Chain Support — Engineering Spec

**Status:** Draft
**Target version:** `takumipay-mobile-app` v2.3.0
**Scope:** mobile-app only. DApp-browser parity (Wallet Standard v1.1 events, SPL tooling deep-links, WalletConnect v2 `solana:*` namespaces) is explicitly deferred to a follow-up.

---

## 1. Summary

Add Solana as a first-class chain inside the mobile wallet. Users can create, import, view, and send from a Solana wallet, side-by-side with their existing EVM wallets, and the dApp-browser `SolanaAdapter` scaffold gets wired to a real signer so WebView-injected Solana dApps start working without further changes.

Solana signing is built on **`@solana/kit`** (Anza, the functional v2 successor to `@solana/web3.js`). Viem remains the EVM signer — zero behavior change on the EVM path.

**Architecture — we dock, we don't branch.** The dApp-bridge spec (`docs/dapp-bridge-spec.md`) established a docking-port pattern for WebView dApp requests: any new chain plugs in by implementing a single `ChainAdapter`, and any new UI surface registers a single `ApprovalRenderer`. This spec extends that pattern to *first-party* wallet operations with a second docking port — the **`WalletKitAdapter`** (§4.5). Every namespace ships one: `EvmWalletKit` (wraps existing viem code), `SolanaWalletKit` (built on `@solana/kit`). Screens (`app/send.tsx`, `app/wallet.tsx`, import flows) resolve a kit by namespace and call uniform methods — no `if (namespace === "solana")` branches inside screens. Adding Sui / Bitcoin / Cosmos later is one new file + one register call; zero edits to `app/`.

**Onboarding — simplified.** The `/wallet-setup`, `/import-seed-phrase`, `/import-private-key` routes are removed. Login stays auth-only (the *Continue with Google* button keeps its current placeholder handler; real auth is a separate future session). On first sign-in for a zero-wallet account, a shared BIP-39 mnemonic is auto-derived across every registered `WalletKitAdapter` (Option C — §14), so users land on home with one EVM + one Solana wallet from one backup phrase. All wallet creation, import, and management consolidates into `wallet.tsx` via new bottom sheets (`AddWalletSheet` → Create / Import seed / Import private key). Seed-phrase import is multi-chain (one mnemonic, pick which chains to derive); private-key import is explicitly single-chain with a user-confirmed picker (to cover CLI-generated and mnemonic-less keys without risking cross-curve ghost wallets). See §14 for the full onboarding & management UX.

---

## 2. Goals / Non-goals

### Goals

- **G1.** Generate a Solana keypair (from fresh BIP-39 mnemonic or user-supplied private key/phrase) and persist it under the existing TWV-2026-057 bundle-mode secure store.
- **G2.** Display SOL balance for a Solana-namespace active wallet in `app/wallet.tsx` and `app/send.tsx`.
- **G3.** Send native SOL to a recipient from `app/send.tsx` with the same PIN-confirm + busy-state UX EVM has.
- **G4.** Import existing Solana wallets via mnemonic (`m/44'/501'/0'/0'`, SLIP-0010 ed25519) and via 64-byte base58 private key (Phantom export format).
- **G5.** Allow `activeChain` to be a Solana cluster (`mainnet-beta`, `devnet`) and survive the existing agent-busy gating on chain switch.
- **G6.** Register a real `SolanaSigner` with the existing `SolanaAdapter.registerSolanaSigner` hook so the dApp bridge can complete `solana:signMessage` / `solana:signTransaction` / `solana:signAndSendTransaction` when a Solana wallet is active.
- **G7.** Match existing security review gates (TWV-2026-002 CSPRNG, TWV-2026-046 signing-path parity, TWV-2026-057 JS-heap dwell, TWV-2026-060 bundle mode) and introduce one new gate (TWV-2026-070) covering Ed25519 polyfill boot + Solana signer dwell.

### Non-goals (this spec)

- **N1.** SPL-token transfers. Scope stays on native SOL. `useGroupedTokenBalances` filters SPL out for the Solana namespace until the indexer has a Solana provider.
- **N2.** Solana NFTs, staking, DeFi interactions — all downstream of an indexer provider we haven't built.
- **N3.** Smart-account / 4337 / 7702 analogs on Solana (not applicable).
- **N4.** Unified multi-chain mnemonic (one wallet row deriving both EVM + Solana). See §12; this spec ships separate `TWallet` rows per namespace.
- **N5.** Solana transaction history in `activities.tsx` / `activity-detail.tsx`. The indexer-provider surface is already multi-namespace-aware (`WalletTransaction.namespace`), but no Solana provider is registered in `indexerRegistry`. Follow-up.
- **N6.** Full Wallet Standard v1.1 announcement semantics in the injected script.
- **N7.** WalletConnect v2 Solana namespace wiring. `caipMapping.ts` already maps `"solana"` but the session builder does not yet advertise it.

---

## 3. Background / Current state

### 3.1 Existing multi-chain scaffolding (already merged in v2.0)

| File | What's there |
|---|---|
| `services/chains/types.ts` | `Namespace = "eip155" \| "solana" \| "sui"`, generic `ChainAdapter` interface (`getInjectedScript`, `handleRequest`, `executeApproval`, `onStateChange`). |
| `services/chains/evm/EvmAdapter.ts` | Fully wired EVM adapter (viem-based), registered in `services/bridge/boot.ts`. |
| `services/chains/solana/SolanaAdapter.ts` | Scaffold. Renders `window.solana` shim, maps `solana:*` methods to `ApprovalIntent`, delegates signing to `SolanaSignerFns` registered via `registerSolanaSigner()`. **No signer is registered today.** |
| `services/chains/solana/payloads.ts` | `SolanaConnectPayload`, `SolanaSignMessagePayload`, `SolanaSignTxPayload`. |
| `components/dapps-browser/approvals/SolanaSignMessageSheet.tsx` + `SolanaTransactionSheet.tsx` | Approval sheets, wired to `namespace === "solana"` intents in `renderers.ts`. |
| `services/walletconnect/caipMapping.ts` | Already maps `"solana"` in `caip2ToNamespace` / `namespaceToCaip2`. |
| `constants/types/walletTypes.ts` | `TWallet.namespace: Namespace` is non-optional. `applyNamespaceBackfill` stamps `"eip155"` on legacy rows. |
| `services/indexer/types.ts` | `TokenBalance` + `WalletTransaction` both carry `namespace: string`. Registry dispatch is provider-agnostic. |

### 3.2 Where EVM coupling actually lives

| Layer | File | Current EVM-only behavior |
|---|---|---|
| Wallet creation | `utils/walletUtils.ts::createWalletFromParams` | Hardcodes `namespace: "eip155"`; uses viem's `privateKeyToAccount` / `mnemonicToAccount`. |
| Key reconstruction | `services/walletService.ts::getAccountForWallet` | Returns `HDAccount \| PrivateKeyAccount` only; silently `null` for non-EVM. |
| Client factories | `hooks/useWallet.ts::getClientForActiveWallet`, `getPublicClientForActiveChain` | Viem `WalletClient` / `PublicClient` only. |
| Chain config | `constants/configs/chainConfig.ts::ChainConfig` | `{ chain: viem.Chain }` — no room for Solana cluster/rpc. |
| Chain-switch build | `hooks/useWallet.ts::changeActiveChainInternal` | Synthesizes a viem `Chain` shape from backend blockchain rows, no namespace branch. |
| Utility client factory | `utils/clients.ts` | viem `createPublicClient` / `createWalletClient`. |
| Balance fetch | `app/send.tsx`, `components/wallet/*` | `publicClient.getBalance({ address })` with `0x`-prefixed address. |
| Transfer | `app/send.tsx::handlePinConfirm` | `walletClient.sendTransaction` + `erc20Abi.writeContract`. |
| Address validation | `utils/walletUtils.ts::isValidPrivateKey` | 64-hex only. |
| Import forms | `app/import-private-key.tsx`, `app/import-seed-phrase.tsx` | Route straight to EVM creators. |
| Chain picker | `components/common/ChainSelector.tsx` | Iterates EVM `supportedChains`. |
| DApp bridge bootstrap | `services/bridge/boot.ts` | Creates `SolanaAdapter` but **does not register a signer**. |

### 3.3 Security posture to preserve

The `services/walletService.ts` header documents three review gates; any Solana path must satisfy all of them:

- **TWV-2026-002** — CSPRNG polyfill must load before any crypto use; fail loud on boot.
- **TWV-2026-046** — the software signing path (used when no HW wallet is paired) must be at least as strong as the HW path. For ECDSA that meant RFC-6979 + auxiliary entropy. For Ed25519 the equivalent is: deterministic nonce per RFC-8032 (inherent to Ed25519), extractable-false `CryptoKey`, no `Math.random` anywhere on the path.
- **TWV-2026-057** — `walletService.ts` is the *single* blessed JS-heap dwell site for decrypted key material. A Solana signer must fit the same envelope: one function call site reconstructs the key, caches the signer, and `clearAccountCache` wipes it on lock/logout.
- **TWV-2026-060** — bundle-mode storage (one auth prompt unlocks all wallets). Solana fields ride inside the same opaque JSON bundle; no parallel secure-store key.

### 3.4 `@solana/kit` properties relevant to this integration

- Functional API, tree-shakable, zero deps. Main entry `@solana/kit` re-exports `createSolanaRpc`, `generateKeyPair`, `signBytes`, `verifySignature`, and the signers/transaction-messages/transactions surface.
- Key representation is `CryptoKeyPair { privateKey: CryptoKey; publicKey: CryptoKey }` via WebCrypto. Bytes → keypair via `createKeyPairFromBytes(64-byte)` or `createKeyPairFromPrivateKeyBytes(32-byte)`.
- **Ed25519 is not supported in Hermes' WebCrypto** → requires **`@solana/webcrypto-ed25519-polyfill`** as the first import after `react-native-get-random-values`. Without it, `subtle.generateKey({name:'Ed25519'},…)` throws on mobile.
- No BIP-39 / HD-derivation built in. Kit treats derivation as out-of-scope. Companion libs (`@scure/bip39` — already pulled in by viem; `ed25519-hd-key` for SLIP-0010) handle it.
- Signer interface: `KeyPairSigner`, `MessagePartialSigner`, `TransactionPartialSigner`, `TransactionModifyingSigner`, `TransactionSendingSigner`, `NoopSigner`. `createSignerFromKeyPair(kp)` returns a full-capability signer.
- Transfer-SOL instruction is in the companion package `@solana-program/system::getTransferSolInstruction`.
- Send/confirm: `sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(tx, { commitment })`.

---

## 4. Architecture

### 4.1 Namespace identity model

Each wallet row keeps a single namespace. Users who want both chains hold **two `TWallet` entries** — one `namespace: "eip155"`, one `namespace: "solana"`. Rationale:

- `TWallet.address` is the uniqueness key in `walletService.addWallet` (`wallets.some(w => w.address.toLowerCase() === …)`), in `accountCache[address]`, and in the public `WALLET_INDEX_KEY`.
- Collapsing to "one wallet, many addresses" forces a schema migration, a new index format, and changes to every call path keyed on address.
- Namespace is already a discriminator — a minimum-change extension.
- The model is forward-compatible: if a unified-mnemonic UX becomes a requirement, add a `derivationGroupId` field that two rows can share without re-migrating storage (§12).

### 4.2 Active-chain model

Widen `ChainConfig` to a discriminated union:

```ts
type ChainConfig =
  | {
      namespace: "eip155";
      chain: viem.Chain;          // unchanged — existing EVM callers keep working
      iconUrl?: string;
      isTestnet?: boolean;
    }
  | {
      namespace: "solana";
      cluster: "mainnet-beta" | "devnet";
      rpcUrl: string;
      rpcSubscriptionsUrl?: string; // optional wss for `sendAndConfirm`
      iconUrl?: string;
      isTestnet?: boolean;          // true when cluster === "devnet"
    };
```

`supportedChains` gains two Solana entries. Fallback RPCs read from env:

- `EXPO_PUBLIC_SOLANA_MAINNET_RPC` (default `https://api.mainnet-beta.solana.com`)
- `EXPO_PUBLIC_SOLANA_DEVNET_RPC` (default `https://api.devnet.solana.com`)

The persisted `active_chain` stays a `JSON.stringify`'d object — `ChainConfig`-as-union survives round-trip because it's plain data.

### 4.3 Wallet data model

`TWallet` gains one optional block (mirror of the `smart4337?` / `smart7702?` pattern):

```ts
interface TSolanaFields {
  pubkeyBase58: string;       // redundant with `address` but explicit about encoding
  derivationPath?: string;    // default "m/44'/501'/0'/0'" when created from mnemonic
}

interface TWallet {
  // …existing fields…
  solana?: TSolanaFields;
}
```

Behavior:

- `TWallet.address` is base58 for Solana (same field, different encoding). All code that reads `address` should treat it as an opaque string already — grep confirms the only viem-specific casts are `as \`0x${string}\`` at explicit EVM call sites.
- `TWallet.privateKey` (existing optional) stores the 64-byte secret key **base58-encoded** when `namespace === "solana"`. Matches Phantom's export format; field stays a plain string.
- `TWallet.seedPhrase` — same 12/24-word BIP-39 mnemonic; Solana derivation is done at sign time.
- `WalletType` stays `"PrivateKey" | "SeedPhrase" | "Social" | "Smart4337" | "Smart7702"`. Solana wallets use `"PrivateKey"` or `"SeedPhrase"`, disambiguated by `namespace`.

Creation params widen:

```ts
interface TWalletCreationParams {
  source:
    | "social"
    | "SeedPhrase"          // EVM
    | "PrivateKey"
    | "SolanaSeedPhrase"
    | "SolanaPrivateKey";
  privateKey?: string;       // hex (EVM) or base58 (Solana)
  seedPhrase?: string;
  name?: string;
  provider?: string;
  socialAccount?: { email: string; name: string };
  account?: any;
}
```

### 4.4 Layer diagram (Solana path through the docking ports)

```
app/send.tsx  app/wallet.tsx  app/import-*  components/common/ChainSelector
       │             │             │                │
       └─────────────┼─────────────┴────────────────┘
                     │  no `if (namespace === "solana")` here —
                     │  callsites resolve a kit by namespace and dispatch.
                     ▼
          hooks/useWallet.ts
          • getActiveWalletKit(): WalletKitAdapter
          • getKitForWallet(w): WalletKitAdapter
                     │
                     ▼
       ┌────────── walletKitRegistry (services/walletKit/registry.ts) ──────────┐
       │       resolves WalletKitAdapter by Namespace ("eip155" | "solana")    │
       └───────────────────────────────────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
EvmWalletKit               SolanaWalletKit
(services/walletKit/evm/) (services/walletKit/solana/)
  • wraps existing            • createWallet*, validate*
    viem code paths            • getBalance, sendNativeTransfer
    so EVM keeps                • getSigner (delegates to walletService)
    behaving identically       • formatNativeAmount, estimateMaxTransferable
        │                         │
        ▼                         ▼
   utils/clients +            services/chains/solana/
   utils/walletUtils          ├── transferService.ts  — kit send-tx flow
   (viem)                     ├── codec.ts            — base58 ↔ bytes, tx ↔ base64
                              └── derivation.ts       — SLIP-0010 m/44'/501'/0'/0'
        │                         │
        └────────────┬────────────┘
                     ▼
      services/walletService.ts (TWV-2026-057 / -070 dwell site)
      • getAccountForWallet(w)         — viem account (EVM)
      • getSolanaSignerForWallet(w)    — kit KeyPairSigner (Solana)
                     │
            ┌────────┴───────┐
            ▼                ▼
          viem          @solana/kit
                        + @solana-program/system

DApp-bridge side (separate docking port — see dapp-bridge-spec.md):
  EvmAdapter / SolanaAdapter implement ChainAdapter;
  SolanaAdapter delegates execute → installSolanaSigner(...)
  which itself routes through the SolanaWalletKit.
```

### 4.5 Wallet Kit docking port

The dApp-bridge spec (`docs/dapp-bridge-spec.md` §4) defined two ports:

1. **Chain Port** — `ChainAdapter` per namespace (signing for in-WebView dApps).
2. **UI Bridge Port** — `ApprovalRenderer` per intent kind.

That covers dApp-originated requests. It does **not** cover *first-party* mobile wallet operations: keypair creation/import, address validation, native-balance fetch, native send, MAX-amount calculation, balance formatting. Today `app/send.tsx` and friends call viem helpers directly because there's only one chain. Adding Solana via inline `if (namespace === "solana")` branches would distribute namespace knowledge across every screen and make Sui/Bitcoin a copy-paste tax. We dock those ops the same way the bridge docks signing — through a new port:

```ts
// services/walletKit/types.ts
export interface NativeTransferArgs {
  wallet: TWallet;
  to: string;
  amount: bigint;          // raw native units (wei / lamports / etc.)
  chain: ChainConfig;
}

export interface WalletKitAdapter {
  readonly namespace: Namespace;

  // ── Wallet creation & validation ───────────────────────────────────
  validateAddress(address: string): boolean;
  validatePrivateKey(privateKey: string): boolean;
  validateMnemonic(mnemonic: string): boolean;
  createWalletFromPrivateKey(pk: string, name?: string): Promise<TWallet | null>;
  createWalletFromMnemonic(mnemonic: string, name?: string): Promise<TWallet | null>;
  generateMnemonic(strength?: 128 | 256): string;

  // ── Keys & signers (delegates to walletService dwell sites) ────────
  getSignerForWallet(w: TWallet): Promise<unknown | null>;

  // ── Reads ──────────────────────────────────────────────────────────
  getNativeBalance(address: string, chain: ChainConfig): Promise<bigint>;

  // ── Writes ─────────────────────────────────────────────────────────
  sendNativeTransfer(args: NativeTransferArgs): Promise<string>;        // returns tx hash / signature
  estimateMaxTransferable(args: { balance: bigint; chain: ChainConfig; to?: string; from: string }): Promise<bigint>;

  // ── Display ────────────────────────────────────────────────────────
  formatNativeAmount(raw: bigint, chain: ChainConfig): string;          // "0.0123 ETH" / "0.0123 SOL"
  parseNativeAmount(human: string, chain: ChainConfig): bigint;
  truncateAddress(address: string, opts?: { start?: number; end?: number }): string;

  // ── Optional capability checks ─────────────────────────────────────
  supportsTokenTransfer?(chain: ChainConfig): boolean;                  // false for Solana in v2.3.0
  supportsPrivateKeyImport?(): boolean;                                 // true by default; future MPC/HW-only chains return false
  displayName?(): string;                                               // "Ethereum", "Solana" — for UI pickers
  iconUrl?(): string | undefined;                                       // chain icon for pickers
}
```

```ts
// services/walletKit/registry.ts
import type { Namespace } from "@/services/chains/types";
import type { WalletKitAdapter } from "./types";

class WalletKitRegistryImpl {
  private kits = new Map<Namespace, WalletKitAdapter>();
  register(kit: WalletKitAdapter): void { this.kits.set(kit.namespace, kit); }
  get(ns: Namespace): WalletKitAdapter {
    const kit = this.kits.get(ns);
    if (!kit) throw new Error(`No WalletKit registered for namespace "${ns}"`);
    return kit;
  }
  has(ns: Namespace): boolean { return this.kits.has(ns); }
  getAll(): readonly WalletKitAdapter[] { return [...this.kits.values()]; }
  // Iteration is insertion-ordered (Map spec) — EVM registers first, Solana second,
  // so UI pickers render them in a stable, predictable order without explicit sorting.
}
export const walletKitRegistry = new WalletKitRegistryImpl();
```

Two implementations land in v2.3.0:

- **`EvmWalletKit`** (`services/walletKit/evm/EvmWalletKit.ts`) — wraps the *existing* viem code paths (`getPublicClient`, `walletClient.sendTransaction`, `parseUnits`, `formatUnits`, `isAddress`, `walletService.getAccountForWallet`, the existing creators in `utils/walletUtils.ts`). **No EVM behavior changes** — this is a pure relocation behind an interface.
- **`SolanaWalletKit`** (`services/walletKit/solana/SolanaWalletKit.ts`) — delegates to the new `services/chains/solana/{transferService,derivation,codec}.ts` modules and `walletService.getSolanaSignerForWallet`.

Registration happens once at boot in `app/_layout.tsx` (right after `pollyfills.ts`):

```ts
walletKitRegistry.register(createEvmWalletKit());
walletKitRegistry.register(createSolanaWalletKit());
```

Adding Sui/Bitcoin/Cosmos later is one new file + one register call — zero edits to `app/`.

---

## 5. Dependencies

| Package | Version pin | Purpose |
|---|---|---|
| `@solana/kit` | latest v2.x | Core Solana SDK. |
| `@solana-program/system` | latest | `getTransferSolInstruction`. |
| `@solana/webcrypto-ed25519-polyfill` | latest | Hermes Ed25519 support. |
| `ed25519-hd-key` | latest | SLIP-0010 derivation from BIP-39 seed. |
| `bs58` | latest | Base58 codec (private-key import, signature encoding). |

`@scure/bip39` is already in the dependency graph (pulled in by viem's account utilities) — reused for `mnemonicToSeedSync`.

Existing deps stay. Viem is not removed.

---

## 6. API / file surface

### 6.1 New files

**Wallet Kit docking port (the new pattern):**

| Path | Exports | Responsibility |
|---|---|---|
| `services/walletKit/types.ts` | `WalletKitAdapter`, `NativeTransferArgs` | Interface every namespace implements. |
| `services/walletKit/registry.ts` | `walletKitRegistry` | Resolves a `WalletKitAdapter` by `Namespace`; `getAll()` for UI pickers. |
| `services/walletKit/evm/EvmWalletKit.ts` | `createEvmWalletKit()` | Wraps existing viem code paths behind the kit interface. **Zero EVM behavior change** — pure relocation. |
| `services/walletKit/solana/SolanaWalletKit.ts` | `createSolanaWalletKit()` | Implements the kit for Solana via the modules below. |
| `services/walletKit/boot.ts` | `bootWalletKits()` | Registers EVM + Solana kits at app start. Called from `app/_layout.tsx`. |
| `services/walletKit/deriveAll.ts` | `deriveWalletsFromMnemonic(mnemonic, namespaces, nameFor?)` | Shared helper: loops over kits, calls `createWalletFromMnemonic`, returns a wallet-per-namespace array. Powers both auto-mint (§14.3) and multi-chain seed-phrase import (§14.5). |
| `services/walletKit/registry.test.ts` | — | Registry resolves by namespace, throws clearly when missing; `getAll()` returns insertion-ordered kits. |
| `services/walletKit/evm/EvmWalletKit.test.ts` | — | EVM kit round-trip mirrors current send-tsx behavior. |
| `services/walletKit/solana/SolanaWalletKit.test.ts` | — | Solana kit round-trip: create → balance → send → signature returned. |
| `services/walletKit/deriveAll.test.ts` | — | One mnemonic → N wallets; all share `seedPhrase`; addresses match per-kit golden vectors. |

**Wallet-management sheets (replace the deleted routes — see §14):**

| Path | Exports | Responsibility |
|---|---|---|
| `components/wallet/create/AddWalletSheet.tsx` | `AddWalletSheet` | Bottom sheet opened from `wallet.tsx` "+" button. Top-level picker: *Create new* / *Import seed phrase* / *Import private key*. Dispatches to one of the three sheets below. |
| `components/wallet/create/CreateWalletSheet.tsx` | `CreateWalletSheet` | Generate mnemonic → verify-words step (relocated from `components/login/WalletSetup.tsx`) → multi-chain derive via `deriveWalletsFromMnemonic`. Namespace multi-select defaults to all registered kits. |
| `components/wallet/create/ImportSeedPhraseSheet.tsx` | `ImportSeedPhraseSheet` | Paste + BIP-39 validate → namespace multi-select (checkboxes from `walletKitRegistry.getAll()`) → `deriveWalletsFromMnemonic(mnemonic, selectedNamespaces)`. |
| `components/wallet/create/ImportPrivateKeySheet.tsx` | `ImportPrivateKeySheet` | **Step 1 — pick chain** (namespace cards filtered by `kit.supportsPrivateKeyImport?.() !== false`, pre-highlighted by `inferNamespaceFromKey` if the user pastes first). **Step 2 — paste + `kit.validatePrivateKey`**. **Step 3 — `kit.createWalletFromPrivateKey`**. One key → one wallet on one chain; never cross-derives. Footer links to `ImportSeedPhraseSheet` for users who want multi-chain. |
| `components/wallet/create/inferNamespaceFromKey.ts` | `inferNamespaceFromKey(s): Namespace \| null` | Format heuristic for paste-first UX — EVM 64-hex, Solana 87-88-base58. Soft hint only, never bypasses the picker. |
| `components/wallet/create/NamespacePicker.tsx` | `NamespacePicker` | Reusable single- or multi-select picker driven by `walletKitRegistry.getAll()`. Uses `kit.displayName()` / `kit.iconUrl()` for labels. |
| `components/wallet/create/AddWalletSheet.test.tsx` (and per-sheet tests) | — | Snapshot + interaction tests for the three flows. |

**Solana primitives (consumed by `SolanaWalletKit` and the bridge signer):**

| Path | Exports | Responsibility |
|---|---|---|
| `services/chains/solana/derivation.ts` | `mnemonicToSolanaPrivateKey(mnemonic, path?)` | BIP-39 seed → SLIP-0010 ed25519 32-byte seed → kit-consumable private-key bytes. Default path `m/44'/501'/0'/0'`. |
| `services/chains/solana/codec.ts` | `base58ToBytes`, `bytesToBase58`, `base64ToTransaction`, `transactionToBase64` | Encoding glue between `TWallet.privateKey` / `SolanaSignTxPayload.transaction` and kit. |
| `services/chains/solana/transferService.ts` | `getSolanaBalance`, `getSolanaRentExemption`, `buildAndSendSolTransfer` | Thin facade over kit's send-a-transaction flow. |
| `services/chains/solana/signer.ts` | `installSolanaSigner(deps)` | Wires `registerSolanaSigner({...})` for the dApp bridge. Called from `services/bridge/boot.ts`. |
| `services/chains/solana/transferService.test.ts` | — | Fixture-based round-trip: given private key bytes + blockhash, produce signature; assert against vector. |
| `services/chains/solana/derivation.test.ts` | — | Known Phantom mnemonic → known base58 address (golden vector). |

### 6.2 Modified files

| Path | Change |
|---|---|
| `package.json` | Add deps from §5. |
| `pollyfills.ts` | Import `@solana/webcrypto-ed25519-polyfill` after `react-native-get-random-values`. Add boot self-check for `subtle.generateKey({name:'Ed25519'}, …)` under TWV-2026-070. |
| `constants/types/walletTypes.ts` | Add `TSolanaFields`, `solana?` on `TWallet`, widen `TWalletCreationParams.source`. |
| `constants/configs/chainConfig.ts` | Widen `ChainConfig` to discriminated union, add Solana entries. |
| `utils/walletUtils.ts` | Add `isValidSolanaAddress`, `isValidSolanaPrivateKey`, `createSolanaWalletFromPrivateKey`, `createSolanaWalletFromMnemonic`. **No new branching in `createWalletFromParams`** — it now resolves a kit via `walletKitRegistry.get(namespaceFromSource(params.source))` and delegates to `kit.createWalletFromMnemonic` / `createWalletFromPrivateKey`. Existing EVM helpers stay (consumed by `EvmWalletKit`). |
| `services/walletService.ts` | Add `getSolanaSignerForWallet` behind TWV-2026-070 header; add `solanaSignerCache` parallel to `accountCache`; extend `clearAccountCache` to wipe it. **Same dwell-site discipline; no new branching in callers.** |
| `hooks/useWallet.ts` | Add `getActiveWalletKit()` / `getKitForWallet(w)` helpers that return the registered `WalletKitAdapter`. Existing `getClientForActiveWallet` / `getPublicClientForActiveChain` are kept (legacy EVM-typed callers) but become thin wrappers over `EvmWalletKit` internals; both early-return `null` when the active namespace isn't `"eip155"`. `changeActiveChainInternal` branches on `blockchain.namespace` to build the right `ChainConfig` variant — the only allowed namespace `if` in this layer because it's mapping backend rows to the union, not dispatching behavior. |
| `app/send.tsx` | **No `if (namespace === "solana")` branches.** Resolves `kit = getActiveWalletKit()` once at the top, then calls `kit.getNativeBalance`, `kit.sendNativeTransfer`, `kit.estimateMaxTransferable`, `kit.parseNativeAmount`, `kit.formatNativeAmount`, `kit.validateAddress` uniformly. EVM and Solana paths look identical at this layer. |
| `app/wallet.tsx` + `components/wallet/WalletDetails.tsx` + `components/wallet/WalletCard.tsx` | Balance fetch via `kit.getNativeBalance`; symbol via `kit.formatNativeAmount(balance, activeChain)`. No namespace branches. |
| ~~`app/wallet-setup.tsx`~~, ~~`app/import-seed-phrase.tsx`~~, ~~`app/import-private-key.tsx`~~ | **Deleted (§14).** Replaced by `components/wallet/create/*Sheet.tsx` modals mounted from `wallet.tsx`. Their user-visible logic (generate → verify-words, paste → validate → create) is preserved inside the sheets. |
| `app/login.tsx` | **Simplified (§14.1):** strip the "GET STARTED" card's *Create New Wallet* button and the entire "IMPORT EXISTING WALLET" card. **Keep the *Continue with Google* button as-is** — the handler is a placeholder demo today and will be wired to real auth in a future session; this spec does not change its behavior. Wrap its success path so that on completion, if `wallets.length === 0`, the §14.3 bootstrap runs before `router.replace("/")` resolves. |
| `app/wallet.tsx` | **Wallet-management hub (§14.4):** "+" header button opens `AddWalletSheet` instead of `router.push("/login")`. Empty state (zero wallets) shows an inline "Add wallet" CTA with the same sheet. `WalletSwitcherModal.onAddWallet` also opens the sheet. Remove the `if (wallets.length === 0) router.replace("/login")` redirect. |
| `components/wallet/WalletSwitcherModal.tsx` | `onAddWallet` prop now opens `AddWalletSheet` (prop wiring change only). |
| ~~`components/login/WalletSetup.tsx`~~ | **Folded into `CreateWalletSheet`.** Delete the standalone component; move the verify-words step + mnemonic-reveal UI into the sheet. |
| `components/common/ChainSelector.tsx` | Group by namespace in the picker; respect existing agent-busy gate via `changeActiveChain`. |
| `services/bridge/boot.ts` | Call `installSolanaSigner({...})` after `createSolanaAdapter()`. The signer impl pulls its underlying `KeyPairSigner` via `walletKitRegistry.get("solana").getSignerForWallet(w)` so the bridge and the mobile UI go through the same kit. |
| `app/_layout.tsx` | Call `bootWalletKits()` once, after `pollyfills.ts` is imported and before any wallet-touching screen mounts. |
| `services/indexer/registry.ts` / `services/indexer/DirectRPCProvider.ts` | **No change this spec.** When a `getTokenBalances` call fires for a Solana chainId, the current RPC provider throws `IndexerNotSupportedError` and the registry returns empty — acceptable for v2.3.0. |

---

## 7. Detailed implementation

### 7.1 Polyfills (TWV-2026-070)

```ts
// pollyfills.ts — additions
import "react-native-get-random-values";              // existing (TWV-2026-002)
import "fastestsmallesttextencoderdecoder";           // existing
import "@solana/webcrypto-ed25519-polyfill";          // NEW — must precede any kit import

// TWV-2026-070 self-check — Ed25519 must be usable.
(async () => {
  try {
    await crypto.subtle.generateKey(
      { name: "Ed25519" } as unknown as EcKeyGenParams,
      false,
      ["sign", "verify"],
    );
  } catch (e) {
    throw new Error(
      "TWV-2026-070: Ed25519 unavailable at boot — polyfill did not install. " +
        "Verify `@solana/webcrypto-ed25519-polyfill` import order in pollyfills.ts.",
    );
  }
})();
```

Rationale for fail-loud: a missing polyfill means Solana key generation silently falls through to a non-Ed25519 path or throws at sign time — either way an incident. Mirrors the TWV-2026-002 pattern.

### 7.2 Derivation (`services/chains/solana/derivation.ts`)

```ts
import { mnemonicToSeedSync } from "@scure/bip39";
import { derivePath } from "ed25519-hd-key";

export const DEFAULT_SOLANA_PATH = "m/44'/501'/0'/0'";

export function mnemonicToSolanaPrivateKey(
  mnemonic: string,
  path: string = DEFAULT_SOLANA_PATH,
): Uint8Array {
  const seed = mnemonicToSeedSync(mnemonic);                                  // 64-byte
  const { key } = derivePath(path, Buffer.from(seed).toString("hex"));
  return new Uint8Array(key);                                                 // 32-byte ed25519 seed
}
```

### 7.3 Wallet creation (`utils/walletUtils.ts`)

```ts
export async function createSolanaWalletFromPrivateKey(
  base58OrHex: string,
  name?: string,
): Promise<TWallet | null> {
  const bytes = parseSolanaPrivateKey(base58OrHex);                           // 32 or 64 bytes → 32-byte seed
  if (!bytes) return null;
  const kp = await createKeyPairFromPrivateKeyBytes(bytes, { extractable: false });
  const addr = await getAddressFromPublicKey(kp.publicKey);
  return {
    account: { address: addr },
    address: addr,
    privateKey: bytesToBase58(bytes),
    name: name || "Solana Wallet",
    balance: "0",
    source: "Imported",
    type: "PrivateKey",
    namespace: "solana",
    solana: { pubkeyBase58: addr },
  };
}

export async function createSolanaWalletFromMnemonic(
  mnemonic: string,
  name?: string,
): Promise<TWallet | null> {
  const bytes = mnemonicToSolanaPrivateKey(mnemonic);
  const kp = await createKeyPairFromPrivateKeyBytes(bytes, { extractable: false });
  const addr = await getAddressFromPublicKey(kp.publicKey);
  return {
    account: { address: addr },
    address: addr,
    seedPhrase: mnemonic,
    name: name || "Solana Wallet",
    balance: "0",
    source: "Created",
    type: "SeedPhrase",
    namespace: "solana",
    solana: { pubkeyBase58: addr, derivationPath: DEFAULT_SOLANA_PATH },
  };
}
```

`createWalletFromParams` dispatches on `source` before returning:

```ts
if (params.source === "SolanaPrivateKey" && params.privateKey)
  return createSolanaWalletFromPrivateKey(params.privateKey, params.name);
if (params.source === "SolanaSeedPhrase" && params.seedPhrase)
  return createSolanaWalletFromMnemonic(params.seedPhrase, params.name);
```

Note: the function becomes `async`. All call sites (`useWallet.addWallet`) already `await` it inside `deferredTask`, so this is a type-only change.

### 7.4 Wallet signer (`services/walletService.ts`) — TWV-2026-070

```ts
// Review gate — TWV-2026-070 (Ed25519 signer dwell + polyfill).
// Design note: docs/wallet-security-task/NN_solana_signer_design_note.md.
//
// This function is the SINGLE blessed JS-heap dwell site for Solana
// private-key material, analogous to getAccountForWallet for EVM.
// Invariants:
//   - 32-byte seed reconstructed only here; immediately fed to
//     createKeyPairFromPrivateKeyBytes(bytes, { extractable: false }).
//   - The resulting CryptoKey is NOT extractable — the public surface
//     of KeyPairSigner cannot leak the private half.
//   - Cache by address in solanaSignerCache; clearAccountCache wipes
//     both caches on lock/logout/removal.
//   - Never log signer internals. No console.log of `bytes` or `kp`.
// Any PR that:
//   - adds a new createKeyPairFromPrivateKeyBytes call outside here,
//   - returns the raw Uint8Array seed from a public helper,
//   - extends solanaSignerCache dwell,
// MUST cite TWV-2026-070.

const solanaSignerCache: Record<string, KeyPairSigner> = {};

export async function getSolanaSignerForWallet(
  wallet: TWallet,
): Promise<KeyPairSigner | null> {
  if (wallet.namespace !== "solana") return null;
  const cached = solanaSignerCache[wallet.address];
  if (cached) return cached;

  try {
    let bytes: Uint8Array | null = null;
    if (wallet.type === "PrivateKey" && wallet.privateKey) {
      bytes = base58ToBytes(wallet.privateKey);
      if (bytes.length === 64) bytes = bytes.slice(0, 32); // strip public-half
    } else if (wallet.type === "SeedPhrase" && wallet.seedPhrase) {
      bytes = mnemonicToSolanaPrivateKey(wallet.seedPhrase);
    }
    if (!bytes) return null;

    const kp = await createKeyPairFromPrivateKeyBytes(bytes, { extractable: false });
    const signer = await createSignerFromKeyPair(kp);
    solanaSignerCache[wallet.address] = signer;
    return signer;
  } catch (e) {
    if (__DEV__) console.error("[walletService] Solana signer create failed");
    return null;
  }
}
```

Extend `clearAccountCache`:

```ts
export function clearAccountCache(): void {
  Object.keys(accountCache).forEach((k) => delete accountCache[k]);
  Object.keys(solanaSignerCache).forEach((k) => delete solanaSignerCache[k]);
}
```

### 7.5 `useWallet` additions

The hook surfaces the kit to consumers; it does **not** branch on namespace itself.

```ts
import { walletKitRegistry } from "@/services/walletKit/registry";
import type { WalletKitAdapter } from "@/services/walletKit/types";

const getActiveWalletKit = useCallback((): WalletKitAdapter => {
  return walletKitRegistry.get(activeWallet.namespace);
}, [activeWallet.namespace]);

const getKitForWallet = useCallback((w: TWallet): WalletKitAdapter => {
  return walletKitRegistry.get(w.namespace);
}, []);
```

Existing `getClientForActiveWallet` / `getPublicClientForActiveChain` stay as legacy convenience for callers that already have viem-typed code. They early-return `null` when the active chain isn't EVM:

```ts
if (activeChain.namespace !== "eip155") return null;
```

This is *not* dispatch logic — it's a guard so legacy viem-typed callers don't get a confused chain object. New callers should reach for `getActiveWalletKit()` instead.

`changeActiveChainInternal` is the one place a namespace `if` is unavoidable, because it's translating backend `Blockchain` rows into the `ChainConfig` discriminated union — that's data shape, not behavior dispatch:

```ts
const apiChain: ChainConfig =
  blockchain.namespace === "solana"
    ? {
        namespace: "solana",
        cluster: blockchain.name.toLowerCase().includes("devnet")
          ? "devnet"
          : "mainnet-beta",
        rpcUrl: blockchain.rpcUrl,
        iconUrl: blockchain.tokens?.[0]?.logoUrl,
        isTestnet: blockchain.name.toLowerCase().includes("devnet"),
      }
    : {
        namespace: "eip155",
        chain: { /* existing viem chain build */ },
        iconUrl: blockchain.tokens?.[0]?.logoUrl,
        isTestnet: /* existing testnet heuristic */,
      };
```

### 7.6 `SolanaWalletKit` (the kit implementation, plus its primitives)

Primitives stay focused — they don't know about `TWallet`, `ChainConfig`, or the registry. They just talk to `@solana/kit`.

```ts
// services/chains/solana/transferService.ts
export async function getSolanaBalance(
  rpc: SolanaRpc,
  address: string,
): Promise<bigint> {
  const { value } = await rpc.getBalance(address as Address).send();
  return BigInt(value);
}

export async function buildAndSendSolTransfer(args: {
  rpc: SolanaRpc;
  rpcSubs?: SolanaRpcSubscriptions;
  signer: KeyPairSigner;
  to: string;
  lamports: bigint;
}): Promise<Signature> {
  const { value: latestBlockhash } = await args.rpc.getLatestBlockhash().send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(args.signer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) =>
      appendTransactionMessageInstruction(
        getTransferSolInstruction({
          source: args.signer,
          destination: args.to as Address,
          amount: args.lamports,
        }),
        m,
      ),
  );
  const tx = await signTransactionMessageWithSigners(message);
  if (args.rpcSubs) {
    const send = sendAndConfirmTransactionFactory({
      rpc: args.rpc,
      rpcSubscriptions: args.rpcSubs,
    });
    await send(tx, { commitment: "confirmed" });
  } else {
    // Fallback: submit without confirmation subscription (public RPC rate-limited WS).
    await args.rpc.sendTransaction(getBase64EncodedWireTransaction(tx)).send();
  }
  return getSignatureFromTransaction(tx);
}
```

The kit wires those primitives into the `WalletKitAdapter` shape:

```ts
// services/walletKit/solana/SolanaWalletKit.ts
import { createSolanaRpc } from "@solana/kit";
import {
  buildAndSendSolTransfer,
  getSolanaBalance,
} from "@/services/chains/solana/transferService";
import {
  createSolanaWalletFromMnemonic,
  createSolanaWalletFromPrivateKey,
  isValidSolanaAddress,
  isValidSolanaPrivateKey,
} from "@/utils/walletUtils";
import { getSolanaSignerForWallet, generateWalletMnemonic } from "@/services/walletService";
import { validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import type { WalletKitAdapter, NativeTransferArgs } from "../types";

const FEE_RESERVE_LAMPORTS = 5_000n + 890_880n; // signature fee + rent-exempt buffer
const LAMPORTS_PER_SOL = 1_000_000_000n;

export function createSolanaWalletKit(): WalletKitAdapter {
  return {
    namespace: "solana",

    validateAddress: isValidSolanaAddress,
    validatePrivateKey: isValidSolanaPrivateKey,
    validateMnemonic: (m) => validateMnemonic(m.trim(), wordlist),
    createWalletFromPrivateKey: createSolanaWalletFromPrivateKey,
    createWalletFromMnemonic: createSolanaWalletFromMnemonic,
    generateMnemonic: generateWalletMnemonic,    // BIP-39 is shared; only derivation differs.

    getSignerForWallet: getSolanaSignerForWallet,

    async getNativeBalance(address, chain) {
      if (chain.namespace !== "solana") throw new Error("expected solana chain");
      return getSolanaBalance(createSolanaRpc(chain.rpcUrl), address);
    },

    async sendNativeTransfer({ wallet, to, amount, chain }: NativeTransferArgs) {
      if (chain.namespace !== "solana") throw new Error("expected solana chain");
      const signer = await getSolanaSignerForWallet(wallet);
      if (!signer) throw new Error("No Solana signer");
      const sig = await buildAndSendSolTransfer({
        rpc: createSolanaRpc(chain.rpcUrl),
        signer,
        to,
        lamports: amount,
      });
      return String(sig);
    },

    async estimateMaxTransferable({ balance }) {
      return balance > FEE_RESERVE_LAMPORTS ? balance - FEE_RESERVE_LAMPORTS : 0n;
    },

    formatNativeAmount(raw, _chain) {
      const sol = Number(raw) / Number(LAMPORTS_PER_SOL);
      return `${sol.toFixed(4)} SOL`;
    },
    parseNativeAmount(human, _chain) {
      return BigInt(Math.round(parseFloat(human) * Number(LAMPORTS_PER_SOL)));
    },
    truncateAddress: (address, opts) =>
      `${address.slice(0, opts?.start ?? 4)}…${address.slice(-(opts?.end ?? 4))}`,

    supportsTokenTransfer: () => false,           // SPL deferred to F6.
  };
}
```

`EvmWalletKit` is the analogous wrapper around the existing viem code — it's a no-behavior-change relocation, so the spec doesn't reproduce it in full. Skeleton:

```ts
// services/walletKit/evm/EvmWalletKit.ts
export function createEvmWalletKit(): WalletKitAdapter {
  return {
    namespace: "eip155",
    validateAddress: isAddress,                          // viem
    validatePrivateKey,                                  // utils/walletUtils.ts
    validateMnemonic: isValidMnemonic,                   // utils/walletUtils.ts
    createWalletFromPrivateKey: async (pk, name) =>
      createWalletFromPrivateKey(pk, name),              // utils/walletUtils.ts
    createWalletFromMnemonic: async (m, name) =>
      createWalletFromMnemonic(m, name),                 // utils/walletUtils.ts
    generateMnemonic: generateWalletMnemonic,            // walletService
    getSignerForWallet: async (w) => getAccountForWallet(w),

    async getNativeBalance(address, chain) {
      if (chain.namespace !== "eip155") throw new Error("expected evm chain");
      return getPublicClient(chain.chain).getBalance({ address: address as `0x${string}` });
    },
    async sendNativeTransfer({ wallet, to, amount, chain }) {
      if (chain.namespace !== "eip155") throw new Error("expected evm chain");
      const account = getAccountForWallet(wallet);
      if (!account) throw new Error("No EVM account");
      const client = getWalletClient(account as Account, chain.chain);
      return client.sendTransaction({
        account: client.account!,
        to: to as `0x${string}`,
        value: amount,
        chain: client.chain,
      });
    },
    async estimateMaxTransferable({ balance, chain, from, to }) {
      if (chain.namespace !== "eip155") throw new Error("expected evm chain");
      const pc = getPublicClient(chain.chain);
      const gas = await pc.estimateGas({
        account: from as `0x${string}`,
        to: (to ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
        value: balance,
      });
      const gasPrice = await pc.getGasPrice();
      const cost = (gas * 110n / 100n) * gasPrice;       // 10% buffer
      return balance > cost ? balance - cost : 0n;
    },

    formatNativeAmount(raw, chain) {
      if (chain.namespace !== "eip155") throw new Error("expected evm chain");
      return `${parseFloat(formatUnits(raw, chain.chain.nativeCurrency.decimals)).toFixed(4)} ${chain.chain.nativeCurrency.symbol}`;
    },
    parseNativeAmount(human, chain) {
      if (chain.namespace !== "eip155") throw new Error("expected evm chain");
      return parseUnits(human, chain.chain.nativeCurrency.decimals);
    },
    truncateAddress: (address, opts) => truncateAddress({ address, startLength: opts?.start, endLength: opts?.end }),

    supportsTokenTransfer: () => true,
  };
}
```

### 7.7 `send.tsx` (no namespace branches)

Resolve the kit once, then call uniformly:

```ts
const kit = getActiveWalletKit();

const fetchBalance = useCallback(async () => {
  if (!activeWallet?.address) return;
  setIsLoadingBalance(true);
  try {
    const bal = await kit.getNativeBalance(activeWallet.address, activeChain);
    setBalance(bal);
  } catch (e) { console.error(e); }
  finally { setIsLoadingBalance(false); }
}, [kit, activeWallet?.address, activeChain]);

const handleMaxAmount = useCallback(async () => {
  if (!activeWallet?.address) return;
  const max = await kit.estimateMaxTransferable({
    balance, chain: activeChain, from: activeWallet.address, to: recipient,
  });
  setAmount(kit.formatNativeAmount(max, activeChain).split(" ")[0]); // strip symbol
}, [kit, activeWallet?.address, balance, activeChain, recipient]);

const validateInputs = useCallback(() => {
  if (!recipient || !kit.validateAddress(recipient)) {
    console.error("invalid recipient"); return false;
  }
  const raw = kit.parseNativeAmount(amount, activeChain);
  if (raw <= 0n || raw > balance) {
    console.error("invalid amount"); return false;
  }
  return true;
}, [kit, recipient, amount, activeChain, balance]);

const handlePinConfirm = async (_pin: string) => {
  setIsPinModalVisible(false);
  setIsLoading(true);
  try {
    const raw = kit.parseNativeAmount(amount, activeChain);
    const txOrSig = await kit.sendNativeTransfer({
      wallet: activeWallet,
      to: recipient,
      amount: raw,
      chain: activeChain,
    });
    // History recording (EVM-only today; Solana branch deferred per §13 Q4).
    if (activeChain.namespace === "eip155" && isAuthenticated && activeWallet?.address) {
      await createTransaction({
        type: "TRANSFER",
        amount: raw.toString(),
        txHash: txOrSig as `0x${string}`,
        fromAddress: activeWallet.address,
        toAddress: recipient,
        // …native vs token id handling unchanged…
      } as any);
    }
    router.back();
  } catch (e) { console.error(e); }
  finally { setIsLoading(false); }
};
```

The history-recording line is the **only** place `send.tsx` still mentions a namespace, and it's about backend-API shape (Q4 in §13), not signing dispatch.

Display branches in the JSX (e.g. balance pill, MAX button copy) become symbol-agnostic by reading from `kit.formatNativeAmount(balance, activeChain)`.

### 7.8 DApp-bridge signer wire-up

The bridge's `SolanaAdapter` is already a `ChainAdapter` (its own docking port). `installSolanaSigner` reaches for the **same** `SolanaWalletKit` the mobile UI uses, so bridge and UI paths never diverge.

`services/chains/solana/signer.ts`:

```ts
import { walletKitRegistry } from "@/services/walletKit/registry";

export function installSolanaSigner(deps: {
  getWalletByAddress: (addr: string) => TWallet | null;
  getRpcForCluster: (c: SolanaCluster) => { rpc: SolanaRpc; rpcSubs?: SolanaRpcSubscriptions };
}): void {
  const kit = walletKitRegistry.get("solana");                // single source of truth
  registerSolanaSigner({
    signMessage: async (address, message) => {
      const wallet = deps.getWalletByAddress(address);
      if (!wallet) throw new Error("Wallet not found");
      const signer = (await kit.getSignerForWallet(wallet)) as KeyPairSigner | null;
      if (!signer) throw new Error("No signer");
      const bytes = typeof message === "string" ? new TextEncoder().encode(message) : message;
      const [sig] = await signer.signMessages([{ content: bytes, signatures: {} }]);
      return bytesToBase58(sig[signer.address] ?? new Uint8Array());
    },
    signTransaction: async (address, txBase64) => {
      const wallet = deps.getWalletByAddress(address);
      if (!wallet) throw new Error("Wallet not found");
      const signer = (await kit.getSignerForWallet(wallet)) as KeyPairSigner | null;
      if (!signer) throw new Error("No signer");
      const tx = decodeTransactionFromBase64(txBase64);
      const [signed] = await signer.signTransactions([tx]);
      return encodeTransactionToBase64(signed);
    },
    signAndSendTransaction: async (address, txBase64, cluster) => {
      const wallet = deps.getWalletByAddress(address);
      if (!wallet) throw new Error("Wallet not found");
      const signer = (await kit.getSignerForWallet(wallet)) as KeyPairSigner | null;
      if (!signer) throw new Error("No signer");
      const { rpc, rpcSubs } = deps.getRpcForCluster(cluster as SolanaCluster);
      const tx = decodeTransactionFromBase64(txBase64);
      const [signed] = await signer.signTransactions([tx]);
      if (rpcSubs) {
        const send = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions: rpcSubs });
        await send(signed, { commitment: "confirmed" });
      } else {
        await rpc.sendTransaction(getBase64EncodedWireTransaction(signed)).send();
      }
      return getSignatureFromTransaction(signed);
    },
  });
}
```

Call from `services/bridge/boot.ts` after `createSolanaAdapter()`:

```ts
installSolanaSigner({
  getWalletByAddress: (addr) =>
    opts.getContext().wallets.find((w) => w.address === addr) ?? null,
  getRpcForCluster: (cluster) => {
    const url = cluster === "devnet"
      ? process.env.EXPO_PUBLIC_SOLANA_DEVNET_RPC ?? "https://api.devnet.solana.com"
      : process.env.EXPO_PUBLIC_SOLANA_MAINNET_RPC ?? "https://api.mainnet-beta.solana.com";
    return { rpc: createSolanaRpc(url) };
  },
});
```

---

## 8. Security considerations

| Concern | Mitigation |
|---|---|
| Ed25519 key leaks via extractable `CryptoKey` | `createKeyPairFromPrivateKeyBytes(bytes, { extractable: false })` — enforced in the single dwell site. |
| Raw seed `Uint8Array` dwelling after signer creation | Local variable inside `getSolanaSignerForWallet`; no reference returned. Pattern matches EVM (viem's `mnemonicToAccount` closure). |
| Polyfill not loaded | TWV-2026-070 boot self-check throws loud. |
| `Math.random` / non-CSPRNG on a key path | Kit's `generateKeyPair` delegates to WebCrypto which uses the OS CSPRNG via the polyfill — same source as `react-native-get-random-values`. No `Math.random` introduced in any new file. |
| Bundle-mode invariant violated | Solana fields ride inside `TWallet` in the same JSON bundle. No new secure-store key is created. Rehydration path unchanged. |
| Agent busy-state bypass on Solana chain switch | `changeActiveChain` / `setActiveWallet` are namespace-agnostic — the two-tier gate applies uniformly. Validated in verification step 7. |
| DApp-bridge address confusion (EVM address used as Solana recipient) | `SolanaAdapter.handleRequest` filters `ctx.wallets.find(w => w.namespace === "solana")`; if no Solana wallet exists, returns error code 4100. No cross-namespace fallthrough. |
| Replay of dApp-supplied transaction with attacker-controlled recipient | `SolanaTransactionSheet` already renders cluster + address + first 120 chars of the base64 tx. In v2.3.0 we do **not** add decode-and-render of instructions; that's future hardening F3. |

New review-gate doc to add: `docs/wallet-security-task/NN_solana_signer_design_note.md` — describes TWV-2026-070 in the style of the existing `62_native_signing_design_note.md`.

---

## 9. Testing

### 9.1 Unit tests

- `services/chains/solana/derivation.test.ts` — golden vector (Phantom mnemonic `abandon abandon abandon … about` + default path → known base58 address).
- `services/chains/solana/transferService.test.ts` — mock `rpc.getLatestBlockhash()`, assert the signed transaction's fee payer equals signer address, signature length is 64 bytes, the transfer instruction's lamports field round-trips.
- `services/walletService.test.ts` (extend) — `getSolanaSignerForWallet` returns `null` for EVM wallets, returns a signer whose address equals `wallet.address` for Solana wallets, `clearAccountCache` wipes the Solana cache.
- `utils/walletUtils.test.ts` — validators accept Phantom's 64-byte base58, reject 0x-hex and truncated strings.
- `services/chains/solana/SolanaAdapter.test.ts` (extend) — after `installSolanaSigner` with a mock signer, `executeApproval(signMessage, ..., approve)` returns the expected base58 signature; without `installSolanaSigner`, returns `code: -32603 "No Solana signer registered"`.

### 9.2 Type-check

`pnpm check:syntax` must pass. The `ChainConfig` widening is the main risk; every `activeChain.chain.*` access becomes conditional. Use `if (activeChain.namespace === "eip155")` narrowing instead of optional chaining to keep types sharp.

### 9.3 Manual verification (devnet)

1. Fresh install → `pollyfills.ts` boots without the TWV-2026-070 throw in Metro logs.
2. Wallet setup: toggle Solana, create 12-word mnemonic, confirm a 32–44-char base58 address displays in `wallet.tsx`.
3. `deposit.tsx` QR scans cleanly into Phantom.
4. Devnet faucet to the address; balance appears in `wallet.tsx` within one refresh.
5. `send.tsx` → devnet recipient → 0.01 SOL → PIN confirm → tx lands on Solana Explorer devnet within 5–10s.
6. `send.tsx` MAX → resulting amount equals `balance - 895880` lamports (or constant used), never exceeds balance.
7. Switch active chain mainnet-beta ↔ devnet ↔ EVM during an agent turn — existing agent-busy gate fires, "Cancel task & switch" works.
8. Import a Phantom-exported private key via `import-private-key.tsx`; resulting address matches what Phantom shows.
9. Import a Phantom mnemonic via `import-seed-phrase.tsx`; address matches.
10. Cold-start + biometric unlock: both EVM and Solana wallets rehydrate under a single prompt (TWV-2026-060 invariant holds).
11. Remove a Solana wallet; `clearAccountCache` wipes `solanaSignerCache` (assert via re-signing after re-add produces a valid signature).
12. Open in-app browser, navigate to a devnet Solana dApp, call `window.solana.connect()` — `SolanaConnectSheet` renders, connect succeeds, pubkey returned to the page matches active Solana wallet.

### 9.4 Regression

`pnpm run test` — full suite. No EVM-facing test should change. The `services/chains/registry.test.ts` may assert on adapter count; confirm it still passes (adapter count unchanged — Solana adapter was already registered in boot).

---

## 10. Migration / rollout

No data migration required:

- Existing `TWallet` rows continue to satisfy the widened type (new fields are optional).
- `applyNamespaceBackfill` already stamps `"eip155"` on any legacy row without a namespace.
- `ChainConfig` union: the persisted `active_chain` entry always has `chain` (EVM-shaped) today. On first load after upgrade, the narrowing check `activeChain.namespace === "eip155"` passes because `applyNamespaceBackfill` runs on boot. For safety, `useWallet`'s default query function treats any persisted shape missing `namespace` as EVM by stamping `namespace: "eip155"` before returning.

Rollout is additive: Solana features appear when the user opts in via the namespace toggle in setup/import. Existing EVM users see no UI change until they surface a Solana wallet.

Version bump: **v2.3.0** (minor — additive feature, matches v2.1/v2.2 cadence).

---

## 11. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | `@solana/webcrypto-ed25519-polyfill` conflicts with Hermes' native crypto | medium | blocks feature | Boot self-check + integration test on both iOS + Android dev-client before merge. |
| R2 | Kit's bundle size bloats app startup | low | minor perf | Tree-shaking is built into Kit; measure via `expo export` size-diff. Budget: +250 KB JS. |
| R3 | Phantom-format private-key parsing ambiguity (64 vs 32 bytes) | low | import failure | `parseSolanaPrivateKey` accepts both, slices to 32 when given 64. Covered by validator tests. |
| R4 | `activeChain` union breaks a viem-typed call we missed | low | runtime error on EVM path | Dispatch goes through `WalletKitAdapter`; inline viem access is only allowed inside `EvmWalletKit`, which narrows to `namespace === "eip155"` at entry. `check:syntax` catches the rest. |
| R4b | `EvmWalletKit` relocation introduces behavior drift on the EVM path | medium | silent regression | Snapshot test: before the relocation, capture balance + send behavior against a fixture wallet; after, assert identical results. Code-review discipline — relocation PR is mechanical, no logic edits. |
| R4c | Adding a third namespace (Sui, Bitcoin) later forces re-opening screens because the `WalletKitAdapter` interface missed a method | medium | refactor churn | Spec'd interface covers the v2.3 surface. New chains that need more (e.g. Bitcoin UTXO selection) extend via optional capability methods (like `supportsTokenTransfer?`) rather than breaking the base contract. |
| R5 | DApp-bridge signer receives a `TWallet` whose signer cache was cleared (wallet removed mid-approval) | low | approval error | `getSolanaSignerForWallet` rebuilds on miss; non-issue. |
| R6 | Public Solana RPC rate limits during balance polling | medium | UX: stale balance | Short-term: accept. Follow-up F2 adds a cached provider with backoff, analog to `services/indexer/cache.ts`. |
| R7 | Indexer returns no Solana rows → `asset-explorer` / `activities` look empty for Solana wallets | high | UX gap | Document in-app ("Transaction history on Solana coming soon") until F1 lands. |

---

## 12. Future work (intentionally deferred)

- **F1.** Solana indexer provider (`services/indexer/SolanaProvider.ts`) — Helius / Alchemy / Triton RPC for balances, history, SPL, NFTs.
- **F2.** Cached Solana RPC client with rate-limit backoff analogous to `services/indexer/cache.ts`.
- **F3.** Decoded Solana transaction rendering in `SolanaTransactionSheet` — show instruction list, program IDs, token transfers. Phantom-equivalent clarity.
- **F4.** Full Wallet Standard v1.1 announcement in the injected script (currently a single custom event).
- **F5.** WalletConnect v2 Solana namespace negotiation in the session-builder.
- **F6.** SPL-token transfers in `send.tsx` — needs `@solana-program/token`, ATA creation on first send, user-visible fee disclosure.
- **F7.** ~~Unified-mnemonic model~~ — **partially in-scope for v2.3** (§14.3). A shared BIP-39 mnemonic is used by the bootstrap auto-mint and by multi-chain seed-phrase import, producing N `TWallet` rows that share `seedPhrase`. What remains deferred: a formal `derivationGroupId` field linking the rows, group-level operations (rename all, remove all, show shared backup phrase once), and a unified "this is one wallet, two addresses" presentation. Current model stays flat-row — the rows *happen* to share a seed, but the UI treats them as independent. |
- **F8.** SIWS ("Sign in with Solana") for backend auth (the TakumiPay API currently only knows SIWE-EVM).
- **F9.** Solana NFT rendering in `asset-explorer.tsx`.

---

## 13. Open questions

1. **Default cluster for new Solana wallets** — mainnet-beta or devnet? (Spec assumes mainnet-beta; devnet switchable via ChainSelector.)
2. **Backend `Blockchain` row for Solana** — is TakumiPay API going to return a Solana row from `useBlockchains()`, or do we ship mobile-only static entries in `supportedChains` for v2.3? (Spec assumes backend will catch up; fallback to static is already in `changeActiveChainInternal`.)
3. **Phantom-exported private keys vs. Solflare's JSON array format** — cover both in import, or Phantom-base58 only? (Spec ships Phantom-base58 only.)
4. **Transaction history recording** — should `createTransaction` calls for Solana sends be skipped until backend supports the namespace, or should we send with `namespace: "solana"` and let backend ignore? (Spec defers; see §7.7 comment.)
5. **Auto-mint default namespaces** (§14.3) — always derive all registered kits on first login, or show a chain multi-select before creating? Spec defaults to "derive all" (no prompt, land on home faster) with user able to remove the Solana wallet later from `wallet.tsx`. Flag here in case product prefers a one-time "What chains do you use?" sheet.
6. **Mnemonic backup gate** (§14.3) — must the user confirm the auto-mint mnemonic before they can sign a transaction, or is confirmation deferred to a persistent banner? Spec recommends a soft banner ("Back up your recovery phrase") that dismisses once the verify-words step is passed in settings; no hard gate on first send.

---

## 14. Simplified onboarding & wallet-management UX

### 14.1 Login is auth-only

`app/login.tsx` strips the wallet-related UI. The sole path forward is *Continue with Google*.

**The Google button stays as-is.** The `handleGoogleSignIn` handler today shows a placeholder alert (`Alert.alert("Google Sign-In Successful!", ...)`) — that behavior is preserved in this spec. Real auth wiring happens in a future session. We only change what happens *after* the handler resolves:

1. `googleSignIn.mutateAsync()` completes (placeholder alert or real auth — either way).
2. If `walletService.loadWalletsFromStorage()` returns zero wallets → run §14.3 bootstrap (auto-mint all registered kits from a single mnemonic) **before** navigation, so the home screen has something to render.
3. `router.replace("/")` — the tab root (`app/index.tsx`).

The "GET STARTED" card's *Create New Wallet* button is removed, and the entire "IMPORT EXISTING WALLET" card (Seed Phrase / Private Key buttons) is removed. Import flows move into `wallet.tsx` (§14.5, §14.6) where they belong — they're wallet-management actions, not authentication. A returning user with a fresh install who *only* has a private key (no mnemonic) can still get in: the auto-mint bootstrap gives them functional wallets, and they open `AddWalletSheet` → `ImportPrivateKeySheet` to bring their existing key in alongside.

### 14.2 Routes deleted

- `app/wallet-setup.tsx`
- `app/import-seed-phrase.tsx`
- `app/import-private-key.tsx`

Plus the orphaned component `components/login/WalletSetup.tsx` (folded into `CreateWalletSheet`).

`expo-router` will drop these from the generated typed-routes union on next dev-server run. Any `router.push("/wallet-setup")` / `"/import-*"` call must be replaced with an `AddWalletSheet` open — grep for the literals to catch every site.

### 14.3 First-login bootstrap (auto-mint, Option C)

On `wallets.length === 0` after auth, run a **shared-mnemonic bootstrap**:

```ts
// services/walletKit/bootstrap.ts
import { walletKitRegistry } from "./registry";
import { deriveWalletsFromMnemonic } from "./deriveAll";
import { generateWalletMnemonic } from "@/services/walletService";

export async function bootstrapFirstLoginWallets(): Promise<TWallet[]> {
  const mnemonic = generateWalletMnemonic(128);               // 12-word, BIP-39 valid, TWV-2026-002 CSPRNG
  const namespaces = walletKitRegistry.getAll().map(k => k.namespace);
  const wallets = await deriveWalletsFromMnemonic(
    mnemonic,
    namespaces,
    (ns) => defaultWalletNameFor(ns),                         // "Main Wallet" + chain tag
  );
  return wallets;                                              // caller persists via walletService.saveWalletsToStorage
}
```

Properties:

- **One mnemonic, N wallets.** All resulting `TWallet` rows share `seedPhrase`. They're independent in the storage bundle today; `derivationGroupId` is F7 (the remaining piece).
- **CSPRNG enforced.** `generateWalletMnemonic` already guards TWV-2026-002; the bootstrap is a plain caller.
- **Idempotent.** If the user logs out and back in with wallets still in the bundle, bootstrap is skipped — the zero-wallet gate is the only trigger.
- **Namespaces come from the registry.** When Sui ships, the bootstrap mints a Sui wallet too, automatically.

**Mnemonic backup UX** (Q6): the auto-minted mnemonic is not shown during bootstrap — users land on home uninterrupted. A persistent "Back up your recovery phrase" banner appears on `wallet.tsx` and dismisses once they complete a verify-words step in a dedicated settings flow (outside this spec's scope, tracked as follow-up). No hard gate on first send — the bundle is already biometric-protected and device-recovery-capable. Forcing a mnemonic write-down before any activity is a measured-by-drop-off flow that we're electing not to introduce.

### 14.4 `wallet.tsx` as the management hub

The "+" button in the header currently calls `router.push("/login")` — a symptom of login doubling as a wallet-creation entry point. Replace with:

```tsx
const [addWalletSheetVisible, setAddWalletSheetVisible] = useState(false);

<TouchableOpacity onPress={() => setAddWalletSheetVisible(true)}>
  <Plus size={20} color="#c71c4b" />
</TouchableOpacity>

<AddWalletSheet
  visible={addWalletSheetVisible}
  onClose={() => setAddWalletSheetVisible(false)}
  onWalletAdded={(wallet) => {
    setAddWalletSheetVisible(false);
    // useWallet.addWallet already sets the new wallet active.
  }}
/>
```

The `WalletSwitcherModal.onAddWallet` prop (today: `() => router.push("/login")`) also opens the sheet.

**Remove the redirect in `useWallet`'s effect:**

```ts
// BEFORE
useEffect(() => {
  if (isReady && !isLoading && wallets.length === 0) {
    router.replace("/login");
  }
}, [isLoading, wallets, isReady]);

// AFTER — zero-wallet handled at login (§14.1) and inline (empty state).
// No effect needed here; wallet.tsx renders the empty-state CTA when wallets is empty.
```

**Empty-state card** in `wallet.tsx` when `wallets.length === 0` (belt-and-braces — shouldn't happen post-bootstrap, but protects against edge cases like the user deleting every wallet):

```tsx
{wallets.length === 0 && (
  <View className="items-center py-16 px-8">
    <WalletIcon size={48} color="#c71c4b" />
    <Text className="text-lg font-bold mt-4">No wallets yet</Text>
    <Text className="text-sm text-center mt-2 opacity-70">
      Create a fresh wallet or import an existing one to get started.
    </Text>
    <TouchableOpacity
      className="bg-light-primary-red py-3 px-6 rounded-full mt-6"
      onPress={() => setAddWalletSheetVisible(true)}
    >
      <Text className="text-light font-bold">Add wallet</Text>
    </TouchableOpacity>
  </View>
)}
```

### 14.5 `AddWalletSheet` — top-level picker

Two steps, bottom-sheet style:

```
┌─ Add wallet ─────────────────────────┐
│                                       │
│   ╭──────────────────────────────╮   │
│   │  [+]  Create new wallet       │   │
│   │       Generate a fresh        │   │
│   │       multi-chain wallet      │   │
│   ╰──────────────────────────────╯   │
│                                       │
│   ╭──────────────────────────────╮   │
│   │  [🔑] Import seed phrase     │   │
│   │       12 or 24 words          │   │
│   ╰──────────────────────────────╯   │
│                                       │
│   ╭──────────────────────────────╮   │
│   │  [🔐] Import private key     │   │
│   │       One chain, one key      │   │
│   ╰──────────────────────────────╯   │
└───────────────────────────────────────┘
```

Tapping a card swaps the sheet body for the corresponding sub-sheet (`CreateWalletSheet`, `ImportSeedPhraseSheet`, `ImportPrivateKeySheet`). No navigation stack — this is all one modal with internal state.

### 14.6 Create & import flows

All three flows end with `useWallet.addWallet(...)` (single wallet) or a new `useWallet.addWallets(wallets: TWallet[])` helper (batch insert, one save round-trip for multi-chain cases). The new helper just loops the existing addWallet logic, skipping duplicate-address checks only across the batch.

**`CreateWalletSheet`** — generates and derives:

```
1. Mnemonic generated      → generateWalletMnemonic(128)
2. "Back up these 12 words" (reveal view, copy disabled, screenshot-blur)
3. Verify-words step        (existing UX from WalletSetup.tsx, relocated)
4. NamespacePicker multi-select — defaults ALL CHECKED
   [x] Ethereum
   [x] Solana
   (future: [ ] Sui)
5. Confirm → deriveWalletsFromMnemonic(mnemonic, selected) → addWallets(...)
```

**`ImportSeedPhraseSheet`** — namespace-agnostic paste:

```
1. Textarea — 12/24 words, validates on blur via BIP-39 checksum
2. NamespacePicker multi-select — defaults ALL CHECKED, same UI as create
   (user can uncheck chains they don't want on this device)
3. Confirm → deriveWalletsFromMnemonic(mnemonic, selected) → addWallets(...)
```

**`ImportPrivateKeySheet`** — namespace-specific, three steps:

```
Step 1 — Pick chain (auto-highlighted from paste format if detectable)
   ╭─────────╮ ╭─────────╮
   │Ethereum │ │ Solana  │
   │  ETH    │ │  SOL    │
   ╰─────────╯ ╰─────────╯
   (list comes from walletKitRegistry.getAll().filter(
      k => k.supportsPrivateKeyImport?.() !== false))

Step 2 — Paste key
   Textarea with per-chain placeholder:
     EVM    → "0x... (64 hex chars)"
     Solana → "Base58 (88 chars, Phantom export format)"
   Live validation via kit.validatePrivateKey(input)
   Error copy is chain-specific ("This doesn't look like a Solana
   private key — expected 64-byte base58.")

Step 3 — Name & confirm
   → kit.createWalletFromPrivateKey(pk, name) → addWallet(...)

Footer on every step:
   "Wrong chain? A seed phrase imports all chains at once.
    [Import seed phrase instead]" — opens ImportSeedPhraseSheet.
```

**Smart format inference** — UX polish to reduce picker friction. When the user pastes into the key field *after* landing on step 2, or pastes into a unified "paste first, pick chain" variant, the format sniffs which chain is plausible and auto-selects that card. User can still override.

```ts
// components/wallet/create/inferNamespaceFromKey.ts
import type { Namespace } from "@/services/chains/types";

export function inferNamespaceFromKey(input: string): Namespace | null {
  const s = input.trim();
  // EVM: 32-byte scalar, hex-encoded, optional 0x prefix.
  if (/^(0x)?[0-9a-fA-F]{64}$/.test(s)) return "eip155";
  // Solana: 87–88 char base58 of a 64-byte secret key (Phantom export format).
  if (/^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(s)) return "solana";
  return null;
}
```

Inference is a hint, not a gate. The chain picker remains user-confirmed because a 64-hex-char string is ambiguous (EVM key? random hash? someone's Solana export mistakenly rendered in hex?). The user's deliberate pick is the only safe signal.

**Why multi-chain private-key import (and not EVM-only):** we want to cover users whose only material is a non-mnemonic Solana keypair — e.g., wallets generated from `solana-keygen` CLI, single-use hot keys, or imports from wallets that never surfaced a mnemonic. Restricting to EVM would lock out this group and isn't worth the marginal UI simplification given the kit already has the slot (`supportsPrivateKeyImport?`).

**The hard rule we don't bend on — no cross-chain derivation from one key.** A Solana `createWalletFromPrivateKey` fed with EVM bytes produces a valid-looking base58 address that the user does *not* own anywhere else. Phantom/MetaMask refuse this for the same reason. Our UI never presents "import this key on both chains" as an option — one key, one chain, explicit pick. Users wanting both chains use seed-phrase import, which is cryptographically sound across chains.

### 14.7 Security carry-over

All existing wallet-security gates apply to the new flows — they're the same `walletService.addWallet` / `saveWalletsToStorage` codepaths:

- TWV-2026-002 CSPRNG: `generateWalletMnemonic` is the single blessed call site; bootstrap and `CreateWalletSheet` both go through it.
- TWV-2026-057 JS-heap dwell: the three new sheets never hold a decrypted key longer than the synchronous `kit.createWalletFrom*` call; the resulting `TWallet` is handed to `walletService` and the sheet's local references drop.
- TWV-2026-060 bundle mode: N wallets added in a batch (multi-chain import) trigger one `saveWalletsToStorage` call → one biometric prompt, regardless of chain count.
- TWV-2026-070 Solana dwell: unchanged — import flows feed `wallet.privateKey` / `wallet.seedPhrase` into the bundle; signer reconstruction still happens lazily in `getSolanaSignerForWallet`.

### 14.8 Call-site migration checklist

Grep-and-replace targets:

| Grep | Action |
|---|---|
| `router.push("/wallet-setup")` | Remove. If inside `login.tsx`, delete the whole "Create New Wallet" TouchableOpacity. |
| `router.push("/login")` (from inside a wallet-management context) | Replace with `setAddWalletSheetVisible(true)`. Login pushes remain valid from logout flows. |
| `router.push("/import-seed-phrase")` / `router.push("/import-private-key")` | Remove. Delete the surrounding "IMPORT EXISTING WALLET" card from `login.tsx`. |
| `router.replace("/login")` inside `useWallet` | Delete the effect; rendering now handles the zero-wallet case inline. |
| `import WalletSetup from "@/components/login/WalletSetup"` | Delete — component is gone, logic inside `CreateWalletSheet`. |

### 14.9 Testing additions

- `services/walletKit/bootstrap.test.ts` — zero-wallet bootstrap produces one wallet per registered kit, all sharing `seedPhrase`, all with valid per-kit addresses.
- `services/walletKit/deriveAll.test.ts` — golden vector: a known mnemonic through all kits produces known addresses (Phantom-verified Solana address, MetaMask-verified EVM address).
- `components/wallet/create/AddWalletSheet.test.tsx` — each path (create / import seed / import pk) wires to the correct sub-sheet and calls `addWallet(s)` with the expected payload.
- `components/wallet/create/ImportPrivateKeySheet.test.tsx` — forcing an EVM key into the Solana path shows the validation error; correct key on the correct chain imports successfully.
- Manual flow — fresh sim, log in with Google, confirm two wallets appear on `wallet.tsx` (EVM + Solana) under names like "Main Wallet · ETH" / "Main Wallet · SOL"; verify from both that the same mnemonic is stored by revealing in settings.

### 14.10 Out-of-scope for v2.3 (reiterating)

- Formal derivation-group UI (one card with two addresses, grouped rename/delete) — F7 leftover.
- Hardware-wallet import paths — different docking story.
- Social-recovery / cloud-backup of mnemonics — separate initiative.
- Multi-account indexing beyond index 0 on the derivation path (today every chain uses `m/…/0'/0'` / `m/…/0/0`) — follow-up if users request "add account 2" from a single mnemonic.
