# Sui dApp bridge — engineering spec

**Status:** Draft (research synthesis, no code yet)
**Author:** Claude (research, grounded in current `services/chains/`, `services/bridge/`, `app/dapps-browser.tsx`)
**Date:** 2026-05-05
**Companion specs:**
- `docs/sui-chain-support-spec.md` — wallet-kit + agent surface (this milestone scaffolds `SuiAdapter` but leaves it disabled).
- `docs/solana-chain-support-spec.md` — the precedent we mirror for the dApp surface.
- `docs/solana-adapter-spec.md` — exhaustive line-by-line Solana adapter contract; this Sui spec is its sibling.

---

## 0. Goal & non-goals

### Goal
Light up the `<WebView>` dApp browser surface for Sui so that a third-party
Sui dApp opened inside the in-app explorer (`app/dapps-browser.tsx`) sees
TakumiPay as a fully-featured **Wallet Standard** Sui wallet, with the
same UX guarantees the EVM and Solana adapters already offer:

1. Wallet Standard discovery (`wallet-standard:register-wallet` + `app-ready` handshake) so reactive dApps (Sui dApp Kit, Suiet kit, hand-rolled `getWallets()` consumers) bind to TakumiPay without user intervention.
2. The four required Wallet Standard features: `standard:connect`, `standard:disconnect`, `standard:events`, plus the four Sui features `sui:signTransaction`, `sui:signAndExecuteTransaction`, `sui:signPersonalMessage`, `sui:reportTransactionEffects` — and their two legacy aliases `sui:signTransactionBlock` / `sui:signAndExecuteTransactionBlock`.
3. Per-origin permission grants identical in shape to the Solana grants stored in `services/permissions/store.ts` — so a Sui dApp's silent reconnect (`standard:connect({silent:true})`) returns its prior account without a sheet.
4. Approval sheets for every user-visible kind (`connect`, `signMessage`, `signTransaction`, `signAndExecute`, `switchNetwork`).
5. Inspectors that mirror the Solana stack (PTB decoder, dry-run simulation, SIWS-style personal-message renderer) so the user always sees a decoded transaction before signing.

### Non-goals (this milestone)
- Anything in `docs/sui-chain-support-spec.md` §0 non-goals (zkLogin, multisig, sponsored / gas-station, SuiNS).
- WalletConnect over Sui. Out of scope; CAIP-2 prefix already mapped at `services/walletconnect/caipMapping.ts:38` for a future WC spec.
- Sponsored-transaction approval rendering. The `sui:signTransaction` payload exposes the gas-data slot, but if a dApp requests sponsored-tx flow we render a generic "external sponsor" annotation and let the user decide; we do not add a separate sponsor-aware renderer in v1.
- `sui:reportTransactionEffects`. The injected provider accepts the call (Wallet Standard requires it for completeness) and forwards it to the bridge, but the adapter response is `{ ok: true }` with no client-side cache rebuild. Cache invalidation hinted by the dApp is a TanStack Query concern in a follow-up task.

---

## 1. Sui Wallet Standard — what the dApp browser must implement

### 1.1 Authoritative references
- Wallet Standard Sui extension: https://github.com/wallet-standard/wallet-standard/blob/main/extensions/sui.md
- Sui implementer guide: https://docs.sui.io/onchain-finance/asset-custody/wallets/wallet-standard
- TS types: `@mysten/wallet-standard` (npm) — re-exports `ReadonlyWalletAccount`, `SUI_*_FEATURE` strings, chain literals.

### 1.2 Discovery handshake (mirror of Solana §4.2)
The injected script must:

1. On first install: dispatch `wallet-standard:register-wallet` with a `detail.register(wallet)` callback. Stash the wallet object on `window.__takumi_sui_wallet` so subsequent re-injects re-dispatch the same identity.
2. Listen for `wallet-standard:app-ready` and re-register on every event. SPAs that mount their `getWallets()` listener after our first dispatch (Sui dApp Kit on hydration, Surf, Suiet wallet kit) only catch the wallet via this handshake.
3. Both halves matter — see `services/chains/solana/injectedScript.ts:135-141` for the Solana precedent (Inv 13). Same property holds for Sui.

### 1.3 Account shape (`ReadonlyWalletAccount`)
```ts
{
  address: string,            // 0x-prefixed 32-byte hex (66 chars)
  publicKey: Uint8Array(32),  // raw ed25519 pubkey, NO flag byte
  chains: ["sui:mainnet"],    // narrowed to the granted chains
  features: [
    "standard:connect",
    "standard:disconnect",
    "standard:events",
    "sui:signTransaction",
    "sui:signTransactionBlock",          // legacy alias
    "sui:signAndExecuteTransaction",
    "sui:signAndExecuteTransactionBlock",// legacy alias
    "sui:signPersonalMessage",
    "sui:reportTransactionEffects"
  ],
  label: "TakumiPay",
  icon: "data:image/<mime>;base64,..."   // ≤ 100 KB per Solana §10.6 carryover
}
```

### 1.4 Wire-format details that bite
The Sui extension differs from Solana's in three ways the bridge must enforce:

| Concern | Sui contract | Implication for the adapter |
|---|---|---|
| Transaction encoding | Wallet Standard delivers `transaction: { toJSON: () => Promise<string> }` (the Mysten `Transaction` builder) **or** a serialised `Uint8Array`. | The injected script normalises to a single base64-encoded BCS payload before sending over the bridge. The adapter receives base64 only — never a function reference. |
| Signature shape | Sui returns base64 `flag(1) || sig(64) || pubkey(32)` (97 bytes). Verification on the dApp side feeds it straight to `verifyPersonalMessage` / `verifyTransaction`. | `executeApproval` returns the base64 string verbatim. **No** double-encoding (don't wrap in another base64). |
| Personal message | `sui:signPersonalMessage` takes raw `Uint8Array`. Intent prefix is `[0x03, 0x00, 0x00]` (PersonalMessage scope). | Use `Ed25519Keypair.signPersonalMessage` from `@mysten/sui/keypairs/ed25519` — never reimplement the intent prepend. |

### 1.5 Chains the adapter accepts
| Identifier | Cluster |
|---|---|
| `sui:mainnet` | mainnet |
| `sui:testnet` | testnet |
| `sui:devnet` | devnet |
| `sui:localnet` | local dev (rejected by adapter unless an explicit RPC override exists) |

---

## 2. Where this slots into the codebase

The space-docking pattern already accommodates Sui — verified by reading
the actual source rather than relying on the spec's prose:

```
                       ┌────────────────────────────────────┐
WebView injected JS ◀─ │ a.getInjectedScript(ctx)           │
(window.sui shim)      │ a ∈ ChainAdapterRegistry.list()    │
                       └─────────────┬──────────────────────┘
                                     │
        bridge_request ──▶ DappBridge.dispatch          (services/bridge/DappBridge.ts:114)
                                     │
                  ChainAdapterRegistry.get(namespace).handleRequest
                                     │
                       ┌─────────────┴──────────────────────┐
                       │ ChainResult                        │
                       │   resolved | needs-approval | error│
                       └─────────────┬──────────────────────┘
                                     │
                        InspectorRegistry.runPipeline       (services/bridge/inspector.ts:128)
                                     │
                       pendingIntentsStore.push           (services/bridge/pendingIntents.ts)
                                     │
                                     ▼
                       ApprovalHost finds matching renderer
                       in `evmRenderers` (services/bridge/renderers.ts via boot.ts:58)
                                     │
                                     ▼
                       User decision → adapter.executeApproval
                                     │
                                     ▼
                       SuiSignerFns (registered by Sui equivalent of installSolanaSigner)
                                     │
                                     ▼
                       getSuiSignerForWallet (single dwell site, services/walletService.ts)
```

**No file under `app/dapps-browser.tsx` needs editing.** The browser screen
collects every registered adapter's `getInjectedScript` and injects them
together (`app/dapps-browser.tsx:281`). Adding `SuiAdapter` to the registry
in `services/bridge/boot.ts` is the only switch.

### 2.1 Existing scaffolding (verified empty)
- `services/chains/sui/` — directory exists, empty.
- `services/walletKit/sui/` — directory exists, empty.
- `Namespace` union already includes `"sui"` (`services/chains/types.ts:4`).
- `walletKitRegistry.has("sui")` returns `false` until the wallet-kit spec lands; the bridge boot must guard accordingly (parallel to the Solana guard at `services/bridge/boot.ts:100-121`).

---

## 3. Files this spec adds / modifies

### 3.1 New files
```
services/chains/sui/
  SuiAdapter.ts                 # implements ChainAdapter
  injectedScript.ts             # window.sui Wallet Standard shim (≤ 5 KB gzipped)
  payloads.ts                   # SuiConnectPayload, SuiSignTxPayload, …
  inspector.ts                  # SuiPtbDecoderInspector (programmable tx decoder)
  simulation.ts                 # client.dryRunTransactionBlock() helper
  errorCodes.ts                 # §10.3 analogue — typed error codes
  agentContext.ts               # buildAgentContext(intent) — JSON-safe AI view (§11.5)
  payloads.test.ts
  injectedScript.test.ts        # wallet-standard handshake lint, mirror __wallet-standard-lint.ts
  SuiAdapter.errorCodes.test.ts
  SuiAdapter.test.ts
  agentContext.test.ts          # parity with services/chains/solana/agentContext.test.ts
  __wallet-standard-lint.ts     # Wallet Standard predicate suite (§4 below)

services/bridge/inspectors/
  SuiPtbDecoderInspector.ts     # priority 15 (matches SolanaProgramDecoderInspector)
  SuiSimulationInspector.ts     # priority 20 (matches SolanaSimulationInspector)
  SuiSiwsInspector.ts           # priority 25 — SIWS-style personal-message renderer

components/dapps-browser/approvals/
  SuiTransactionSheet.tsx
  SuiSignAndExecuteSheet.tsx    # may collapse into SuiTransactionSheet via mode flag
  SuiSignPersonalMessageSheet.tsx
  SuiSignInSheet.tsx            # SIWS — mirrors SolanaSignInSheet
  SuiSwitchNetworkSheet.tsx
```

### 3.2 Modified files
| File | Change |
|---|---|
| `services/bridge/boot.ts:60-71` | After Solana, register `createSuiAdapter()`. Behind `walletKitRegistry.has("sui")` guard mirroring the Solana check at `:100`; install `SuiSignerFns` only when the kit is present. |
| `services/bridge/redact.ts:130-255` | Add Sui method branches to `redactParams` so the `bridgeEventBus` / Sentry / agent-API breadcrumbs never carry raw transaction bytes, signed-message bytes, or signatures. See §11.5 for the per-method shape. |
| `services/chains/solana/SolanaAdapter.ts` | None. The `SuiSignerFns` interface lives in `services/chains/sui/SuiAdapter.ts`. |
| `components/dapps-browser/approvals/renderers.ts:18-90` | Append seven `{canHandle, Component}` entries for the Sui sheets. The `connect` row at `:30-33` is already namespace-agnostic — it dispatches on `intent.kind === "connect"` and reads the kit's `formatConnectChipLabel` / `brandColor` / `requireBiometricForConnect` hooks. No change needed for connect. The `via: "agent"` row at `:21-24` (`AgentCardRenderer`) already covers Sui — agent-submitted intents render via the agent card regardless of namespace. |
| `services/walletconnect/caipMapping.ts:11-23` | Extend `caip2ToNamespace` to recognise `sui:` (currently only `eip155` and `solana` map there; the symmetric direction at `:35-39` already handles Sui). Strictly orthogonal — the bridge does not call `caip2ToNamespace`, but agent permissions might. |
| `services/bridge/DappBridge.ts` | None. The dispatch path is already namespace-agnostic. `submitAgentIntent` (`:319-353`) and `runOnDemandInspector` (`:355-367`) work for Sui out of the box once the adapter is registered. |
| `app/dapps-browser.tsx` | None. `injectedJavaScript` already iterates all adapters at `:281`. |

### 3.3 Out-of-spec but coupled
- Wallet kit registration (`services/walletKit/boot.ts:27`) — owned by `docs/sui-chain-support-spec.md`. This spec depends on it landing first; otherwise `installSuiSigner` short-circuits and the adapter handles requests but cannot sign.

---

## 4. The `SuiAdapter` contract

```ts
class SuiAdapter implements ChainAdapter {
  readonly namespace = "sui" as const;

  getInjectedScript(ctx: AdapterContext): string;
  onStateChange(ctx: AdapterContext): { injectedJs: string } | null;
  handleRequest(req: ChainRequest, ctx: AdapterContext): Promise<ChainResult>;
  executeApproval(intent, decision, ctx): Promise<unknown>;
}
```

### 4.1 Method dispatch table (parallel to `SolanaAdapter.handleRequest:216-256`)

| Wire method | Approval kind | Wallet picker | Notes |
|---|---|---|---|
| `standard:connect` | `connect` | `pickSuiWalletForOrigin(ctx, origin, network)` | `silent ⇔ onlyIfTrusted`. Resolve immediately when grant exists; otherwise `needs-approval`. |
| `standard:disconnect` | (resolved, no intent) | — | `await PermissionStore.revoke({ origin })`. Identical to `SolanaAdapter:258-269`. |
| `sui:signPersonalMessage` | `signMessage` | per-origin grant | `display: "utf8" | "base64"` derived via `isUtf8Displayable` (lift `services/chains/solana/SolanaAdapter.ts:77-94` into a shared util). |
| `sui:signTransaction` | `signTransaction` | per-origin grant | `mode: "sign-only"`. Single-tx only — Wallet Standard Sui has **no** `signAllTransactions` analogue (deviation from Solana). |
| `sui:signAndExecuteTransaction` | `signTransaction` (with `mode: "sign-and-execute"`) | per-origin grant | Adapter signs then submits via `client.executeTransactionBlock` and returns `{ digest, effects, … }`. |
| `sui:signTransactionBlock` | (alias) | — | Legacy. Adapter rewrites method name to `sui:signTransaction` before switch. Dev warning once per session. |
| `sui:signAndExecuteTransactionBlock` | (alias) | — | Same. |
| `sui:reportTransactionEffects` | (resolved) | — | Adapter logs to `bridgeEventBus` and returns `null`. No state mutation. |
| `takumi:switchNetwork` | `switchNetwork` | per-origin grant | TakumiPay-namespaced extension. Sets the SuiAdapter's per-origin network grant. Wallet Standard Sui has no `wallet_switchEthereumChain` equivalent — we add one for parity with Solana's `takumi:switchCluster`. |

### 4.2 Connect flow (silent vs. interactive)
Mirror `SolanaAdapter.handleConnect:271-315` exactly. Differences:
- Default network is `"mainnet"` (read from active chain config when present, else `"mainnet"`). Solana defaults to `"mainnet-beta"`.
- Cross-namespace trust extension is forbidden — a recent EVM grant for the same origin does NOT silently expose the user's Sui wallet. Same property the Solana adapter enforces at `:303-305`.
- Wallet picker prefers a Sui wallet whose `address` matches a `PermissionStore` grant for `(origin, sui:<network>)`; falls back to the first Sui wallet for non-silent connects.

### 4.3 `pickSuiWalletForOrigin` (helper, file-private)
```ts
function pickSuiWalletForOrigin(
  ctx: AdapterContext,
  origin: string,
  network?: SuiNetwork,
): TWallet | null {
  const sui = ctx.wallets.filter((w) => w.namespace === "sui");
  if (sui.length === 0) return null;
  const targetChain = network ? `sui:${network}` : null;
  const grants = PermissionStore.listByOrigin(origin).filter((g) => {
    if (typeof g.chainId !== "string") return false;
    if (!g.chainId.startsWith("sui:")) return false;
    return targetChain === null || g.chainId === targetChain;
  });
  for (const g of grants) {
    const m = sui.find((w) => w.address.toLowerCase() === g.walletAddress.toLowerCase());
    if (m) return m;
  }
  return sui[0];
}
```
Lift the entire body from `SolanaAdapter:131-151`; the only difference is
the chain-id prefix string.

### 4.4 `executeApproval` outcomes

| Intent kind | Adapter return |
|---|---|
| `connect` | `{ accounts: [{ address, publicKey, chains, features, label, icon }], chain: "sui:<network>" }`. The full account object — Wallet Standard dApps need `publicKey` and `chains` to construct downstream signing context. |
| `signMessage` | `{ bytes: <base64 of the original message>, signature: <base64 97-byte> }`. Sui Wallet Standard returns the message bytes (echo) plus the signature. |
| `signTransaction` (sign-only) | `{ bytes: <base64 of BCS tx>, signature: <base64 97-byte> }`. |
| `signTransaction` (sign-and-execute) | `{ digest, rawEffects?, rawTransaction? }` — the response shape `client.executeTransactionBlock` returns under `showEffects` / `showRawTransaction`. The dApp opts in via the request `options` field; default is `{ showEffects: false }`. |
| `signIn` (SIWS) | `{ account: { address, publicKey, chains, features, label, icon }, signedMessage: <base64 utf8>, signature: <base64> }`. |
| `switchNetwork` | `{ ok: true, chain: "sui:<to>" }`. Adapter writes the new grant to `PermissionStore` for the origin. |

### 4.5 `getInjectedScript` contract
Returns the IIFE described in §5. The active address is derived from
`ctx.wallets.find(w => w.namespace === "sui")?.address ?? null`. Pre-connect,
`accounts: []` per Wallet Standard convention — pre-populating an active
account causes Sui-side libraries (Sui dApp Kit, Suiet) to skip `connect`
and silently assume the user is authorised, which fails the moment a
sign request lands and the user has not granted. Same bug class
the Solana injected script avoids (`services/chains/solana/injectedScript.ts:120-124`).

### 4.6 `onStateChange` contract
On any change to `ctx.activeWallet` or any Sui-flagged grant, push:

```js
window._updateSuiWallet && window._updateSuiWallet({
  accounts: <next array>,
  chain: <"sui:mainnet" | "sui:testnet" | "sui:devnet">
});
```

The shim emits Wallet Standard `change` events to subscribed dApps. Mirror
the Solana implementation at `SolanaAdapter:201-214`.

---

## 5. The injected script (`services/chains/sui/injectedScript.ts`)

### 5.1 Targets
- ≤ 5 KB gzipped (Solana shim is ~3 KB; Sui's larger account shape and feature list bring this up modestly).
- Runs under `injectedJavaScriptBeforeContentLoaded` on RN-WebView. Hermes is not in scope here — the script runs in WebKit / Chromium WebView, not Hermes, so it can use modern JS.
- Idempotent — re-running against an already-installed page is a no-op except for re-dispatching `wallet-standard:register-wallet` so late listeners catch the wallet.

### 5.2 Public surface installed on `window`
```ts
window.__takumi_sui_installed: 1
window.__takumi_sui_wallet: <Wallet>            // Wallet Standard wallet object
window.__takumi_sui_nonce: string               // TWV-2026-015 — read at request time
window._updateSuiWallet(state): void            // bridge-side state updates
window._handleEthereumResponse(x): void         // shared response demux (legacy name kept)
```

**No** `window.sui` legacy shim. Unlike Solana's `window.solana` (kept for
Phantom-detection-style legacy compatibility — see `injectedScript.ts:144-170`),
Sui has no equivalent legacy global. Wallet Standard is the only path on Sui.
Adding `window.sui` would invite confusion with non-standard wallet variants
that have shipped under that name, and risk a dApp short-circuiting into a
half-implemented surface. Wallet Standard discovery only.

### 5.3 Handshake (mirror of `services/chains/solana/injectedScript.ts:53-59` + `:135-141`)
```js
if (window.__takumi_sui_installed) {
  // Re-dispatch register so late listeners catch the same identity.
  var W = window.__takumi_sui_wallet;
  if (W) {
    var re = new Event("wallet-standard:register-wallet");
    re.detail = function(api){ try { api.register(W); } catch(e){} };
    window.dispatchEvent(re);
  }
  return;
}
window.__takumi_sui_installed = 1;
```
Plus the `app-ready` listener that calls `e.detail.register(W)` — Inv 13 from
the Solana spec applies verbatim.

### 5.4 Feature object skeleton
```js
var feats = {
  "standard:connect":                   { version:"1.0.0", connect: C1 },
  "standard:disconnect":                { version:"1.0.0", disconnect: D1 },
  "standard:events":                    { version:"1.0.0", on: EV },
  "sui:signPersonalMessage":            { version:"1.0.0", signPersonalMessage: SPM },
  "sui:signTransaction":                { version:"1.0.0", signTransaction: ST },
  "sui:signAndExecuteTransaction":      { version:"1.0.0", signAndExecuteTransaction: SAE },
  "sui:signTransactionBlock":           { version:"1.0.0", signTransactionBlock: ST_LEGACY },
  "sui:signAndExecuteTransactionBlock": { version:"1.0.0", signAndExecuteTransactionBlock: SAE_LEGACY },
  "sui:reportTransactionEffects":       { version:"1.0.0", reportTransactionEffects: RTE },
  "takumi:switchNetwork":               { version:"1.0.0", switchNetwork: SN }
};
```
Legacy and current methods point at the **same** underlying `S("sui:signTransaction", …)`
RPC call — the adapter rewrites the method name on the way in.

### 5.5 Transaction normalisation in the shim
The Wallet Standard Sui contract accepts `transaction` as either a Mysten
`Transaction` instance (with `.toJSON()` returning a Promise) or a raw
`Uint8Array`. The shim normalises both forms to base64 BCS before the
`bridge_request`:

```js
async function normaliseTx(t) {
  // 1. Mysten Transaction shape — .toJSON() returns base64 BCS string.
  if (t && typeof t.toJSON === "function") {
    var s = await t.toJSON();
    return s; // already base64
  }
  // 2. Raw bytes.
  if (t instanceof Uint8Array) return b64e(t);
  if (t && t.buffer && typeof t.byteLength === "number") return b64e(new Uint8Array(t.buffer, t.byteOffset||0, t.byteLength));
  if (t instanceof ArrayBuffer) return b64e(new Uint8Array(t));
  // 3. Already-base64 string (some dApps build via `Transaction.build({ client })` and pass the result).
  if (typeof t === "string") return t;
  throw new Error("invalid transaction");
}
```

The shim is **not** allowed to call `client.executeTransactionBlock` —
that's the adapter's job. The shim only signs / hands off.

### 5.6 Session-nonce stamping
Same as `services/chains/solana/injectedScript.ts:74-77`. Every outbound
`bridge_request` reads `window.__takumi_sui_nonce` at call time (not
closure-captured) and stamps it on the message. The bridge enforces the
nonce check at `services/bridge/DappBridge.ts:142-163`. SPA navigation
without re-injection still works because the dApps-browser screen rotates
the nonce via `setSessionNonce` and the ring at `:65` accepts any
recently-issued value.

### 5.7 Wallet Standard lint suite
Add `services/chains/sui/__wallet-standard-lint.ts` mirroring
`services/chains/solana/__wallet-standard-lint.ts`. The suite runs the
shim under `node --test --experimental-strip-types`, simulates the
`register-wallet` / `app-ready` events, and asserts:

| Assertion | Source predicate |
|---|---|
| `wallet.version === "1.0.0"`, `name === "TakumiPay"`, `icon` is a `data:` URL ≤ 100 KB | `@wallet-standard/core` shape predicates. |
| `chains` is a non-empty array of `sui:*` strings | Wallet Standard Sui §chains. |
| Every required feature key present | `@mysten/wallet-standard` `SUI_*_FEATURE` constants. |
| Feature-function identity stable across re-inject (Inv 18) | Ad-hoc identity check: `feats["sui:signTransaction"].signTransaction === origRef`. |
| `accounts` starts empty, `publicKey` is `Uint8Array(32)` post-connect (Inv 13 carryover) | Mock `S()` resolver to return a known address; assert `wallet.accounts[0].publicKey instanceof Uint8Array && .length === 32`. |
| Legacy method `sui:signTransactionBlock` routes to the same handler as `sui:signTransaction` | Spy on `S` and assert both methods produce the same downstream call. |

---

## 6. Approval payloads (`services/chains/sui/payloads.ts`)

```ts
export type SuiNetwork = "mainnet" | "testnet" | "devnet";
export type SuiChain = `sui:${SuiNetwork}`;

export type SuiConnectPayload = {
  network: SuiNetwork;
  onlyIfTrusted: boolean;
};

/** SIWS (Sign-In-With-Sui) — EIP-4361-shaped. */
export type SuiSignInPayload = {
  domain: string;
  address?: string;
  statement?: string;
  uri?: string;
  version?: "1";
  chainId?: SuiNetwork;
  nonce?: string;
  issuedAt?: string;
  expirationTime?: string;
  notBefore?: string;
  requestId?: string;
  resources?: string[];
};

export type SuiSignPersonalMessagePayload = {
  address: string;
  /** base64 of raw bytes the dApp passed in. */
  message: string;
  display: "utf8" | "base64";
};

export type SuiSignTxMode = "sign-only" | "sign-and-execute";

export type SuiTxOptions = {
  showEffects?: boolean;
  showEvents?: boolean;
  showObjectChanges?: boolean;
  showBalanceChanges?: boolean;
  showRawEffects?: boolean;
};

/** PTB-decoded structural view emitted by the SuiPtbDecoderInspector. */
export type SuiDecodedCommand =
  | { kind: "MoveCall"; package: string; module: string; function: string; argumentCount: number; typeArgumentCount: number }
  | { kind: "TransferObjects"; recipientArgIndex: number; objectArgCount: number }
  | { kind: "SplitCoins"; sourceArgIndex: number; amountCount: number }
  | { kind: "MergeCoins"; targetArgIndex: number; sourceArgCount: number }
  | { kind: "Publish" | "Upgrade"; modules: number; dependencies: number }
  | { kind: "MakeMoveVec"; type?: string; elements: number };

export type SuiSimulationSummary = {
  /** Effects status from `dryRunTransactionBlock` — "success" or error string. */
  status: "success" | string;
  gasUsed: { computation: bigint; storage: bigint; storageRebate: bigint; nonRefundableStorageFee: bigint };
  balanceChanges: Array<{ owner: string; coinType: string; amount: bigint }>;
  objectChanges: Array<{ kind: "created" | "mutated" | "transferred" | "deleted"; objectType?: string; objectId?: string; recipient?: string }>;
  warnings: SuiSimulationWarning[];
};

export type SuiSimulationWarning =
  | { code: "ownership.transfer-out"; coinType: string; amount: bigint }
  | { code: "object.delete"; objectId: string }
  | { code: "object.transfer-out"; objectType: string }
  | { code: "publish.upgrade-cap" }
  | { code: "gas.high-budget"; budgetMist: bigint }
  | { code: "sender.mismatch"; expected: string; got: string };

export type SuiSignTxPayload = {
  mode: SuiSignTxMode;
  address: string;
  network: SuiNetwork;
  /** Base64-encoded BCS bytes — primary source of truth. */
  transaction: string;
  options?: SuiTxOptions;
  simulation?: SuiSimulationSummary;
  decoded?: SuiDecodedCommand[];
  /** Decoded structural fields populated by the PTB decoder inspector. */
  sender?: string;
  gasOwner?: string;       // ≠ sender ⇒ sponsored tx; render an annotation.
  gasBudget?: bigint;
  gasPrice?: bigint;
  inputArgumentCount?: number;
};

export type SuiSwitchNetworkPayload = {
  from: SuiNetwork;
  to: SuiNetwork;
};

export type SuiApprovalPayload =
  | ({ kind: "connect" } & SuiConnectPayload)
  | ({ kind: "signIn" } & SuiSignInPayload)
  | ({ kind: "signMessage" } & SuiSignPersonalMessagePayload)
  | ({ kind: "signTransaction" } & SuiSignTxPayload)
  | ({ kind: "switchNetwork" } & SuiSwitchNetworkPayload);
```

Note: there is **no** `signAllTransactions` analogue. Wallet Standard Sui
exposes single-transaction signing only. If a dApp wants to sign a batch
it builds one PTB containing all the work — that's how Sui dApps express
batches. The bridge does not split / fan out.

---

## 7. Approval renderers (sheets)

### 7.1 Reuse vs. new

| Sheet | Verdict |
|---|---|
| `ConnectSheet.tsx` | **Reuse.** Already namespace-agnostic; the renderer registry's connect entry at `services/bridge/renderers.ts` (or rather `components/dapps-browser/approvals/renderers.ts:30-33`) routes any `connect` intent there. The kit supplies `formatConnectChipLabel(payload) → "Sui · Mainnet"`, `brandColor` (omit; falls back to neutral), and `requireBiometricForConnect: true`. |
| `SuiSignInSheet.tsx` | **New.** Mirror `SolanaSignInSheet.tsx`. Render the SIWS canonical message, domain pinning warning, expiry. |
| `SuiSignPersonalMessageSheet.tsx` | **New.** Mirror `SolanaSignMessageSheet.tsx`. UTF-8 / base64 display modes — same `display` discriminator. |
| `SuiTransactionSheet.tsx` | **New.** Renders both `sign-only` and `sign-and-execute` (mode flag in payload, button label changes). Includes simulation summary (balance changes, object changes), decoded PTB commands list, gas summary, warnings panel. |
| `SuiSwitchNetworkSheet.tsx` | **New.** Mirror `SolanaSwitchClusterSheet.tsx`. Two-row picker (`from → to`). |
| (no `SuiWatchTokenSheet`) | Skip. Wallet Standard Sui has no `wallet_watchAsset` analogue; a `takumi:watchCoin` extension is future work. |

### 7.2 Registration
Append to `components/dapps-browser/approvals/renderers.ts:`
```ts
{ canHandle: (i) => i.namespace === "sui" && i.kind === "signIn",          Component: SuiSignInSheet },
{ canHandle: (i) => i.namespace === "sui" && i.kind === "signMessage",     Component: SuiSignPersonalMessageSheet },
{ canHandle: (i) => i.namespace === "sui" && i.kind === "signTransaction", Component: SuiTransactionSheet },
{ canHandle: (i) => i.namespace === "sui" && i.kind === "switchNetwork",   Component: SuiSwitchNetworkSheet },
```
The `connect` entry already at `:30-33` covers both Solana and Sui.

The `evmRenderers` constant name is misleading (it holds Solana renderers
too) — leaving as-is for orthogonality; rename is out of scope for this
spec but tracked as a follow-up.

---

## 8. Inspectors

Inspector pipeline runs at every `enqueue` (`services/bridge/DappBridge.ts:255-266`),
with priorities sorted ascending. Sui inspectors:

| Inspector | Priority | Mode | Trigger |
|---|---|---|---|
| `HttpsInspector` | (existing, ~5) | auto | universal |
| `HeuristicInspector` | (existing, ~10) | auto | universal |
| `SuiPtbDecoderInspector` | 15 | auto | `intent.kind === "signTransaction"` |
| `SuiSimulationInspector` | 20 | auto | `intent.kind === "signTransaction"` (depends on decoder fields) |
| `SuiSiwsInspector` | 25 | auto | `intent.kind === "signIn"` |

### 8.1 `SuiPtbDecoderInspector`
Pure decode — no RPC. Calls `Transaction.from(base64ToBytes(payload.transaction))`
from `@mysten/sui/transactions` and walks `tx.getData().commands` (or the v1
shape `tx.blockData.transactions`, depending on SDK version — task 00 in
the wallet-kit spec verifies). Patches the intent payload with:
- `sender`, `gasOwner`, `gasBudget`, `gasPrice`, `inputArgumentCount`
- `decoded: SuiDecodedCommand[]` (one entry per command)

Annotations:
- `sender.mismatch` (warn) — `payload.address !== sender`. Mirror Solana's `analysePartialSigner`.
- `gas.high-budget` (warn) — `gasBudget > 100_000_000n MIST` (0.1 SUI). Adjust threshold in review.
- `publish.upgrade-cap` (info) — any command kind `Upgrade` or `Publish`.
- `move-call.foreign-package` (info) — every `MoveCall.package !== "0x2"` (Sui framework). Sheet renders the package id verbatim with copy button.

### 8.2 `SuiSimulationInspector`
Calls `client.dryRunTransactionBlock({ transactionBlock: bytes })` against
the per-network RPC (mainnet for `network: "mainnet"`, etc.). Times out
at the 2 s default (`services/bridge/inspector.ts:53`).

Emits annotations from `SuiSimulationWarning`:
- `ownership.transfer-out` (warn) — every balance-change with `owner === sender && amount < 0n`.
- `object.delete` (danger) — every `objectChanges` with `kind === "deleted"`.
- `object.transfer-out` (warn) — every `objectChanges` with `kind === "transferred"` and `recipient !== sender`.
- `publish.upgrade-cap` (info) — promotion of decoder-side info to simulation-confirmed.

The summary (gasUsed breakdown, balance changes, object changes) lands in
`payload.simulation` for the sheet to render. Same pipeline shape as
`SolanaSimulationInspector:46-...`.

### 8.3 `SuiSiwsInspector`
Pure parser — no RPC. Builds the canonical SIWS message string from
`payload`:
```
{domain} wants you to sign in with your Sui account:
{address}

{statement}

URI: {uri}
Version: {version}
Chain: {chainId}
Nonce: {nonce}
Issued At: {issuedAt}
Expiration Time: {expirationTime}
Not Before: {notBefore}
Request ID: {requestId}
Resources:
- {resources[0]}
- ...
```
Mirror `services/bridge/inspectors/SolanaSiwsInspector.ts`. Patches the
payload with the canonical message string for the sheet. The same canonical
message is signed by `executeApproval` (do not re-derive in two places —
the inspector's output is the source of truth).

Annotations:
- `siws.domain-mismatch` (danger) — `payload.domain !== originKey(intent.origin.url)`.
- `siws.expired` (danger) — `expirationTime < now`.
- `siws.not-yet-valid` (warn) — `notBefore > now`.

### 8.4 Boot registration
In `services/bridge/boot.ts` after `InspectorRegistry.register(SolanaSiwsInspector);`:
```ts
InspectorRegistry.register(SuiPtbDecoderInspector);
InspectorRegistry.register(SuiSimulationInspector);
InspectorRegistry.register(SuiSiwsInspector);
```

---

## 9. Permissions model

Re-uses `services/permissions/store.ts` — no schema change. Grants:

```ts
{
  origin: "https://app.example.sui",
  walletAddress: "0x<32-byte hex>",
  chainId: "sui:mainnet",
  grantedAt: <ms epoch>
}
```

The `chainId` field is a free-form string in the permission store
(verified by Solana storing `"solana:mainnet"` etc. there). Sui slots in
without migration.

`takumi:switchNetwork` rewrites the per-origin grant's `chainId` from
`sui:<from>` → `sui:<to>`. Connect-with-network-hint sets it on first
grant.

---

## 10. Boot-order changes

Diff for `services/bridge/boot.ts`:

```ts
// after `ChainAdapterRegistry.register(solanaAdapter);`
const suiAdapter = createSuiAdapter();
ChainAdapterRegistry.register(suiAdapter);

if (walletKitRegistry.has("sui")) {
  installSuiSigner({
    getWalletByAddress: (addr) => opts.getContext().wallets.find((w) => w.address === addr),
    getRpcForNetwork: (network) => {
      const url =
        network === "testnet" ? "https://fullnode.testnet.sui.io:443" :
        network === "devnet"  ? "https://fullnode.devnet.sui.io:443" :
                                "https://fullnode.mainnet.sui.io:443";
      return { client: new SuiClient({ url }) };
    },
  });
} else {
  if (__DEV__) {
    console.warn(
      "[bridge] Sui kit not registered in walletKitRegistry; " +
      "Sui dApp signing disabled until next bootBridge. " +
      "Did `bootWalletKits()` run before `bootBridge()` and include Sui?"
    );
  }
  booted = false;  // mirror Solana's auto-retry on next mount
}
```

The `installSuiSigner` function lives in `services/chains/sui/SuiAdapter.ts`
alongside the adapter, mirroring `services/chains/solana/signer.ts +
SolanaAdapter.ts`.

---

## 11. Security invariants (new gates)

- **TWV-2026-YYY (SUI-DAPP)** *(new gate to issue with this PR.)*
  - The bridge's Sui sign path goes through `SuiSignerFns` registered by
    `installSuiSigner` only. The signer reaches the keypair through
    `getSuiSignerForWallet` — the single dwell site introduced by the
    wallet-kit spec (TWV-2026-XXX).
  - The injected script never sees private keys. It only emits signed
    base64 blobs back to the dApp. The native side does the signing.
  - Cross-namespace trust is forbidden in `executeApproval`: a connect
    intent that arrives from an origin with an existing EVM grant does
    NOT auto-grant Sui access. Same property in `SolanaAdapter:303-305`.

- **TWV-2026-013 carryover (origin pinning).** `DappBridge.dispatch:204-215`
  rejects requests whose declared origin host disagrees with the tracked
  top-frame host. Sui requests inherit this for free.

- **TWV-2026-015 carryover (session nonce).** Same. The Sui shim reads
  `window.__takumi_sui_nonce` at every request and stamps it onto the
  outbound message; the bridge ring at `services/bridge/DappBridge.ts:64-66`
  validates against any recently-issued nonce.

- **TWV-2026-064 carryover (fullscreen disabled).** `app/dapps-browser.tsx:262-279`
  neutralises the JS fullscreen API before any dApp script runs. Sui
  inherits.

- **`eth_sign` analogue.** Sui has no equivalent of `eth_sign`'s
  blank-cheque-signature footgun. `personal_sign` is `sui:signPersonalMessage`,
  which always carries a `PersonalMessage` intent prefix — there is no way
  to coerce it into signing a transaction digest. So `HARD_REJECT_METHODS`
  in `services/bridge/DappBridge.ts:21` does not need a Sui entry.

---

## 11.5 AI inspection / agent-mode readiness

This section makes Sui first-class for the future "Scan with Takumi AI"
feature — the Sparkles pill rendered by `ApprovalShell.tsx:65-77` that
calls `getDappBridge().runOnDemandInspector("agent", intent.id)`. EVM and
Solana already have the surfaces in place (Solana wired end-to-end,
EVM partial — see `services/chains/solana/agentContext.ts:1-18` for the
contract). Sui must land them at the same time as the bridge so that
when the agent on-demand inspector ships the next milestone over,
**no Sui-specific code change is needed in the inspector itself**.

### 11.5.1 Four surfaces the AI needs

| Surface | Owner | Sui contract |
|---|---|---|
| **Approval-side inspection** — "Ask Takumi AI to review" → on-demand inspector consumes the intent and emits annotations. | `services/chains/sui/agentContext.ts` | Build a JSON-safe, secret-free, pre-decoded view (§11.5.2). |
| **Agent-side write** — agent says "send 1 SUI to alice" → builds an intent → submits via `DappBridge.submitAgentIntent`. | `services/agent-executors/sui.ts` (wallet-kit spec §7.2) | Tools emit a `SuiSignTxPayload` whose `transaction` field is the same base64 BCS the dApp browser produces. The renderer dispatches on `via === "agent"` first, so `AgentCardRenderer` wins (`renderers.ts:21-24`). |
| **Telemetry redaction** — every intent flows through `bridgeEventBus`; sinks (Console today, Sentry tomorrow) read redacted params. | `services/bridge/redact.ts` | Add Sui method branches (§11.5.3). |
| **Agent-mode wallet context** — `AgentMode.tsx:425` builds `walletContext` from kit hooks. | `SuiWalletKit` (wallet-kit spec) | Implements `nativeSymbol`, `formatChainLabel`, `getChainId` — already covered there. |

### 11.5.2 `services/chains/sui/agentContext.ts`

Mirror of `services/chains/solana/agentContext.ts`. Same contract:

- **JSON-safe.** No `bigint`, no `Uint8Array`, no functions. Sui payloads carry several `bigint` fields (`gasBudget`, `gasPrice`, simulation `gasUsed`, `balanceChanges.amount`); convert to `string` or `number` (only when known to fit i53). The agent API HTTP serialiser drops anything it can't stringify.
- **Secret-free.** Never carry signature bytes or seed material. The decoded UTF-8 of a personal message is truncated to a 16-char preview (parity with Solana's `messagePreview`).
- **Pre-decoded.** `intent.payload.decoded` (PTB commands) and `intent.payload.simulation` are authoritative; the raw base64 BCS is preserved for an agent that wants to run its own Mysten-SDK decode but is **not** the source of truth.

```ts
// services/chains/sui/agentContext.ts

export interface AgentIntentContext {
  namespace: "sui";
  kind: ApprovalIntent["kind"];
  id: string;
  origin: { url: string; host?: string; title?: string; via?: "webview" | "agent" };
  annotations: Array<{ code: string; severity: "info" | "warn" | "danger"; title: string; detail?: string; source: string }>;
  intent: IntentShape;
}

type IntentShape =
  | { kind: "connect"; network: SuiNetwork; onlyIfTrusted: boolean }
  | {
      kind: "signIn";
      domain: string;
      address?: string;
      statement?: string;
      uri?: string;
      chainId?: SuiNetwork;
      nonce?: string;
      issuedAt?: string;
      expirationTime?: string;
      resources?: string[];
      /** Canonical SIWS message (patched by SuiSiwsInspector). */
      canonicalMessage?: string;
    }
  | {
      kind: "signMessage";
      address: string;
      display: "utf8" | "base64";
      messageLength: number;
      messagePreview?: string;          // 16-char cap, utf8 mode only
    }
  | {
      kind: "signTransaction";
      mode: "sign-only" | "sign-and-execute";
      network: SuiNetwork;
      /** Base64 BCS — agent may decode for its own analysis. */
      transactionB64: string;
      sender?: string;
      gasOwner?: string;                // ≠ sender ⇒ sponsored
      sponsored: boolean;               // derived: gasOwner !== sender
      gasBudgetMist?: string;           // bigint → string
      gasPriceMist?: string;            // bigint → string
      inputArgumentCount?: number;
      decoded: Array<{
        kind: SuiDecodedCommand["kind"];
        /** Human-readable summary, never raw secrets. */
        summary?: string;
        /** Raw decoded fields, JSON-safe. */
        data?: Record<string, string | number | string[]>;
      }>;
      simulation?: {
        status: "success" | string;
        gasUsedTotalMist?: string;       // sum of computation+storage−rebate
        balanceChangeCount: number;
        objectChangeCount: number;
        warnings: SuiSimulationWarning[];
      };
      options?: SuiTxOptions;
    }
  | { kind: "switchNetwork"; from: SuiNetwork; to: SuiNetwork }
  | { kind: "unknown" };

export function buildAgentContext(
  intent: ApprovalIntent<SuiApprovalPayload>,
): AgentIntentContext;
```

The `MoveCall` summary line is the highest-leverage signal — surface it
verbatim:

```
MoveCall 0x<package>::<module>::<function> argc=<n> typeArgs=<m>
```

so the AI can heuristically flag unknown packages, suspicious entry
functions (`set_admin`, `transfer_cap`, `migrate`), or upgrade-cap
movements without re-decoding the BCS itself.

### 11.5.3 `redactParams` Sui branches

Add these to `services/bridge/redact.ts:130-255`. Same property as the
Solana branches at `:174-249`: the redacted payload carries enough
structural information to debug an issue but never the secret-bearing
fields.

```ts
// In redactParams, before the final `return params;`:

if (method === "sui:signPersonalMessage") {
  const [input] = paramsArr;
  if (input && typeof input === "object") {
    const o = input as { account?: { address?: string }; message?: string };
    const m = typeof o.message === "string" ? o.message : "";
    return [{
      address: o.account?.address,
      messageLength: m.length,
      // Same 16-char preview cap as Solana — enough to disambiguate
      // SIWS variants without leaking the full claim text.
      messagePreview: m.length > 16 ? `${m.slice(0, 16)}…` : m,
    }];
  }
  return [redactMessage(input)];
}

if (
  method === "sui:signTransaction" ||
  method === "sui:signAndExecuteTransaction" ||
  method === "sui:signTransactionBlock" ||                  // legacy alias
  method === "sui:signAndExecuteTransactionBlock"           // legacy alias
) {
  const [input] = paramsArr;
  if (input && typeof input === "object") {
    const o = input as {
      account?: { address?: string };
      chain?: string;
      transaction?: string;            // base64 BCS
      options?: unknown;
    };
    return [{
      address: o.account?.address,
      chain: o.chain,
      txBytes: typeof o.transaction === "string" ? o.transaction.length : 0,
      hasOptions: !!o.options,
    }];
  }
  return [redactMessage(input)];
}

if (method === "sui:reportTransactionEffects") {
  // Effects payload may be very large. Log shape only — no contents.
  const [input] = paramsArr;
  if (input && typeof input === "object") {
    const o = input as { effects?: string; account?: { address?: string }; chain?: string };
    return [{
      address: o.account?.address,
      chain: o.chain,
      effectsBytes: typeof o.effects === "string" ? o.effects.length : 0,
    }];
  }
  return params;
}

if (method === "takumi:switchNetwork") {
  // No secrets in this payload; pass through intact (parity with takumi:switchCluster).
  return params;
}
```

`standard:connect` and `standard:disconnect` are universal across all
namespaces; the existing `standard:connect` branch at `services/bridge/redact.ts:242-249`
already covers Sui without changes.

### 11.5.4 On-demand "agent" inspector — Sui readiness checklist

When the agent inspector lands (separate spec, future milestone):

- [ ] Inspector registers without `namespaces` filter so it applies to every chain (most likely).
- [ ] Inspector reads `intent` and dispatches per-namespace via a registry of `buildAgentContext` builders. Solana provides one; Sui must too. EVM landing later closes the gap.
- [ ] Output annotations conform to `IntentAnnotation` shape so the existing `RiskBanner` renders them.
- [ ] Inspector runs in `mode: "on-demand"` — the auto pipeline does NOT send every intent to a remote LLM (cost + latency + privacy). User explicitly opts in via the pill.

The Sui side of this work is **purely the `agentContext.ts` builder + tests**. No inspector code lives in `services/chains/sui/` — the inspector is universal and consumes the per-chain context builder.

### 11.5.5 Agent-mode write path (intent submission)

The agent already has the seam to submit Sui intents via `DappBridge.submitAgentIntent`
(`:319-353`). For each agent-side write tool defined in
`services/agent-executors/sui.ts` (wallet-kit spec §7.2 — `send_sui`,
`send_sui_coin`):

1. Tool builds a `Transaction` via `@mysten/sui/transactions`.
2. `await tx.build({ client })` produces base64 BCS.
3. Tool constructs an `ApprovalIntent` with:
   ```ts
   {
     id, namespace: "sui", kind: "signTransaction",
     origin: { url: "agent://takumi", title: "Takumi AI", via: "agent" },
     wallet: <active sui wallet>,
     payload: { mode: "sign-and-execute", address, network, transaction: <base64> },
     annotations: [],
     createdAt: Date.now()
   }
   ```
4. Calls `bridge.submitAgentIntent(intent)`. The pipeline runs the auto inspectors (PTB decoder, simulation), the renderer dispatches on `via === "agent"` → `AgentCardRenderer` (`renderers.ts:21-24`), and the user approves / rejects on a card surface different from the dApp sheet.
5. `executeApproval` runs the same sign path the dApp branch uses. No code branch in the adapter for "agent" vs "dApp" origin — the only difference is the renderer.

This means agent writes inherit every safety property of dApp signing
(simulation warnings, decoded PTB display, biometric-on-connect, redaction)
without any Sui-specific code in `AgentMode.tsx`.

### 11.5.6 Test coverage

| Test | Mechanism |
|---|---|
| `buildAgentContext` round-trips through `JSON.stringify` without throwing on bigints. | Pure test, mirror `services/chains/solana/agentContext.test.ts:40-65`. |
| `buildAgentContext` for `signMessage` truncates `messagePreview` to 16 chars and only in `display === "utf8"` mode. | Pure test. |
| `buildAgentContext` for `signTransaction` sets `sponsored: true` iff `gasOwner !== sender`. | Pure test. |
| `redactParams("sui:signTransaction", …)` strips the base64 transaction and keeps only `txBytes` length + address + chain. | Pure test, mirror Solana branch tests. |
| `redactParams("sui:signPersonalMessage", …)` keeps a 16-char preview and `messageLength` only. | Pure test. |
| `submitAgentIntent` for a Sui sign-and-execute intent renders via `AgentCardRenderer` (not `SuiTransactionSheet`). | Component test against the renderer registry. |
| End-to-end with a stub agent inspector registered as `name: "agent"`: clicking the pill in `ApprovalShell` calls `runOnDemandInspector("agent", id)` and patches the intent annotations. | Existing integration shape; just verify Sui intent flows through. |

---

## 12. Testing

| Test | Mechanism |
|---|---|
| Adapter dispatch table — every Wallet Standard method routes to the right intent kind. | Table-driven `SuiAdapter.test.ts` mirroring `SolanaAdapter.errorCodes.test.ts`. |
| Connect silent path returns prior grant without sheet. | Stub `PermissionStore.isGranted` true / false. |
| Cross-namespace trust rejection — EVM grant does not silently authorise Sui connect. | Seed an EVM grant for the origin, fire `standard:connect({silent:true})`, expect `rpcError(4100)`. |
| Legacy `sui:signTransactionBlock` rewrites to `sui:signTransaction` and dev-warns once. | Spy on the switch + console.warn. |
| `sui:reportTransactionEffects` returns `{ ok: true }` without spawning a sheet. | Assert `pendingIntentsStore.snapshot.length === 0` after dispatch. |
| Wallet Standard handshake — `register-wallet` + `app-ready`, account shape, feature surface. | `services/chains/sui/__wallet-standard-lint.ts` — node test runner, mirror `__wallet-standard-lint.ts` for Solana. |
| Origin pin rejects sub-frame forgery. | DappBridge integration test (extend the existing one). |
| Session-nonce ring accepts post-rotation requests with prior nonce. | DappBridge unit test. |
| `SuiPtbDecoderInspector` decodes a known PTB containing `MoveCall + TransferObjects`. | Hard-code a base64 PTB from a fixture. |
| `SuiSimulationInspector` flags `object.delete` and `ownership.transfer-out`. | Mock `SuiClient.dryRunTransactionBlock`. |
| `SuiSiwsInspector` flags domain mismatch + expiry. | Pure parser test. |
| End-to-end with a stub WebView: connect → sign → response shape matches Wallet Standard. | RN-WebView component test (mocked `injectJavaScript`). |

`pnpm check:syntax` + `pnpm biome:check` must pass.

---

## 13. Task breakdown

Each task lands as `docs/sui-dapp-bridge-task/NN_<slug>.md`, parallel to
the wallet-kit spec's task layout.

| # | Task | Pre-reqs | Output |
|---|---|---|---|
| 00 | Verify `@mysten/sui/transactions` `Transaction.from(bytes)` round-trip in the WebView's WebKit/Chromium runtime (not Hermes — but task 00 in the wallet-kit spec already verifies Hermes). | sui-chain-support task 00 | A throw-away `app/_dev/sui-ptb-decode.tsx`. |
| 01 | `services/chains/sui/payloads.ts` + types. | wallet-kit task 01 | Type module. |
| 02 | `services/chains/sui/errorCodes.ts` (analogue of `services/chains/solana/errorCodes.ts`). | 01 | Code constants + `assertSuiErrorCode`. |
| 03 | `services/chains/sui/injectedScript.ts` + `__wallet-standard-lint.ts`. | 01 | Idempotent IIFE, lint-suite green. |
| 04 | `services/chains/sui/SuiAdapter.ts` skeleton — `getInjectedScript`, `onStateChange`, `handleRequest` switch only (no execution yet). | 02, 03 | Tests for dispatch table. |
| 05 | `installSuiSigner` + `SuiSignerFns` interface. | 04, wallet-kit task 07 | Bridge-side signer install. |
| 06 | `SuiAdapter.executeApproval` for `connect`, `signMessage`, `signIn`, `switchNetwork`. | 05 | Per-intent integration tests. |
| 07 | `SuiAdapter.executeApproval` for `signTransaction` (sign-only) + `signTransaction` (sign-and-execute). | 06 | Round-trip test against `Ed25519Keypair.signTransaction` from `@mysten/sui/cryptography`. |
| 08 | `SuiPtbDecoderInspector`. | 01 | Decoder unit tests. |
| 09 | `SuiSimulationInspector` + `services/chains/sui/simulation.ts`. | 08 | Mocked-RPC tests. |
| 10 | `SuiSiwsInspector`. | 01 | Parser tests. |
| 11 | `components/dapps-browser/approvals/SuiTransactionSheet.tsx` + `SuiSignAndExecuteSheet` (or unified). | 06, 07, 08, 09 | UI snapshot tests. |
| 12 | `SuiSignPersonalMessageSheet.tsx`, `SuiSignInSheet.tsx`, `SuiSwitchNetworkSheet.tsx`. | 06, 10 | UI snapshot tests. |
| 13 | Append Sui rows to `components/dapps-browser/approvals/renderers.ts`. | 11, 12 | Trivial diff. |
| 14 | Wire `bootBridge` registration + `installSuiSigner` guard. Re-test cold/warm Fast Refresh. | 04, 05 | `services/bridge/boot.ts` diff. |
| 15 | Telemetry: extend `bridgeEventBus` consumers with `chain=sui` Sentry tags + per-method timers. Mirror Solana telemetry. | 14 | No code in adapter; sink change only. |
| 16 | **AI-readiness — `services/chains/sui/agentContext.ts` + tests** (§11.5.2). Mirror Solana's `agentContext.ts`. JSON-safe, secret-free, `MoveCall` summary line. | 01, 08 | Agent context builder + parity tests. |
| 17 | **AI-readiness — `services/bridge/redact.ts` Sui branches** (§11.5.3). `sui:signTransaction`, `sui:signPersonalMessage`, `sui:reportTransactionEffects`, legacy aliases. | 01 | Redaction branches + tests. |
| 18 | **Agent-mode write path smoke** (§11.5.5). Stub a Sui write tool that calls `submitAgentIntent`; assert it renders via `AgentCardRenderer`, runs the auto inspectors, and the executeApproval signs through `getSuiSignerForWallet`. | 07, 14 | Integration test only — production agent tools are owned by the wallet-kit spec §7.2. |
| 19 | Manual smoke against three live Sui dApps (Cetus, Suilend, Navi) using the dev WebView. Document each one's quirks (e.g., reactive re-discovery patterns) in `docs/sui-dapp-bridge-task/19_dapp-quirks.md`. | 14 | Quirks doc. |
| 20 | Flip `FEATURE_SUI_DAPP_BRIDGE` (the constant introduced by the wallet-kit spec §5) from `false` to `true` in `services/bridge/boot.ts`. Single-line diff PR. | 14, 15, 16, 17, 19 | Ship. |

---

## 14. Risks & open questions

| Risk | Mitigation |
|---|---|
| `@mysten/sui/transactions` `Transaction.from(bytes)` API surface differs between SDK minor versions (`tx.getData().commands` vs `tx.blockData.transactions`). | Task 00 verifies; pin SDK version in `package.json`. Decoder reads through a thin shim that supports both shapes during the transition. |
| Some Sui dApps still drive the legacy `sui:signTransactionBlock` API and expect the legacy response shape (`{ transactionBlockBytes, signature }`) instead of the current `{ bytes, signature }`. | Adapter detects the legacy method and returns the legacy shape. One-release dev warning so we know when to retire the alias. |
| Sui dApp Kit re-discovers wallets on hydration AFTER our first `register-wallet` dispatch. dApps that rely on hydration-time discovery (Sui Foundation reference apps) won't see TakumiPay. | The `app-ready` listener in §5.3 covers this — verified via the Solana precedent which solves the same class of bug. Task 16 confirms with three live dApps. |
| `dryRunTransactionBlock` is rate-limited on the public mainnet RPC. | Use the same `MultiProvider` / token-bucket pattern as `services/rpc/`. Defer until QA hits a limit. |
| The `transaction` argument can be a `Transaction` instance whose `.toJSON()` returns a Promise that itself awaits an RPC call (`tx.build({ client })` lazily resolves coin objects). The shim's `await t.toJSON()` will hit the network — and may time out under bad connectivity. | Document the timeout. The shim does not catch — the dApp's existing error handling for "transaction build failed" surfaces the issue. We do NOT replace `client` from inside the shim; that's the dApp's responsibility. |
| Sponsored transactions (`gasOwner !== sender`) require the dApp to provide an additional sponsor signature; if not present, `executeTransactionBlock` fails. | Decoder annotates `sponsored=true`; sheet renders a "sponsor required" notice. Adapter still signs the user portion — submission failure surfaces to the dApp via `executeTransactionBlock`'s rejection. |
| `sui:reportTransactionEffects` payloads may be large (full effects JSON). | Adapter ignores payload content; logs only the digest. No retention. |

### Resolved decisions (locked 2026-05-05)
1. **No `window.sui` legacy global.** Wallet Standard discovery only.
2. **No `signAllTransactions`.** Wallet Standard Sui has none; PTBs express batches natively.
3. **Default network is `sui:mainnet`.** Matches the wallet-kit spec.
4. **Explorer URL builder is the wallet kit's job** (`SuiWalletKit.buildTxExplorerUrl`); the adapter does not duplicate.
5. **`takumi:switchNetwork`** is a TakumiPay extension — not part of Wallet Standard. dApps that don't know about it never call it; the shim still exposes it for our own internal flows (e.g., the address-bar network picker pushing into the adapter).
6. **`sui:reportTransactionEffects` is a no-op resolver** in v1. Wire it because absence breaks Wallet Standard feature-completeness checks in some dApp libraries.

---

## 15. Roll-out plan

1. **PR 1 (this spec)** — land the spec + empty `docs/sui-dapp-bridge-task/` files.
2. **PR 2 (tasks 01–04)** — payloads, error codes, injected script, adapter skeleton. Adapter still returns `-32601` for everything; injected script announces but doesn't sign.
3. **PR 3 (tasks 05–07)** — `installSuiSigner` + `executeApproval` for connect / signMessage / signIn / signTransaction (both modes) / switchNetwork. Behind `FEATURE_SUI_DAPP_BRIDGE=false` so dApps still see `-32601`.
4. **PR 4 (tasks 08–10)** — inspectors. No user-visible change yet.
5. **PR 5 (tasks 11–13)** — approval sheets. Sheets compile but unreachable until task 20.
6. **PR 6 (tasks 14, 15)** — boot wiring + telemetry.
7. **PR 7 (tasks 16, 17, 18)** — AI-readiness: `agentContext.ts`, `redact.ts` Sui branches, agent-mode write-path smoke. Lands BEFORE the bridge goes live so the on-demand "agent" inspector (future milestone) finds Sui ready when it ships. |
8. **PR 8 (task 19)** — dApp quirks document. Manual sign-off.
9. **PR 9 (task 20)** — flip `FEATURE_SUI_DAPP_BRIDGE` to `true`. Sui dApp explorer is live.

---

## 16. Future work (not in this milestone)

- `takumi:watchCoin` extension — Sui's analogue of `wallet_watchAsset`. Includes Token-2022-style on-chain verification of CoinType + decimals before the sheet renders.
- Sponsored-transaction renderer that lets the user inspect the sponsor's portion of the PTB and toggles a "trust sponsor" checkbox.
- zkLogin path — different dwell site, different `getInjectedScript` injectee (no local secret), different connect flow. New spec.
- Multisig accounts — exposes one of N as the dApp-facing identity; signing fans out to other signers (out-of-band).
- SuiNS reverse lookup in the connect sheet ("you are connecting as `alice.sui` (`0x...`)").
- Full `sui:reportTransactionEffects` integration — invalidate TanStack Query keys observed by the in-app portfolio screen on dApp-confirmed effects, so the user's balance snaps to truth without polling.
- WalletConnect over Sui — `services/walletconnect/` build-out for Sui sessions; CAIP-27 method routing.
