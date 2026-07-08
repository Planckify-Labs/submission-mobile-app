# Stellar dApp bridge — engineering spec

**Status:** Ready for implementation (protocol source-verified, §17;
Task 00's on-device Hermes gate cleared by the user 2026-07-08, §10.1
— no open blockers to starting task 01)
**Author:** Claude (protocol design grounded in SEP-0043 and Freighter's
own source, fetched directly from `github.com/stellar/stellar-protocol`
and `github.com/stellar/freighter` — not recalled from training data or
skill summaries alone; see §17 Sources. Cross-checked against this
repo's shipped Sui dApp-bridge implementation and the already-landed
Stellar chain-support code.)
**Date:** 2026-07-08
**Companion specs:**
- `docs/stellar-chain-support-spec.md` — wallet-kit + agent surface.
  **Already landed** (see §2.1) — this spec activates the
  `StellarAdapter` / `injectedScript.ts` / `signer.ts` scaffolds it left
  disabled behind `FEATURE_STELLAR_DAPP_BRIDGE = false`
  (`services/bridge/boot.ts:187`).
- `docs/sui-dapp-bridge-spec.md` — the structural precedent this spec
  mirrors (same ports: `ChainAdapter`, `ApprovalIntent`,
  `InspectorRegistry`, `ApprovalHost`). Stellar's wallet standard
  (SEP-0043, §1.1) defines an *interface*, not a discovery protocol the
  way Solana/Sui's Wallet Standard does — so the **architecture** here
  is identical to Sui's, but the **transport** (§1.2) is not.
- `docs/dapp-bridge-spec.md` — the original two-port design
  (`ChainAdapter` + `ApprovalHost`) this spec docks into unchanged.

---

## 0. Goal & non-goals

### Goal
Light up the Stellar dApp-bridge surface so that a third-party Stellar
dApp opened inside the in-app WebView explorer (`app/dapps-browser.tsx`)
sees TakumiPay as a wallet conforming to **SEP-0043 "Standard Web Wallet
API Interface"** — Stellar's ecosystem-wide wallet standard — via the
concrete transport its reference implementation (Freighter) actually
uses (§1), with **zero dApp-side integration work required**. This
resolves the "research spike" `docs/stellar-chain-support-spec.md`
explicitly deferred (§5, §11 risk row 2: *"no ratified Stellar
injected-provider standard … Freighter's `window.freighterApi` shape vs
'Stellar Wallets Kit' — needs its own research spike before
implementation"*) — the outcome of that spike, source-verified in §1,
is that a ratified standard (SEP-0043) does exist at the interface
level, and Freighter's own `postMessage`-based content-script transport
is how to actually reach it.

Concretely:
1. A Stellar dApp using `@stellar/freighter-api` directly, or
   `@creit.tech/stellar-wallets-kit` with its Freighter module enabled
   (the default in `allowAllModules()`), auto-detects and connects to
   TakumiPay's injected wallet the same way it would detect the
   Freighter browser extension.
2. `requestAccess()` → a TakumiPay `ConnectSheet` approval.
3. `signTransaction(xdr, opts)` → a TakumiPay `StellarTransactionSheet`
   approval that decodes the XDR envelope into human-readable operations
   before the user signs — sign-only by default, sign-and-submit if the
   dApp opts in via SEP-0043's `submit`/`submitUrl` (§1.8).
4. The same choke-point guarantees every other chain already gets:
   origin pinning (TWV-2026-013), session-nonce validation
   (TWV-2026-015), the `InspectorRegistry` pipeline, redacted telemetry,
   and (once the future universal on-demand agent inspector ships) an
   "Ask Takumi AI to review" pill with zero additional Stellar-specific
   inspector code (§11.5).

### Non-goals (this milestone)
- **A discovery/registration event system** (the Wallet-Standard-style
  `wallet-standard:register-wallet` multi-wallet coexistence layer).
  SEP-0043 standardizes the *interface*, not discovery (§1.1) — this
  spec doesn't invent one for Stellar.
- **Soroban / SAC signing** (`signAuthEntry`, contract-invocation XDR).
  Out of scope, mirrors `stellar-chain-support-spec.md` §0's
  classic-only posture. `signTransaction` still accepts any XDR the
  dApp hands us — a Soroban `invokeHostFunction` envelope decodes as a
  generic `{kind:"other"}` operation with a plain warning banner rather
  than a rich summary; the user can still choose to sign it "blind" the
  way Freighter itself allows today.
- **A second discovery path** (Stellar Wallets Kit module listing,
  WalletConnect). Getting listed as a first-party module in
  `@creit.tech/stellar-wallets-kit` requires upstream coordination with
  Creit Tech; flagged as future work (§16), same posture as
  `docs/dapp-bridge-spec.md` §8's WalletConnect open question.
- **Transaction simulation.** Horizon has no dry-run endpoint for
  classic operations (unlike Sui/Solana RPC's `dryRunTransactionBlock`
  / `eth_call`). `StellarPreflightInspector` (§8.2) substitutes
  *targeted* Horizon reads (does the destination exist? does it hold a
  trustline?) instead of a general simulate.
- Everything already excluded by `stellar-chain-support-spec.md` §0/§13
  (multisig, path payments, sponsored reserves, muxed accounts, …).

---

## 1. Protocol reference — what "Freighter-compatible" means

**Everything in this section is fetched directly from Freighter's own
source (`github.com/stellar/freighter`, `master` branch,
`@stellar/freighter-api/src/*`, `@shared/api/*`, `@shared/constants/services.ts`,
`@shared/constants/stellar.ts`) and its official docs
(`docs/docs/guide/usingFreighterBrowser.mdx`), not recalled or assumed.**
An earlier draft of this section modeled Freighter as an EIP-1193-style
directly-callable `window.freighterApi` object — that model is **wrong**,
corrected below after reading the actual client library and its
extension-messaging transport. This is the exact class of error this
spec's own citation discipline exists to prevent, caught here by
reading source instead of shipping the assumption.

### 1.1 SEP-0043 *is* the Stellar Wallet Standard — Freighter is its reference implementation

**Stellar does have a ratified-track, ecosystem-wide wallet standard:
[SEP-0043 "Standard Web Wallet API Interface"](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0043.md)**
(fetched directly from `stellar/stellar-protocol`, `master` branch;
current version `1.2.1`; **Status: Draft**, not yet Final — check
current status before treating it as immutable, per this repo's own
`stellar-dev:standards` discipline). It defines a **required interface
shape** every conforming wallet exposes:

```ts
interface Error { message: string; code: number; ext?: string[] }

{
  getAddress: () => Promise<{ address: string } & { error?: Error }>,
  signTransaction: (xdr: string, opts?: { networkPassphrase?: string; address?: string; submit?: boolean; submitUrl?: string })
    => Promise<{ signedTxXdr: string; signerAddress: string } & { error?: Error }>,
  signAuthEntry: (authEntry: string, opts?: { networkPassphrase?: string; address?: string })
    => Promise<{ signedAuthEntry: string; signerAddress: string } & { error?: Error }>,
  signMessage: (message: string, opts?: { networkPassphrase?: string; address?: string })
    => Promise<{ signedMessage: string; signerAddress: string } & { error?: Error }>,
  getNetwork: () => Promise<{ network: string; networkPassphrase: string } & { error?: Error }>,
}
```

with a **4-code error taxonomy** (`-1` internal wallet error, `-2`
external-service error e.g. Horizon/RPC, `-3` invalid client request
e.g. malformed XDR, `-4` user rejected) — sharper than the 2 constants
(`FreighterApiInternalError`/`FreighterApiDeclinedError`) Freighter's
own source happens to name, and the taxonomy this spec's error mapping
adopts wholesale (§1.5, §11).

**Crucially, SEP-0043 defines the interface, not a discovery/transport
mechanism.** Unlike Solana/Sui's Wallet Standard (`@wallet-standard/core`),
which *also* standardizes how a dApp discovers a wallet on the page
(`wallet-standard:register-wallet` events, multi-wallet coexistence),
SEP-0043 is silent on how a dApp finds a conforming wallet at all — no
registration event, no required global name. That gap is filled in
practice by whichever transport a wallet's own client library
implements — for Freighter (the SEP's de facto reference
implementation, sharing three of its authors with SDF, and matching the
required interface almost verbatim in `@stellar/freighter-api`'s
`getAddress`/`signTransaction`/`signAuthEntry`/`signMessage`/`getNetwork`
exports) that's the content-script `postMessage` protocol in §1.2.
**Targeting Freighter's concrete transport is how this spec satisfies
SEP-0043 in practice**, not an alternative to it — Freighter's public
surface is a superset of the SEP's required interface (it adds
`requestAccess`/`isConnected`/`isAllowed`/`setAllowed`/`addToken` as its
own extensions on top), so implementing Freighter's wire protocol
faithfully (§1.2–§1.6) satisfies both "the ratified interface" and "the
wallet real dApps actually talk to" in one design, rather than forcing
a choice between them.

One concrete divergence worth flagging: SEP-0043's `signTransaction`
accepts optional `submit`/`submitUrl` fields, letting a dApp ask the
wallet to broadcast after signing — Freighter's *current* shipped
implementation (confirmed by reading `signTransaction.ts`/`external.ts`
directly, §1.4) does not send or honor these fields; its `submitTransaction`
request payload has no `submit`/`submitUrl` keys at all. This spec
adopts a **resolved decision** to honor `submit` (broadcasting when a
dApp asks) while accepting-but-ignoring `submitUrl` for security
reasons (§1.8, §16) — standards-compliant on the part that matters,
cheap to add (we already build a `Transaction` object and have
`getHorizonClient` on hand from `stellar-chain-support-spec.md`), and
it makes us **more** SEP-0043-compliant than the reference wallet
itself, at no cost to Freighter-compatibility
(dApps that never send `submit` see identical sign-only behavior).

There is no equivalent of EIP-6963's provider-conflict problem to solve
here, either: inside our own controlled WebView, our injected script is
the only script capable of responding on the shared `postMessage`
channel — there's no scenario where a second real wallet extension is
also injecting into the same page the way two browser extensions can
collide on `window.ethereum`. So this spec does **not** need a
discovery/announcement protocol at all.

### 1.2 The real transport — content-script `postMessage`, not a callable object

The actual `@stellar/freighter-api` npm package (source read directly,
`@stellar/freighter-api/src/*.ts`) is a thin client: every exported
function (`isConnected`, `getAddress`, `requestAccess`, `getNetwork`,
`getNetworkDetails`, `signTransaction`, `signMessage`, `signAuthEntry`,
`isAllowed`, `setAllowed`, `addToken`) is a wrapper that ultimately
calls `sendMessageToContentScript(msg)` in `@shared/api/helpers/extensionMessaging.ts`.
That function's entire implementation:

```ts
export const sendMessageToContentScript = (msg: Msg): Promise<Response> => {
  const MESSAGE_ID = Date.now() + Math.random();

  window.postMessage(
    { source: EXTERNAL_MSG_REQUEST, messageId: MESSAGE_ID, ...msg },
    window.location.origin
  );
  return new Promise((resolve) => {
    // ...timeout only for REQUEST_CONNECTION_STATUS / REQUEST_PUBLIC_KEY, see §1.4...
    const messageListener = (event) => {
      if (event.source !== window) return;
      if (event?.data?.source !== EXTERNAL_MSG_RESPONSE) return;
      if (event?.data?.messagedId !== MESSAGE_ID) return;   // sic — "messagedId", not "messageId"
      resolve(event.data);
      window.removeEventListener("message", messageListener);
    };
    window.addEventListener("message", messageListener, false);
  });
};
```

where (from `@shared/constants/services.ts`, fetched directly):
```ts
export const EXTERNAL_MSG_REQUEST = "FREIGHTER_EXTERNAL_MSG_REQUEST";
export const EXTERNAL_MSG_RESPONSE = "FREIGHTER_EXTERNAL_MSG_RESPONSE";
export enum EXTERNAL_SERVICE_TYPES {
  REQUEST_ACCESS, REQUEST_PUBLIC_KEY, SUBMIT_TOKEN, SUBMIT_TRANSACTION,
  SUBMIT_BLOB, SUBMIT_AUTH_ENTRY, REQUEST_NETWORK, REQUEST_NETWORK_DETAILS,
  REQUEST_CONNECTION_STATUS, REQUEST_ALLOWED_STATUS, SET_ALLOWED_STATUS,
  REQUEST_USER_INFO,   // internal-only — no public export sends this (§1.3)
}
```

**This means the real Freighter browser extension does not expose a
directly-callable API object at all.** It's a same-window
`postMessage`/`addEventListener("message")` round trip: the page (via
the npm package's bundled code) posts a request tagged
`source: "FREIGHTER_EXTERNAL_MSG_REQUEST"`, and the extension's content
script — injected into the same page, listening the same way — replies
with `source: "FREIGHTER_EXTERNAL_MSG_RESPONSE"` correlated by
`messagedId`. **Our injected script must implement the content-script
side of this exact protocol**, not define a `window.freighterApi`
object with real methods.

This is a **better** fit for a WebView-injected shim than my original
design, not a worse one: any dApp that imports `@stellar/freighter-api`
via a bundler (the dominant pattern — the same one the `stellar-dev:dapp`
skill's `useFreighter` hook example uses) ships Freighter's own
unmodified client code, which will correctly talk to our listener with
**zero knowledge that it isn't the real extension** — we never need to
reimplement the npm package's logic, only its wire contract.

### 1.3 `window.freighterApi` and `window.freighter` — what they actually are

Two separate globals, confirmed from two different sources:

1. **`window.freighter: boolean`** — read synchronously by
   `isConnected()` as a fast-path before falling back to the message
   round trip (`isConnected.ts`, fetched directly: `if (window.freighter) { return Promise.resolve({ isConnected: window.freighter }); }`).
   The real extension sets this. **We must set `window.freighter = true`.**
2. **`window.freighterApi`** — confirmed via the official docs
   (`usingFreighterBrowser.mdx`, fetched directly): *"Install the
   packaged library via `script` tag using cdnjs … This will expose a
   global variable called `window.freighterApi` that will contain our
   library … you will call the methods directly from `window.freighterApi`."*
   **The browser extension itself does not set this** — it's populated
   only when a dApp's own page loads Freighter's UMD bundle from a CDN
   `<script>` tag, and that bundle's methods are the *same* npm-package
   functions, which still round-trip through the `postMessage` protocol
   in §1.2. A dApp using this integration path loads its own script
   (from `cdnjs`, over real internet, inside our WebView — nothing for
   us to intercept) and that script talks correctly to our
   content-script-style listener automatically. **We do not need to
   inject `window.freighterApi` as an object for this path to work.**

We still define a minimal `window.freighterApi` convenience object
ourselves (§5.5) as a defensive measure for naive dApp code that checks
`typeof window.freighterApi !== "undefined"` directly without loading
either the npm package or the CDN script — cheap to add, only helps,
never load-bearing for the primary compatibility story.

### 1.4 Wire-level request/response shapes — confirmed from `@shared/api/types/types.ts` and `external.ts`

Request envelope (posted by the dApp's own bundled Freighter client
code): `{ source: "FREIGHTER_EXTERNAL_MSG_REQUEST", messageId: number, type: EXTERNAL_SERVICE_TYPES, ...args }`.

Response envelope our shim must post: `{ source: "FREIGHTER_EXTERNAL_MSG_RESPONSE", messagedId: <the request's messageId>, ...resultFields, apiError?: FreighterApiError }`
— **the error field is named `apiError`, not `error`**, at this wire
layer (the npm package's public functions remap `response.apiError` to
their own public `error` field before returning to the dApp — that
remapping is Freighter's own code, already shipped in every bundling
dApp; we only need to speak the wire format, not the public-function
shape).

```ts
export interface FreighterApiError {
  code: number;
  message: string;
  ext?: string[];
}
```
Canonical instances (fetched directly, `extensionMessaging.ts`):
```ts
FreighterApiDeclinedError = { code: -4, message: "The user rejected this request." };
FreighterApiInternalError = { code: -1, message: "The wallet encountered an internal error. Please try again or contact the wallet if the problem persists." };
```

| `type` (`EXTERNAL_SERVICE_TYPES`) | Request fields beyond `type` | Response fields (beyond `apiError?`) | Maps to `@stellar/freighter-api` public function |
|---|---|---|---|
| `REQUEST_ACCESS` | — | `{ publicKey: string }` | `requestAccess()` |
| `REQUEST_PUBLIC_KEY` | — | `{ publicKey: string }` | `getAddress()` |
| `REQUEST_NETWORK_DETAILS` | — | `{ networkDetails: { network, networkUrl, networkPassphrase, sorobanRpcUrl? } }` | **Both** `getNetwork()` and `getNetworkDetails()` — confirmed by reading `external.ts`'s `requestNetwork()`, which itself sends `type: EXTERNAL_SERVICE_TYPES.REQUEST_NETWORK_DETAILS` (not the enum's separate `REQUEST_NETWORK` value, which exists but is unused by any current public export). One handler covers both public methods. |
| `REQUEST_CONNECTION_STATUS` | — | `{ isConnected: boolean }` | `isConnected()`'s fallback path (rarely reached — `window.freighter` fast-path answers first, §1.3). |
| `REQUEST_ALLOWED_STATUS` | — | `{ isAllowed: boolean }` | `isAllowed()`, and internally by `signMessage()`/`signAuthEntry()`'s own pre-flight (§1.6). |
| `SET_ALLOWED_STATUS` | — | `{ isAllowed: boolean }` | `setAllowed()`. |
| `SUBMIT_TRANSACTION` | `{ transactionXdr, network?, networkPassphrase?, accountToSign? }` | `{ signedTransaction: string, signerAddress: string }` | `signTransaction(xdr, opts)` — **resolved shape is `{ signedTxXdr, signerAddress }`, both fields; not `signedTxXdr` alone** (a real gap in the earlier draft, corrected here). |
| `SUBMIT_BLOB` | `{ blob, apiVersion, networkPassphrase?, accountToSign? }` | `{ signedBlob: string \| null, signerAddress: string }` | `signMessage(message, opts)` — **confirmed to exist**, not "pending" (§1.6). |
| `SUBMIT_AUTH_ENTRY` | `{ entryXdr, apiVersion, networkPassphrase?, accountToSign? }` | `{ signedAuthEntry: string \| null, signerAddress: string }` | `signAuthEntry(entryXdr, opts)` — **confirmed to exist**; deliberately declined regardless, §0 Soroban non-goal. Our handler must still respond (never hang) — see §1.5. |
| `SUBMIT_TOKEN` | `{ contractId, networkPassphrase? }` | `{ contractId: string }` | `addToken(args)` — confirmed to exist; optional/stretch, §16. |
| `REQUEST_USER_INFO` | — | — | **No public export sends this.** Confirmed by reading `index.ts`'s full export list — `getUserInfo` does not exist as a callable. Not implemented; not "pending," genuinely out of scope. |

`accountToSign` (from `opts.address` on the public function) lets a
multi-account Freighter user pick which of several accounts signs.
Since our adapter connects exactly one address per origin (§1.7), our
handler validates `accountToSign` (if present) equals the granted
address and responds `apiError: FreighterApiDeclinedError`-shaped
otherwise, rather than silently signing with a different wallet — same
"never sign with a different wallet than what was requested" invariant
as `[[feedback_dapp_bridge_isolation]]`.

### 1.5 The non-throwing contract — and why it's narrower than originally assumed

The `{data, error}`-never-throws behavior dApps see is enforced by
Freighter's **own already-shipped npm package code** (every public
function wraps its `sendMessageToContentScript` call and always returns
a resolved object) — not something our shim has to re-implement at that
layer. What **our** shim is responsible for is narrower and more
concrete: **always eventually post a `FREIGHTER_EXTERNAL_MSG_RESPONSE`
for every `FREIGHTER_EXTERNAL_MSG_REQUEST` we receive.**

This matters because of an asymmetry visible directly in
`sendMessageToContentScript`'s source (§1.2): **only** `REQUEST_CONNECTION_STATUS`
and `REQUEST_PUBLIC_KEY` get a client-side 2000ms timeout that resolves
automatically if nothing answers (Freighter's own comment: *"In the
case that Freighter is not installed at all, any messages to background
from freighter-api will hang forever … especially a problem for the
isConnected method"*). **Every other message type has no client-side
timeout at all** — if our shim fails to respond to a `SUBMIT_TRANSACTION`
or `REQUEST_ACCESS` request (a bridge-side crash, an unhandled promise
rejection in our own dispatch code, a native-side timeout with no
fallback post), the dApp's `await signTransaction(...)` call **hangs
forever**, not fails gracefully. This is the real, source-confirmed
version of the invariant §11 names — narrower than "never reject a
promise" (that was never the actual risk, since we control both ends of
our own `bridge_request`/`bridge_response` transport underneath), and
sharper: **every dispatch path in `StellarAdapter.handleRequest` must
guarantee a `postMessage` response, including on internal error,** with
`try/catch` at the shim's outermost layer as the backstop.

### 1.6 `signMessage`/`signAuthEntry`'s built-in pre-flight — free orchestration

Reading `signMessage.ts` and `signAuthEntry.ts` directly reveals both
already call `requestAllowedStatus()` (→ `REQUEST_ALLOWED_STATUS`) and,
if not allowed, `requestAccess()` (→ `REQUEST_ACCESS`) **before**
sending the actual sign request — entirely inside the npm package's own
client code, already shipped in every dApp that bundles it. This means
a dApp calling `signMessage()` without a prior explicit `requestAccess()`
still triggers our connect sheet first, automatically, as long as our
`REQUEST_ALLOWED_STATUS` and `REQUEST_ACCESS` handlers are correct — no
orchestration logic needs to be written on our side; it falls out of
implementing the individual message handlers correctly.

### 1.7 Single account, not an accounts array

EVM's `eth_requestAccounts`, Solana's Wallet Standard `connect`, and
Sui's `standard:connect` all return an **array** of accounts (even if
today's adapters only ever populate one). Freighter's `getAddress()` /
`requestAccess()` return a **single address string**. `StellarConnectPayload`
and the adapter's `executeApproval` return shape follow suit (§4.4,
§6) — no array wrapping, no "requestedAccounts: number" field the way
`EvmConnectPayload` has. This also means the shared `ConnectSheet` gets
no wallet-count picker for Stellar the way it might for a
multi-account-per-connect namespace — it always resolves to "the
connected Stellar wallet," consistent with how Freighter itself has
exactly one active account concept.

### 1.8 Sign-only by default, optional submit per SEP-0043

Sui's Wallet Standard has both `sui:signTransaction` (sign-only) and
`sui:signAndExecuteTransaction` (sign + broadcast), and the Sui adapter
branches on which the dApp called (Sui spec §4.4). Freighter's *shipped*
transport has only one signing primitive and never broadcasts (§1.4) —
but SEP-0043's ratified interface (§1.1) adds optional `submit`/`submitUrl`
fields to `signTransaction` precisely for this case. **Resolved
decision:** `StellarAdapter.executeApproval` signs via
`installStellarSigner` (§10) and, **only when `opts.submit === true`**,
additionally submits the signed transaction to the **connected wallet's
own configured `chain.horizonUrl`** — `opts.submitUrl` is accepted per
the SEP-0043 shape but deliberately **ignored** for the actual submit
target (§16): honoring an arbitrary dApp-supplied endpoint would let a
malicious dApp redirect the wallet's own broadcast to an endpoint it
controls. Default (`submit` absent/`false`) stays sign-only, byte-identical
to Freighter's own behavior — no dApp built against Freighter's current
implementation notices a difference; a dApp written against SEP-0043's
full interface gets real sign-and-submit for free. `executeApproval`'s
return shape gains an optional `hash` field, populated only on the
submit path (§4.3, §6).

---

## 2. Where this slots into the codebase

The space-docking shape is unchanged from every other chain — verified
against the actual current source, not assumed:

```
                       ┌────────────────────────────────────┐
WebView injected JS ◀─ │ a.getInjectedScript(ctx)            │
(window.freighterApi   │ a ∈ ChainAdapterRegistry.list()     │
 shim — no discovery   └─────────────┬────────────────────────┘
 event needed, §1.5)                 │
        bridge_request ──▶ DappBridge.dispatch      (services/bridge/DappBridge.ts)
                                     │
                  ChainAdapterRegistry.get("stellar").handleRequest
                                     │
                       ┌─────────────┴──────────────────────┐
                       │ ChainResult                         │
                       │   resolved | needs-approval | error │
                       └─────────────┬──────────────────────┘
                                     │
                        InspectorRegistry.runPipeline
                                     │
                       pendingIntentsStore.push
                                     │
                                     ▼
                       ApprovalHost finds matching renderer
                       in `evmRenderers` (components/dapps-browser/approvals/renderers.ts)
                                     │
                                     ▼
                       User decision → adapter.executeApproval
                                     │
                                     ▼
                       StellarSignerFns (registered by installStellarSigner)
                                     │
                                     ▼
                       getStellarSignerForWallet   ← ALREADY LANDED
                       (services/walletService.ts:613)
```

### 2.1 Existing scaffolding — verified, not assumed

Unlike the Sui dApp-bridge spec (written when `services/chains/sui/`
and `services/walletKit/sui/` were empty directories), this spec builds
on an **already-shipped, non-scaffold foundation** — landed in
`8fad7b0 feat(stellar): add Stellar chain support`:

| Piece | State |
|---|---|
| `services/walletKit/stellar/StellarWalletKit.ts` | **Implemented**, registered in `services/walletKit/boot.ts`. |
| `services/walletService.ts#getStellarSignerForWallet` (line 613) | **Implemented.** Returns a `@stellar/stellar-base` `Keypair \| null`, cached by address in `stellarSignerCache`, re-verifies the cached keypair still derives to `wallet.address` on every call (TWV-2026-090), wiped by `clearAccountCache()`. This is the exact dwell site `installStellarSigner` docks into (§10) — the bridge signer file does **not** need a new capability on `StellarWalletKit`; it calls this directly, mirroring how `installSuiSigner` calls `kit.getSignerForWallet` and then does the raw `@mysten/sui` sign call itself rather than adding a bridge-specific method to `SuiWalletKit`. |
| `constants/configs/chainConfig.ts` — `StellarChainConfig` | **Implemented** (`namespace: "stellar"`, `network: "mainnet" \| "testnet"`, `horizonUrl`, optional `rpcUrl` reserved for Soroban). |
| `services/chains/stellar/StellarAdapter.ts` | **Scaffold.** `handleRequest` always returns `{status:"error", code:4200, message:"Stellar dApp bridge not enabled in this build"}`. This spec replaces the body. |
| `services/chains/stellar/injectedScript.ts` | **Scaffold.** Returns `"/* stellar injected provider not enabled */"`. This spec replaces the body. |
| `services/chains/stellar/signer.ts` | **Scaffold.** `installStellarSigner()` is a no-op dev-warning. This spec replaces the body, mirroring `services/chains/sui/signer.ts`'s `installSuiSigner`. |
| `services/bridge/boot.ts:182-190` | Registers `createStellarAdapter()` **only if** `FEATURE_STELLAR_DAPP_BRIDGE` (line 187) is `true`. Currently `false`. This spec's roll-out (§15) flips it once QA passes. |
| `services/permissions/store.ts#namespaceForChainKey` (line 49-54) | **Gap.** Falls through to `"eip155"` for any `chainId` that isn't `number`, doesn't start with `"solana"`, or doesn't start with `"sui"` — a Stellar grant's `"stellar:pubnet"` chainId would silently misclassify. This spec adds the missing branch (§9). |

**Net effect:** this spec is narrower in scope than the Sui dApp-bridge
spec was — no wallet-kit dependency to wait on, no `walletKitRegistry.has("stellar")`
uncertainty (`stellar-chain-support-spec.md` task 09 already registered
it), the protocol is source-verified (§1) rather than researched-on-the-fly,
and the one remaining on-device empirical question (the Hermes
XDR-decode/hex-encode round-trip, §10.1) is now **confirmed working**
by the user. No open unknowns block starting implementation.

### 2.2 Space-docking audit

Per `[[feedback_space_docking]]`: shared code never branches on chain
namespace; a chain docks by implementing an interface, and its
namespace value is only ever *data* a registry looks up or a renderer's
`canHandle` predicate matches against — never a `namespace === "stellar"`
branch inside `DappBridge.ts`, `ApprovalHost.tsx`, or any shared hook.
Checked explicitly against every file this spec touches, not assumed:

| Port | How Stellar docks | Shared-code change required? |
|---|---|---|
| `ChainAdapterRegistry` (`services/chains/registry.ts`) | `StellarAdapter` implements `ChainAdapter`, registered by `createStellarAdapter()` in `boot.ts` (§10) — the same one-line-per-namespace registration Solana/Sui use. | **None.** `DappBridge.dispatch` resolves `registry.get(req.namespace)` generically; it has never had, and does not gain, a `namespace === "stellar"` branch. |
| `getInjectedScript(ctx)` (part of the `ChainAdapter` interface) | Returns an arbitrary JS string — Stellar's implementation (§5) happens to use a fundamentally different wire protocol (`postMessage` content-script emulation) than Solana/Sui's (direct `window` object assignment). | **None.** This is the clearest evidence the port is doing its job: the interface only promises "a string of JS," not a specific transport shape, so an entire different protocol docks without touching `app/dapps-browser.tsx` (which just concatenates every adapter's script, §2) or any other adapter's file. |
| Signing capability | `installStellarSigner` (§10) resolves `getStellarSignerForWallet` — an existing, already-shipped dwell site (`services/walletService.ts:613`) — directly. No new method added to `WalletKitAdapter`/`StellarWalletKit` (§14 resolved decision 6). | **None.** Exactly the "bridge calls the raw SDK primitive via the kit's existing signer accessor" pattern `installSuiSigner` already established — not a new capability, so not a new optional method to add or presence-check. |
| `ApprovalRenderer` registry (`components/dapps-browser/approvals/renderers.ts`) | New `{canHandle, Component}` entries keyed on `i.namespace === "stellar" && i.kind === "..."` (§7.1) — the identical shape every EVM/Solana/Sui row already uses. `connect` and `via === "agent"` rows are already namespace-agnostic and need no Stellar-specific edit. | **None** beyond appending rows — `ApprovalHost` itself has no per-namespace logic; it just picks the first matching renderer. |
| `InspectorRegistry` (`services/bridge/boot.ts`) | Two new inspectors (§8) registered the same way `SuiPtbDecoderInspector`/`SuiSimulationInspector` were — each inspector's own `inspect()` checks `intent.namespace === "stellar"` internally to decide whether it applies, exactly mirroring the Sui inspectors' own self-scoping. | **None** — the pipeline (`runPipeline`) is namespace-agnostic; only each inspector's own file knows which namespace it cares about. |

**One near-miss, resolved as a non-violation:** `namespaceForChainKey`
(`services/permissions/store.ts:49-54`, §9) gets a new
`if (chainId.startsWith("stellar")) return "stellar";` branch. This
*looks* like a namespace branch in shared code, but it isn't the kind
`[[feedback_space_docking]]` forbids — the function's entire job is
"given an opaque `chainId` string, recover which namespace produced
it," so a namespace check is the function's actual contract, not a
capability dispatch. The file's own header comment already carves this
out ("Lives here… outside the `check:chains` guard") for the same
reason Solana's and Sui's existing branches in the same function
aren't violations either — this spec's addition is one more line in an
already-established exemption, not a new one.

---

## 3. Files this spec adds / modifies

### 3.1 New files
```
services/chains/stellar/
  payloads.ts                  # StellarConnectPayload, StellarSignTransactionPayload,
                                #   StellarDecodedOperation, StellarSignMessagePayload
  xdrDecode.ts                 # decode an XDR envelope into StellarDecodedOperation[];
                                #   consumed by both the inspector (§8.1) and the sheet's
                                #   fallback path if the inspector timed out
  errorCodes.ts                # dApp-bridge error codes — the SEP-0043 4-code taxonomy
                                #   (§1.1), mirrors solana/sui errorCodes.ts's role;
                                #   distinct from chains/stellar/errorCodes.ts's
                                #   StellarNoTrustlineError family, which are wallet-kit
                                #   send/trustline errors, not bridge RPC errors
  agentContext.ts              # buildAgentContext(intent) — JSON-safe view for the future
                                #   universal on-demand agent inspector (§11.5)
  payloads.test.ts
  xdrDecode.test.ts
  injectedScript.test.ts       # Freighter-protocol lint suite (§5.6) — asserts the
                                #   postMessage request/response contract (§1.4)
  StellarAdapter.test.ts
  agentContext.test.ts

services/bridge/inspectors/
  StellarXdrDecoderInspector.ts    # priority 15 — pure decode, no RPC
  StellarPreflightInspector.ts     # priority 20 — targeted Horizon reads (§8.2)

components/dapps-browser/approvals/
  StellarTransactionSheet.tsx
  StellarSignMessageSheet.tsx
```

### 3.2 Modified files (replacing scaffold bodies)
```
services/chains/stellar/StellarAdapter.ts   # real handleRequest/executeApproval (§4)
services/chains/stellar/injectedScript.ts   # real postMessage listener (§5)
services/chains/stellar/signer.ts           # real installStellarSigner (§10)
```

### 3.3 Other modified files
| File | Change |
|---|---|
| `services/bridge/boot.ts:182-190` | Flip `FEATURE_STELLAR_DAPP_BRIDGE` to `true` (last task, §15); call `installStellarSigner({...})`, mirroring the Sui block at `:153-180` exactly — resolve the signer once at install time via `getStellarSignerForWallet`'s existing dwell site, guard on... actually Stellar's kit is *already* registered (§2.1), so no `walletKitRegistry.has("stellar")` false-branch is expected in steady state, but the guard is kept for boot-order safety (Fast Refresh, kit registration ordering) — same defensive shape as the Solana/Sui blocks. |
| `services/bridge/redact.ts` | Add Stellar branches to `redactParams` (currently ends its namespace-specific branches after the Sui block starting line 281; `standard:connect` at line 242 is already namespace-agnostic and needs no Stellar-specific change) — see §11.5.3. |
| `services/permissions/store.ts:49-54` | Add `if (chainId.startsWith("stellar")) return "stellar";` to `namespaceForChainKey` — closes the misclassification gap in §2.1. |
| `components/dapps-browser/approvals/renderers.ts` | Append `signTransaction` (and conditionally `signMessage`) rows for `namespace === "stellar"`. The shared `connect` row (line 34-37) already covers it — zero change needed there. |
| `services/chains/types.ts` | None — `Namespace` already includes `"stellar"` (line 4). |
| `app/dapps-browser.tsx` | None — already iterates every registered adapter's `getInjectedScript()`. |

**No changes to `services/walletKit/stellar/StellarWalletKit.ts`.**
The bridge signer docks directly onto `getStellarSignerForWallet`
(§2.1) and does its own `@stellar/stellar-base` sign call, the same
"bridge calls the raw SDK primitive, not the kit's high-level business
methods" pattern `installSuiSigner` established — no new capability
surface needed on the kit itself.

---

## 4. The `StellarAdapter` contract

```ts
class StellarAdapter implements ChainAdapter {
  readonly namespace = "stellar" as const;

  getInjectedScript(ctx: AdapterContext): string;
  onStateChange(ctx: AdapterContext): { injectedJs: string } | null;
  handleRequest(req: ChainRequest, ctx: AdapterContext): Promise<ChainResult>;
  executeApproval(intent, decision, ctx): Promise<unknown>;
}
```

### 4.1 Method dispatch table

`ChainRequest.method` carries the **`EXTERNAL_SERVICE_TYPES` enum
value** the injected postMessage listener (§5) received on the wire —
confirmed real values from `@shared/constants/services.ts` (§1.4), not
invented bare names:

| Wire method (`EXTERNAL_SERVICE_TYPES`) | Approval kind | Notes |
|---|---|---|
| `REQUEST_CONNECTION_STATUS` | resolved, no intent | `{ isConnected: true }`. Rarely reached — `window.freighter` fast-path (§1.3) answers most callers before this round-trips at all. |
| `REQUEST_PUBLIC_KEY` | resolved, no intent | `{ publicKey: <granted address> }`, or `{ publicKey: "" }` if no `PermissionStore` grant for this origin — same privacy-fix property as EVM's `eth_accounts` gate. Maps to `getAddress()`. |
| `REQUEST_ALLOWED_STATUS` | resolved, no intent | `{ isAllowed: <grant exists> }`. Maps to `isAllowed()`, and is called internally by the dApp's own bundled `signMessage()`/`signAuthEntry()` pre-flight (§1.6) — our correctness here is what makes that free orchestration work. |
| `SET_ALLOWED_STATUS` | `connect` (same intent as `REQUEST_ACCESS`) | Freighter's `setAllowed()` is a lighter-weight consent primitive than `requestAccess()` (doesn't require returning an address) but functionally the same trust decision — routed through the identical `connect` `ApprovalIntent`/`ConnectSheet` path, differing only in `executeApproval`'s return shape (`{ isAllowed: true }` vs `{ publicKey }`). |
| `REQUEST_ACCESS` | `connect` | → `StellarConnectPayload`. Silent-reconnect: if a grant already exists for `(origin, "stellar:<network>")`, resolve immediately without a sheet — same property `getAddress()`/`isAllowed()` already give dApps that check first. |
| `REQUEST_NETWORK_DETAILS` | resolved, no intent | `{ networkDetails: { network, networkUrl, networkPassphrase, sorobanRpcUrl } }`, derived from the **granted wallet's** `chain` — never `ctx.activeWallet` as a fallback (`[[feedback_dapp_bridge_isolation]]`). Serves **both** `getNetwork()` and `getNetworkDetails()` (§1.4 — confirmed both public functions send this same message type). |
| `SUBMIT_TRANSACTION` | `signTransaction` | → `StellarSignTransactionPayload`. Sign-only by default; submits per SEP-0043's `submit`/`submitUrl` opt-in (§1.8). |
| `SUBMIT_BLOB` | `signMessage` | → `StellarSignMessagePayload`. Confirmed real (§1.4) — implemented in v1, not conditional. |
| `SUBMIT_AUTH_ENTRY` | — | Always responds `{ apiError: { code: -3, message: "Soroban signing is not supported." } }` (SEP-0043's "invalid request" code, §1.1) — never enqueued as an intent. Fixed decline per §0's Soroban non-goal; must still respond (§1.5 — no client timeout on this message type). |
| `SUBMIT_TOKEN` | `watchAsset`-equivalent | → optional/stretch, §16. Deferred out of v1's dispatch table; until implemented, responds `{ apiError: { code: -3, message: "Not supported yet." } }` rather than hanging. |
| `REQUEST_USER_INFO` | — | Not implemented — confirmed no public `@stellar/freighter-api` export ever sends this (§1.4). If received (a dApp calling something outside the published API), responds with a fixed decline rather than hanging. |

### 4.2 Connect flow

- Resolves the connected/target Stellar wallet the same way every other
  namespace does: filter `ctx.wallets` to `namespace === "stellar"`,
  prefer the wallet matching an existing `PermissionStore` grant for
  `(origin, "stellar:<network>")`, else the first Stellar wallet. Lift
  the helper body from `SuiAdapter`'s `pickSuiWalletForOrigin` (Sui spec
  §4.3) verbatim — only the chain-id prefix string changes.
- **Cross-namespace trust is forbidden**, same invariant as every other
  adapter (§11): an existing EVM/Solana/Sui grant for an origin does
  **not** silently authorize Stellar `requestAccess`.
- Default network: `"mainnet"` (read from the active chain config when
  present, else `"mainnet"`) — same default posture as Solana/Sui/the
  static `supportedChains` fallback in `chainConfig.ts:202-207`.

### 4.3 `executeApproval` outcomes

| Intent kind | Adapter return | Wire response fields (§1.4) |
|---|---|---|
| `connect` (`REQUEST_ACCESS`) | `{ address: <granted address> }` — single string, no accounts array (§1.7). | `{ publicKey: address }` |
| `connect` (`SET_ALLOWED_STATUS`) | `{ allowed: true }` | `{ isAllowed: true }` |
| `signTransaction` | `{ signedTxXdr: string; signerAddress: string; hash?: string }` — `signerAddress` is mandatory (§1.4's SEP-0043 shape has both fields, corrected from an earlier draft that only had `signedTxXdr`); `hash` populated only when `payload.submit === true` (§1.8) after a successful Horizon submission via `transactionToBase64Xdr`'s sibling submit path in `services/chains/stellar/horizonClient.ts`. | `{ signedTransaction: signedTxXdr, signerAddress }` |
| `signMessage` | `{ signedMessage: string; signerAddress: string }` — hex-encoded per SEP-0043's text ("HEX-encoded message derived from the public key and original message"); `installStellarSigner` produces this via `keypair.sign(Buffer.from(message, "utf8")).toString("hex")` — **confirmed working on-device under this app's Hermes runtime (§10.1, Task 00), no workaround needed**. | `{ signedBlob: signedMessage, signerAddress }` |

Every one of these is wrapped by the injected postMessage listener
(§5) into the `{ ...fields, apiError? }` wire shape before it's posted
back to the dApp — the adapter itself still uses the project-standard
`ChainResult` / thrown-`Error` shape internally; the translation to
`apiError` happens once, in the listener (§5.4), not scattered across
every handler.

### 4.4 `getInjectedScript` / `onStateChange` contract

- `getInjectedScript(ctx)` returns the IIFE from §5 (the postMessage
  listener + `window.freighter` boolean). No per-wallet address is
  baked into the injected script itself — every `REQUEST_PUBLIC_KEY` /
  `REQUEST_ACCESS` request re-reads live `PermissionStore` state at
  request time (§4.1), so there's no "pre-populate an authorized-looking
  state" risk to guard against the way Solana/Sui's `accounts: []`
  pre-connect convention does — our transport has no equivalent
  client-side cached state to poison in the first place.
- `onStateChange(ctx)`: Freighter has **no push-event system** — there
  is no `postMessage` type for "the wallet changed accounts, here's the
  new one." A wallet switch or grant revocation therefore has nothing to
  *push*; the next `REQUEST_PUBLIC_KEY`/`REQUEST_NETWORK_DETAILS` a
  dApp sends (via its own `WatchWalletChanges` poller, §1.4, or a manual
  re-check) picks up the new state automatically because our listener
  reads live `PermissionStore` state on every request. `onStateChange`
  therefore returns `null` unconditionally — a real protocol
  simplification, not a shortcut: there is no injected JS to emit
  because there is no event contract to emit it through.

---

## 5. The injected script (`services/chains/stellar/injectedScript.ts`)

A **content-script emulator**, not a callable-object shim — it listens
on `window` for the exact `postMessage` protocol real Freighter-bundling
dApp code already sends (§1.2–§1.4), and answers on the same channel.

### 5.1 Targets
- Small — no discovery handshake, no per-feature object boilerplate.
  Target ≤ 2 KB gzipped.
- Runs under `injectedJavaScriptBeforeContentLoaded` in the RN WebView
  (WebKit/Chromium, not Hermes).
- Idempotent — re-running on an already-installed page is a no-op
  (`window.__takumi_stellar_installed` guard), matching every other
  adapter's re-inject-on-navigation posture. Re-adding the `message`
  listener on every inject would double-answer every request, so the
  guard must wrap the `addEventListener` call itself, not just the
  `window.freighter` assignment.

### 5.2 Public surface installed on `window`
```ts
window.__takumi_stellar_installed: 1
window.__takumi_stellar_nonce: string   // TWV-2026-015 — read at request time, not closure-captured
window.freighter: true                  // §1.3 — isConnected()'s synchronous fast-path
window.freighterApi: { [key: string]: (...) => Promise<any> }  // §5.5, defensive convenience only
// + a `message` event listener answering FREIGHTER_EXTERNAL_MSG_REQUEST — the real surface
```

### 5.3 The listener

```js
window.addEventListener("message", function (event) {
  if (event.source !== window) return;                    // same filter Freighter's own client uses
  if (event.data?.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST") return;

  var req = event.data;
  var reply = function (fields) {
    // §1.5 — must ALWAYS post exactly one reply per request, even on
    // internal error; most message types have no client-side timeout.
    window.postMessage(Object.assign(
      { source: "FREIGHTER_EXTERNAL_MSG_RESPONSE", messagedId: req.messageId },
      fields
    ), window.location.origin);
  };

  bridgeRequest(req.type, req)   // same bridge_request/response helper Solana/Sui's
    .then(function (result) { reply(result); })            // injectedScript.ts already uses ("S"-equivalent)
    .catch(function (err) {
      reply({ apiError: { code: -1, message: (err && err.message) || "The wallet encountered an internal error. Please try again or contact the wallet if the problem persists." } });
    });
}, false);
```

`bridgeRequest` stamps `window.__takumi_stellar_nonce` (§5.4) and
dispatches into `StellarAdapter.handleRequest` via the same
`bridge_request` transport every other namespace's injected script
uses — reused, not reimplemented. The `.catch` is the entire
enforcement mechanism for §1.5's "always eventually respond" invariant:
even a native-side crash or malformed response still posts a reply
rather than leaving the dApp's `await` hanging forever.

**Per-`type` reply-field shapes** are exactly the table in §1.4 (e.g.
`REQUEST_PUBLIC_KEY` → `{ publicKey }`, `SUBMIT_TRANSACTION` →
`{ signedTransaction, signerAddress }`); `StellarAdapter.handleRequest`
produces these fields directly so the listener above needs zero
per-`type` branching — the mapping lives once, in the adapter (§4).

### 5.4 Session-nonce stamping

Same as Solana/Sui: `bridgeRequest` reads `window.__takumi_stellar_nonce`
at call time (not closure-captured) and stamps it onto the *internal*
`bridge_request` envelope (a layer beneath the Freighter-shaped
`postMessage` protocol — the nonce is never visible to the dApp's own
message). `DappBridge` validates against its recently-issued nonce ring
(TWV-2026-015) exactly as it does today.

### 5.5 The optional `window.freighterApi` convenience object

Defensive only (§1.3) — for dApp code that checks
`typeof window.freighterApi !== "undefined"` directly instead of
bundling the npm package or loading the CDN script. Each method is a
thin synchronous wrapper around the *same* internal dispatch the
listener (§5.3) uses — not a second protocol, not a second source of
truth:
```js
window.freighterApi = {
  isConnected: function () { return dispatch("REQUEST_CONNECTION_STATUS", {}); },
  getAddress: function () { return dispatch("REQUEST_PUBLIC_KEY", {}); },
  requestAccess: function () { return dispatch("REQUEST_ACCESS", {}); },
  getNetwork: function () { return dispatch("REQUEST_NETWORK_DETAILS", {}).then(pickNetwork); },
  getNetworkDetails: function () { return dispatch("REQUEST_NETWORK_DETAILS", {}).then(pickNetworkDetails); },
  signTransaction: function (xdr, opts) { return dispatch("SUBMIT_TRANSACTION", { transactionXdr: xdr, ...opts }).then(pickSignTx); },
  signMessage: function (msg, opts) { return dispatch("SUBMIT_BLOB", { blob: msg, ...opts }).then(pickSignMsg); },
  isAllowed: function () { return dispatch("REQUEST_ALLOWED_STATUS", {}); },
  setAllowed: function () { return dispatch("SET_ALLOWED_STATUS", {}); },
};
```
where `dispatch(type, args)` is the same `bridgeRequest` call §5.3 uses
directly (no `postMessage` round-trip to itself), and each `pick*`
helper remaps the wire `{...fields, apiError}` shape to the specific
public function's documented return shape (§1.4's rightmost column,
mirrored). `signAuthEntry`/`addToken` are intentionally omitted from
this convenience object (§0/§4.1 non-goals) — a dApp calling them
through this path gets a normal `undefined is not a function`, same as
if the real extension didn't implement an optional method either.

### 5.6 Freighter-protocol lint suite

Add `services/chains/stellar/injectedScript.test.ts` (plain
`node --test`, no Wallet Standard predicates to check against):

| Assertion | Why |
|---|---|
| Posting a `FREIGHTER_EXTERNAL_MSG_REQUEST` message always yields exactly one `FREIGHTER_EXTERNAL_MSG_RESPONSE` with matching `messagedId` — including when the internal dispatch throws. | §1.5's core invariant — the one most likely to regress silently, since most message types have no client-side timeout to mask a dropped response. |
| `window.freighter === true` synchronously after injection, before any `await`. | §1.3 fast-path contract. |
| `REQUEST_PUBLIC_KEY` responds `{ publicKey: "" }` when no `PermissionStore` grant exists for the test origin. | §4.1 pre-connect contract. |
| `SUBMIT_TRANSACTION` forwards `networkPassphrase` unchanged, and only submits (populates `hash`) when `submit === true` was present on the request. | Wrong-network signing and unwanted-broadcast are both real footgun classes (§11). |
| Re-injecting (simulated navigation) does not double-register the `message` listener — a single request yields exactly one response, not two. | §5.1's idempotency requirement — a duplicate listener would double-answer every dApp call. |
| A message whose `source` isn't `FREIGHTER_EXTERNAL_MSG_REQUEST`, or whose `event.source !== window`, is ignored entirely (no response posted). | Matches Freighter's own filter (§1.2) — prevents our listener from replying to unrelated `postMessage` traffic on the page. |

---

## 6. Approval payloads (`services/chains/stellar/payloads.ts`)

```ts
export type StellarNetwork = "mainnet" | "testnet";      // internal; CAIP-2 stellar:pubnet|stellar:testnet
                                                            // per stellar-chain-support-spec.md §1.1/§3.9
export type StellarChain = "stellar:pubnet" | "stellar:testnet";

export type StellarConnectPayload = {
  network: StellarNetwork;
};

/** Structural view of one decoded operation — populated by
 *  StellarXdrDecoderInspector (§8.1), never hand-built by the adapter. */
export type StellarDecodedOperation =
  | { kind: "payment"; destination: string; asset: string /* "native" | "CODE:ISSUER" */; amount: string }
  | { kind: "createAccount"; destination: string; startingBalance: string }
  | { kind: "changeTrust"; asset: string; limit: string }
  | { kind: "pathPaymentStrictSend" | "pathPaymentStrictReceive"; destination: string; sendAsset: string; destAsset: string }
  | { kind: "manageSellOffer" | "manageBuyOffer"; selling: string; buying: string }
  | { kind: "accountMerge"; destination: string }
  | { kind: "invokeHostFunction" }            // Soroban — decodes to this bare tag only, §0 non-goal
  | { kind: "other"; type: string };

export type StellarSignTransactionPayload = {
  address: string;
  networkPassphrase: string;
  /** Raw XDR envelope (base64) exactly as the dApp supplied it — primary
   *  source of truth; `executeApproval` re-parses this, never the
   *  decoded view, for the actual signature (defense against a
   *  decoder/inspector bug silently signing something different from
   *  what was displayed). */
  xdr: string;
  /** SEP-0043 optional fields (§1.1, §1.8) — sign-only when absent/false. */
  submit?: boolean;
  submitUrl?: string;
  /** Populated by StellarXdrDecoderInspector (§8.1). */
  decoded?: StellarDecodedOperation[];
  sourceAccount?: string;
  fee?: string;          // stroops, string (bigint-unsafe JSON otherwise)
  sequence?: string;
  memo?: { type: "none" | "text" | "id" | "hash" | "return"; value?: string };
  /** Populated by StellarPreflightInspector (§8.2). */
  preflight?: {
    destinationExists?: boolean;
    destinationHasTrustline?: boolean;   // only meaningful when the sole/primary op is a non-native payment
  };
};

/** Confirmed real (§1.4, SEP-0043 §1.1) — implemented in v1, not conditional. */
export type StellarSignMessagePayload = {
  address: string;
  message: string;
  networkPassphrase?: string;
};

export type StellarApprovalPayload =
  | ({ kind: "connect" } & StellarConnectPayload)
  | ({ kind: "signTransaction" } & StellarSignTransactionPayload)
  | ({ kind: "signMessage" } & StellarSignMessagePayload);
```

Reuses `@stellar/stellar-base`'s `TransactionBuilder.fromXDR` /
`Operation.*` — the same *dependency* `stellar-chain-support-spec.md`
task 00 already de-risked for Hermes compatibility (§3.1 of that spec).
The **library** isn't a fresh risk, but the specific **entry point**
(`fromXDR`, parsing an externally-supplied string) is one this app has
never exercised before — that spec's Task 00 only verified the
build/sign/encode direction. See §10.1 for why the decode direction
needs its own verification pass before `xdrDecode.ts` can be trusted.

---

## 7. Approval renderers (sheets)

| Sheet | Verdict |
|---|---|
| `ConnectSheet.tsx` | **Reuse.** Already namespace-agnostic (`components/dapps-browser/approvals/renderers.ts:34-37`). `StellarWalletKit` supplies `formatConnectChipLabel`, `requireBiometricForConnect: true` (already implemented per `stellar-chain-support-spec.md` §4). No single-account-vs-array UI branch needed — the sheet already renders "the wallet about to connect," not a picker over multiple accounts. |
| `StellarTransactionSheet.tsx` | **New.** Renders the decoded operation list (§6), fee (stroops → XLM via the kit's existing `formatNativeAmount`), memo, and any `preflight` warnings (§8.2) — e.g. "Recipient hasn't set up this asset yet" surfaced *before* signing, not as a post-hoc Horizon failure, mirroring the exact UX gap `stellar-chain-support-spec.md` §4.1/§8.2 already identified for the **first-party** send flow; this sheet closes the same gap for **dApp-initiated** payments. |
| `StellarSignMessageSheet.tsx` | **New.** Renders the message text (UTF-8, matching SEP-0043's arbitrary-string contract, §1.1) plus origin — no structured SIWx parse in v1 (§16). |

### 7.1 Registration
Append to `components/dapps-browser/approvals/renderers.ts`:
```ts
{
  canHandle: (i) => i.namespace === "stellar" && i.kind === "signTransaction",
  Component: StellarTransactionSheet as ApprovalRenderer["Component"],
},
{
  canHandle: (i) => i.namespace === "stellar" && i.kind === "signMessage",
  Component: StellarSignMessageSheet as ApprovalRenderer["Component"],
},
```
The `connect` row (line 34-37) and the `via === "agent"` row (line
25-28, `AgentCardRenderer`) already cover Stellar with zero changes —
same property Sui's spec noted (§7.2 there).

---

## 8. Inspectors

Registered in `InspectorRegistry` (`services/bridge/boot.ts`), same
priority-ascending pipeline every intent already flows through:

| Inspector | Priority | Mode | Trigger |
|---|---|---|---|
| `HttpsInspector` | (existing, ~5) | auto | universal |
| `HeuristicInspector` | (existing, ~10) | auto | universal |
| `StellarXdrDecoderInspector` | 15 | auto | `intent.namespace === "stellar" && intent.kind === "signTransaction"` |
| `StellarPreflightInspector` | 20 | auto | same trigger, depends on decoder's parsed destination/asset fields |

### 8.1 `StellarXdrDecoderInspector`

Pure decode — no RPC, mirrors `SuiPtbDecoderInspector`'s "no RPC" shape
(Sui spec §8.1) even more directly than Sui does, since Stellar's XDR
format has no analogue of Sui's lazy `.toJSON()` (which can itself
trigger network calls, Sui spec §14 risk row). Calls
`TransactionBuilder.fromXDR(payload.xdr, payload.networkPassphrase)`
from `@stellar/stellar-base` and walks `tx.operations`. Patches the
intent payload with `sourceAccount`, `fee`, `sequence`, `memo`, and
`decoded: StellarDecodedOperation[]` (§6).

Annotations:
- `sender.mismatch` (warn) — `payload.address !== tx.source` (mirrors
  Sui's `sender.mismatch`, Sui spec §8.1).
- `trustline.unlimited-limit` (info) — any `changeTrust` op whose
  `limit` is the max i64 sentinel (`"922337203685.4775807"`) — not
  dangerous by itself (it's Stellar's own convention for "no cap"), but
  worth surfacing since a naive reader might expect a numeric ceiling.
- `operation.high-count` (warn) — `tx.operations.length > 20` (an
  unusually large batch for a mobile-signed transaction).
- `soroban.invoke-host-function` (danger) — any operation of kind
  `invokeHostFunction` — since we can't decode it (§0 non-goal), flag
  it loudly rather than silently rendering a blank "other" row.

### 8.2 `StellarPreflightInspector`

**No `dryRunTransactionBlock`/`eth_call` equivalent exists for classic
Stellar operations** (§0 non-goal — Horizon has no simulate endpoint;
Stellar RPC's `simulateTransaction` is Soroban-only). This inspector
substitutes **targeted Horizon reads** instead of a general simulate,
reusing primitives `stellar-chain-support-spec.md` already built and
shipped:

- If the decoded operations include exactly one `payment` (the common
  case), call `detectAccountFunded` (`services/chains/stellar/accountState.ts`,
  already implemented) against the destination. If `false`, annotate
  `destination.unfunded` (warn) — "this recipient has never received
  XLM; the payment will fail unless it's a `createAccount` operation
  instead."
- If the payment's asset is non-native, additionally call `hasTrustline`
  (`services/chains/stellar/trustlineService.ts`, already implemented)
  against the destination + `(code, issuer)`. If `false`, annotate
  `destination.no-trustline` (warn) — "recipient hasn't set up this
  asset yet; the payment will fail with `op_no_trust`." This is the
  exact UX gap `stellar-chain-support-spec.md` §4.1 flagged for
  first-party sends, closed here for dApp-initiated ones too.
- Both checks are **best-effort and skip silently on Horizon errors**
  other than 404 (rate limit, network blip) — same "don't misroute on
  an ambiguous failure" discipline `detectAccountFunded` itself already
  enforces (`stellar-chain-support-spec.md` §3.5). A skipped preflight
  check means no annotation, not a blocking error — the user can still
  sign; Horizon's own submission-time error is the fallback safety net,
  same as it is today for first-party sends.
- Multi-operation transactions (more than one `payment`/`changeTrust`)
  are **not** preflighted in v1 — flagged as future work (§16) rather
  than adding N Horizon round-trips to every batched dApp transaction.

Times out at the same 2 s default every auto inspector uses
(`services/bridge/inspector.ts`) — on timeout, the intent proceeds with
no preflight annotation, not a blocked sheet.

### 8.3 Boot registration

```ts
InspectorRegistry.register(StellarXdrDecoderInspector);
InspectorRegistry.register(StellarPreflightInspector);
```
placed after the Sui inspector registrations in `services/bridge/boot.ts`.

---

## 9. Permissions model

Reuses `services/permissions/store.ts` — no schema change to
`PermissionGrant` itself. Grants:

```ts
{
  origin: "https://app.example.stellar",
  walletAddress: "G...",
  chainId: "stellar:mainnet",   // internal network name — see below
  caveats: [...],
  grantedAt: <ms epoch>,
}
```

**One real change required**: `namespaceForChainKey` (`services/permissions/store.ts:49-54`)
currently has no Stellar branch and would silently misclassify a
Stellar grant as `"eip155"` (§2.1, §3.3). Add:
```ts
if (chainId.startsWith("stellar")) return "stellar";
```
before the final `return "eip155"` fallback. This is a one-line fix but
a real correctness gap if left unpatched — a Stellar grant would be
invisible to any shared UI that lists/labels grants by namespace (e.g.
a future `app/settings/dapp-permissions.tsx`, per `dapp-bridge-spec.md`
§10.1's EIP-2255 row), and could in principle let an EVM-scoped
revocation UI mishandle a Stellar grant it thinks is an EVM one.

`chainId` string convention: consistent with how Solana stores
`"solana:<cluster>"` and Sui stores `"sui:<network>"` (both internal
network names, not the `pubnet`/`testnet` CAIP-2 references from
`stellar-chain-support-spec.md` §1.1/§3.9's own `mainnet ⇄ pubnet`
translation layer) — **the permission-store `chainId` uses the internal
name** (`"stellar:mainnet"`), keeping this file's convention uniform
across all three non-EVM namespaces; the CAIP-2 translation stays
scoped to `services/walletconnect/caipMapping.ts` where it already
lives, not duplicated here.

---

## 10. Boot-order changes

Diff for `services/bridge/boot.ts`:

```ts
// Replaces the current lines 182-190.
//
// Stellar dApp bridge — real implementation (docs/stellar-dapp-bridge-spec.md).
// Boot-order precondition, same shape as Solana/Sui: the Stellar kit
// must be registered in walletKitRegistry before installStellarSigner
// lands a signer. Per §2.1, stellar-chain-support-spec.md task 09
// already registers it unconditionally, so this guard is defensive
// (Fast Refresh, boot-order regressions) rather than an expected
// steady-state branch — same posture the Solana/Sui blocks already
// have for their own already-registered kits.
const FEATURE_STELLAR_DAPP_BRIDGE = false; // flipped true in the final rollout PR (§15)
if (FEATURE_STELLAR_DAPP_BRIDGE) {
  ChainAdapterRegistry.register(createStellarAdapter());
  if (walletKitRegistry.has("stellar")) {
    installStellarSigner({
      getWalletByAddress: (addr) =>
        opts.getContext().wallets.find((w) => w.address === addr),
    });
  } else {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn(
        "[bridge] Stellar kit not registered in walletKitRegistry; " +
          "Stellar dApp signing disabled until next bootBridge. " +
          "Did `bootWalletKits()` run before `bootBridge()` and include Stellar?",
      );
    }
    booted = false;
  }
}
```

`installStellarSigner`'s deps object still needs **less** than Solana's
or Sui's `install*Signer` calls: a `getHorizonClient(chain)` is only
reached down the `submit === true` branch (§1.8), and it's the same
per-chain client `stellar-chain-support-spec.md` already built
(`services/chains/stellar/horizonClient.ts`) — no new RPC plumbing, and
no client resolved at all on the (default, more common) sign-only path.

`installStellarSigner` itself (`services/chains/stellar/signer.ts`):
```ts
export interface InstallStellarSignerDeps {
  getWalletByAddress: (addr: string) => TWallet | undefined;
  getHorizonClient: (chain: StellarChainConfig) => Horizon.Server;
}

export interface StellarSignerFns {
  signTransaction: (
    address: string,
    xdr: string,
    networkPassphrase: string,
    opts: { submit?: boolean; chain: StellarChainConfig },
  ) => Promise<{ signedTxXdr: string; signerAddress: string; hash?: string }>;
  signMessage: (
    address: string,
    message: string,
  ) => Promise<{ signedMessage: string; signerAddress: string }>;
}

export function installStellarSigner(deps?: InstallStellarSignerDeps): void {
  if (!deps) return;
  if (!walletKitRegistry.has("stellar")) return;

  async function resolveSigner(address: string) {
    const wallet = deps.getWalletByAddress(address);
    if (!wallet) throw new Error("Unknown wallet");
    const keypair = await getStellarSignerForWallet(wallet); // services/walletService.ts:613
    if (!keypair) throw new Error("No Stellar signer");
    // getStellarSignerForWallet already re-verifies keypair.publicKey()
    // === wallet.address internally (TWV-2026-090) — no second check
    // needed here, unlike installSuiSigner's resolveCheckedSigner,
    // which re-verifies because getSuiSignerForWallet doesn't.
    return keypair;
  }

  const handlers: StellarSignerFns = {
    signTransaction: async (address, xdr, networkPassphrase, opts) => {
      const keypair = await resolveSigner(address);
      const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase);
      tx.sign(keypair);
      // NEVER tx.toXDR() directly — that hits the Hermes ambient-Buffer
      // base64 bug ([[feedback_hermes_ambient_buffer_base64_bug]]) that
      // already broke trustline submission once in this exact SDK
      // (`@stellar/stellar-base`'s `.toString("base64")` silently
      // produces a comma-joined decimal list under this app's Hermes
      // runtime). Reuse the already-shipped, already-tested helper:
      const signedTxXdr = transactionToBase64Xdr(tx); // services/chains/stellar/horizonClient.ts:26
      if (!opts.submit) return { signedTxXdr, signerAddress: address };
      // §1.8 — submitUrl is intentionally never consulted; always our
      // own configured Horizon for the connected wallet's chain.
      const horizon = deps.getHorizonClient(opts.chain);
      const { hash } = await horizon.submitTransaction(tx);
      return { signedTxXdr, signerAddress: address, hash };
    },
    signMessage: async (address, message) => {
      const keypair = await resolveSigner(address);
      const raw = keypair.sign(Buffer.from(message, "utf8"));
      // Confirmed on-device (§10.1, Task 00): unlike `.toString("base64")`
      // (the bug `bytesToBase64`/`transactionToBase64Xdr` work around),
      // `.toString("hex")` on this app's Hermes runtime is NOT affected —
      // no custom helper needed here.
      const signedMessage = raw.toString("hex");
      return { signedMessage, signerAddress: address };
    },
  };

  registerStellarSigner(handlers); // exported from StellarAdapter.ts, mirrors registerSuiSigner
}
```

**No new base64-encoding helper needed** — `transactionToBase64Xdr`
(`services/chains/stellar/horizonClient.ts:26-31`) already does the
Hermes-safe `tx.toEnvelope().toXDR("raw")` + `bytesToBase64` dance for
transaction submission; the bridge signer reuses it verbatim for the
exact same reason (serializing a signed `Transaction` to a base64
string) rather than re-deriving the workaround.

### 10.1 The symmetric risk: decoding a dApp-supplied XDR string — VERIFIED, WORKS

`transactionToBase64Xdr` only covers the **encode** direction (our own
signed `Transaction` → base64 string going back to the dApp). This spec
introduces a code path the shipped chain-support code never needed:
**decoding** a base64 XDR string the dApp handed *us*
(`TransactionBuilder.fromXDR(payload.xdr, networkPassphrase)`, used by
both `installStellarSigner`, §8.1's `StellarXdrDecoderInspector`, and
§6's `xdrDecode.ts`). The base64.ts root-cause comment (§ above) is
specific to `.toString("base64")` (**encoding** raw bytes → string)
being broken under this app's Hermes runtime — it did not by itself
guarantee the **decode** direction (`Buffer.from(str, "base64")`, which
`@stellar/js-xdr`'s XDR reader may use internally to turn the incoming
string into bytes) was equally safe, so this spec treated it as a
separate open question rather than assuming symmetry with the
already-fixed encode bug.

**Status: confirmed on-device by the user (2026-07-08) — `TransactionBuilder.fromXDR`
round-trips correctly, and the `signMessage` hex-encoding path also
works, under this app's actual Hermes runtime.** Task 00 (§13) is
therefore **done**, not a blocker — `StellarXdrDecoderInspector` (§8.1),
`xdrDecode.ts` (§6), and `installStellarSigner`'s `signTransaction`/
`signMessage` handlers (§10) can be implemented using `TransactionBuilder.fromXDR`
and `Buffer`/`.toString("hex")` directly, with **no** `atob`-based
workaround needed on the decode/hex side (the encode side still must
route through `transactionToBase64Xdr`/`bytesToBase64` per the
already-known, already-fixed bug — that asymmetry is real and confirmed,
not resolved away by this result). If a future engineer wants to
double check exactly what was exercised (single XDR fixture vs. a
range of operation types, testnet vs. mainnet passphrase, etc.), ask
the user directly rather than assuming full coverage from this note.

---

## 11. Security invariants (new gate)

- **TWV-2026-ZZZ (STELLAR-DAPP)** *(new gate to issue with this PR)*
  - The bridge's Stellar sign path goes through `StellarSignerFns`
    registered by `installStellarSigner` only, which reaches the
    keypair through `getStellarSignerForWallet` — the single dwell site
    already established and address-reverified by
    `stellar-chain-support-spec.md` §3.3/§6 (TWV-2026-090 carryover).
  - The injected script never sees the raw secret seed or `S…` StrKey.
    It only ever receives the final signed XDR string back.
  - **Always-respond invariant (§1.5/§5.3).** Every
    `FREIGHTER_EXTERNAL_MSG_REQUEST` the listener receives must produce
    exactly one `FREIGHTER_EXTERNAL_MSG_RESPONSE` — including on user
    rejection, timeout, malformed bridge response, or internal adapter
    error. Since only `REQUEST_CONNECTION_STATUS`/`REQUEST_PUBLIC_KEY`
    have any client-side timeout (§1.5), a future PR that adds a new
    message type and forgets to route it through the listener's
    `.catch` doesn't just misbehave — it makes the dApp's `await` hang
    forever. Flag this explicitly in code review for any diff touching
    `injectedScript.ts`.
  - **Cross-namespace trust is forbidden** in `executeApproval`'s
    connect path — an existing EVM/Solana/Sui grant for an origin does
    NOT auto-grant Stellar access. Same property `SolanaAdapter` and
    `SuiAdapter` already enforce.
  - **Signature verification against `xdr`, not `decoded`.**
    `executeApproval` re-parses `payload.xdr` (the original string) for
    the actual `tx.sign(keypair)` call — never signs off of the
    inspector's `decoded` structural view. A decoder bug can produce a
    wrong *display*; it must never be able to produce a wrong
    *signature*.
  - **Base64 encode/decode must go through the Hermes-safe helpers,
    never the SDK's own `.toString("base64")` / string-input `fromXDR`
    if Task 00 (§13) finds the latter broken too.** `transactionToBase64Xdr`
    (`services/chains/stellar/horizonClient.ts:26`) is mandatory for
    the encode direction (§10) — reusing `tx.toXDR()` directly
    reintroduces `[[feedback_hermes_ambient_buffer_base64_bug]]`, a bug
    that already shipped once and was only caught by live on-device
    reproduction, not code review. See §10.1 for the decode-direction
    counterpart.

- **TWV-2026-013 carryover (origin pinning).** `DappBridge.dispatch`
  rejects requests whose declared origin disagrees with the tracked
  top-frame host. Stellar requests inherit this for free — no
  adapter-side code.

- **TWV-2026-015 carryover (session nonce).** Same — the Stellar shim
  reads `window.__takumi_stellar_nonce` at request time (§5.6); the
  bridge's nonce ring validates it exactly as it does for every other
  namespace.

- **TWV-2026-064 carryover (fullscreen disabled).** `app/dapps-browser.tsx`
  neutralizes the JS fullscreen API before any dApp script runs.
  Stellar inherits.

- **No `eth_sign`-style blank-cheque signing primitive exists on
  Stellar.** `signTransaction` always carries a well-formed XDR
  envelope with an explicit operation list — there is no analogue of
  signing an arbitrary opaque hash. `HARD_REJECT_METHODS` in
  `DappBridge.ts` does not need a Stellar entry, same conclusion the
  Sui spec reached (§11 there). The decoded-operations view in
  `StellarTransactionSheet` (§7) is still the primary defense against a
  dApp hiding a large/malicious operation list behind a technically-valid
  XDR blob — same defense-in-depth rationale as EVM calldata decoding
  and Sui PTB decoding, not a substitute for it.

---

## 11.5 AI-readiness (agent inspector seam)

Mirrors `docs/sui-dapp-bridge-spec.md` §11.5 — makes Stellar
first-class for the future universal "Ask Takumi AI to review" pill
(`ApprovalShell.tsx`) **at the same time** the bridge ships, so no
Stellar-specific code is needed when that on-demand inspector lands in
its own future milestone.

### 11.5.1 `services/chains/stellar/agentContext.ts`

Mirror of `services/chains/sui/agentContext.ts`'s contract — JSON-safe
(no `bigint`/`Uint8Array`/functions; stroop amounts as strings),
secret-free (no signature bytes, no XDR beyond what's needed to
identify the transaction), pre-decoded (`intent.payload.decoded` /
`.preflight` are authoritative, the raw XDR is preserved only for an
agent that wants its own re-decode).

```ts
export interface AgentIntentContext {
  namespace: "stellar";
  kind: ApprovalIntent["kind"];
  id: string;
  origin: { url: string; host?: string; title?: string; via?: "webview" | "agent" };
  annotations: Array<{ code: string; severity: "info" | "warn" | "danger"; title: string; detail?: string; source: string }>;
  intent: IntentShape;
}

type IntentShape =
  | { kind: "connect"; network: StellarNetwork }
  | {
      kind: "signTransaction";
      networkPassphrase: string;
      xdrLength: number;              // structural only, never the full XDR string
      sourceAccount?: string;
      feeStroops?: string;
      sequence?: string;
      operationCount: number;
      decoded: StellarDecodedOperation[];
      preflight?: { destinationExists?: boolean; destinationHasTrustline?: boolean };
    }
  | { kind: "unknown" };

export function buildAgentContext(
  intent: ApprovalIntent<StellarApprovalPayload>,
): AgentIntentContext;
```

### 11.5.2 `redactParams` Stellar branches

Add to `services/bridge/redact.ts`, following the same shape as the Sui
branches at lines 281+ (`sui:signTransaction`) — structural information
only, never the raw XDR or signature:

```ts
// method here is req.type — the EXTERNAL_SERVICE_TYPES value (§4.1),
// which is what ChainRequest.method carries for the stellar namespace.
if (method === "SUBMIT_TRANSACTION") {
  const { transactionXdr, networkPassphrase } = params as { transactionXdr?: string; networkPassphrase?: string };
  return {
    xdrLength: typeof transactionXdr === "string" ? transactionXdr.length : 0,
    networkPassphrase,
  };
}

if (
  method === "REQUEST_ACCESS" || method === "REQUEST_PUBLIC_KEY" ||
  method === "REQUEST_CONNECTION_STATUS" || method === "REQUEST_NETWORK_DETAILS" ||
  method === "REQUEST_ALLOWED_STATUS" || method === "SET_ALLOWED_STATUS"
) {
  // No secrets in these — pass through intact (parity with standard:connect at line 242).
  return params;
}

if (method === "SUBMIT_BLOB") {
  const { blob } = params as { blob?: string };
  const m = typeof blob === "string" ? blob : "";
  return {
    messageLength: m.length,
    messagePreview: m.length > 16 ? `${m.slice(0, 16)}…` : m,   // same 16-char cap as Solana/Sui branches
  };
}

if (method === "SUBMIT_AUTH_ENTRY" || method === "SUBMIT_TOKEN") {
  // Always declined server-side (§4.1) — nothing sensitive to redact,
  // but keep structural-only for consistency.
  return { note: "not supported" };
}
```

### 11.5.3 Explicit non-goal: existing agent executors stay as-is

`stellar-chain-support-spec.md` §7.2 already shipped
`send_xlm` / `send_stellar_asset` / `establish_stellar_trustline` as
**direct `StellarWalletKit` calls** (`sendNativeTransfer` /
`sendTokenTransfer` / `ensureTrustline`), not routed through
`DappBridge.submitAgentIntent` the way Sui's agent-mode writes are (Sui
spec §11.5.5). **This spec does not change that.** The two flows have
different trust shapes: Sui's agent write hands the bridge a
BCS-encoded PTB an agent tool just built, which legitimately benefits
from decode-before-sign the same way a dApp's PTB does; Stellar's
existing agent tools are typed, purpose-built calls
(`sendNativeTransfer(to, amountXLM)`, not "sign this arbitrary XDR"),
so there's nothing generic to decode — the tool call itself already is
the structured, reviewable representation. Re-routing them through the
intent pipeline here would be scope creep unrelated to "expose the
wallet to third-party dApps," which is this spec's actual goal.

The dApp-bridge intent pipeline is reserved for exactly the case this
spec targets: an external dApp handing us an opaque XDR blob it built
itself, where decode-before-sign (§8.1) is the only way the user gets a
human-readable view at all.

---

## 12. Testing

| Test | Mechanism |
|---|---|
| Adapter dispatch table — every Freighter method routes to the right intent kind (or resolved/no-intent). | Table-driven `StellarAdapter.test.ts`, mirrors `SolanaAdapter`/`SuiAdapter` test shape. |
| Every `FREIGHTER_EXTERNAL_MSG_REQUEST` yields exactly one `FREIGHTER_EXTERNAL_MSG_RESPONSE`, even when the internal dispatch throws. | `injectedScript.test.ts` (§5.6) — the load-bearing regression guard for §1.5/§11's always-respond invariant. |
| `getAddress()` returns `""` pre-grant, real address post-grant. | Stub `PermissionStore`. |
| Cross-namespace trust rejection — an EVM grant does not silently authorize Stellar `requestAccess`. | Seed an EVM grant for the origin, fire `requestAccess`, expect a `needs-approval` intent (not an auto-resolved address). |
| `StellarXdrDecoderInspector` decodes `payment`, `createAccount`, `changeTrust` from hard-coded XDR fixtures. | Unit test against known XDR strings (can be generated with `@stellar/stellar-base` directly in the test file — same "generate the fixture from the SDK, don't hand-encode XDR" discipline `stellar-chain-support-spec.md` §9 already uses for its own tests). |
| `StellarXdrDecoderInspector` flags `soroban.invoke-host-function` on any `invokeHostFunction` op. | Fixture test. |
| `StellarPreflightInspector` annotates `destination.unfunded` / `destination.no-trustline`, and skips silently on a non-404 Horizon error. | Mocked Horizon client, mirrors the existing `detectAccountFunded`/`hasTrustline` test doubles from `stellar-chain-support-spec.md` §9. |
| `executeApproval` for `signTransaction` signs `payload.xdr` (the raw string), not a reconstruction from `payload.decoded`. | Regression test — tamper with `decoded` in a test double, assert the signature still matches the original XDR. |
| `namespaceForChainKey("stellar:mainnet") === "stellar"`. | Regression guard for the §9 permission-store fix. |
| `buildAgentContext` round-trips through `JSON.stringify` (no bigint/Uint8Array). | Mirrors `services/chains/sui/agentContext.test.ts`. |
| `redactParams("signTransaction", …)` strips the XDR, keeps only length + passphrase. | Pure test. |
| Origin pin + session nonce — inherited, extend the existing `DappBridge` integration test to include a Stellar request. | `DappBridge.test.ts` extension. |
| End-to-end with a stub WebView: `requestAccess` → `signTransaction` → response shape matches `{signedTxXdr}`. | RN-WebView component test (mocked `injectJavaScript`), mirrors the Sui/Solana equivalents. |

`pnpm check:syntax` + `pnpm biome:check` must pass. Per
`[[feedback_limit_test_workers]]`, run the new Stellar bridge test files
directly rather than the full `pnpm test` suite while iterating.

---

## 13. Task breakdown

Each task lands as `docs/stellar-dapp-bridge-task/NN_<slug>.md`, parallel
to the Sui dApp-bridge spec's task layout.

| # | Task | Pre-reqs | Output |
|---|---|---|---|
| 00 | ~~Verify the Hermes XDR-decode round-trip~~ **DONE — confirmed on-device by the user (2026-07-08).** Both `TransactionBuilder.fromXDR` (decode direction, §10.1) and `signMessage`'s hex-encoding path (§4.3) work correctly under this app's Hermes runtime; no `atob`/hex-equivalent workaround needed. The API-surface question this task originally covered was also resolved (verified against `@stellar/freighter-api`/`@shared/api` source and SEP-0043, §1). **No longer a gate — implementation can start at task 01.** | — | Confirmed — see §10.1. |
| 01 | `services/chains/stellar/payloads.ts` + `errorCodes.ts` (SEP-0043's 4-code taxonomy, §1.1). | 00 | Type module. |
| 02 | `services/chains/stellar/injectedScript.ts` real implementation + `injectedScript.test.ts` (§5). | 01 | Freighter-protocol lint suite green. |
| 03 | `services/chains/stellar/StellarAdapter.ts` skeleton — `getInjectedScript`, `onStateChange` (returns `null`, §4.4), `handleRequest` dispatch table only (no signing yet, returns a fixed "not yet implemented" error for `signTransaction`/`signMessage`). | 02 | Dispatch-table tests. |
| 04 | `services/chains/stellar/signer.ts` — `installStellarSigner` + `StellarSignerFns` (§10), including the `signMessage` hex-sign path. | 03 | Signer install tests (mocked `getStellarSignerForWallet`). |
| 05 | `StellarAdapter.executeApproval` for `connect`, `signTransaction` (incl. SEP-0043 `submit`/`submitUrl`, §1.8), and `signMessage`. | 04 | Round-trip test against a real `Keypair.sign` / `TransactionBuilder.fromXDR` cycle. |
| 06 | `services/chains/stellar/xdrDecode.ts` + `StellarXdrDecoderInspector`. | 01 | Decoder unit tests against SDK-generated XDR fixtures. |
| 07 | `StellarPreflightInspector`. | 06 | Mocked-Horizon tests. |
| 08 | `components/dapps-browser/approvals/StellarTransactionSheet.tsx`. | 05, 06, 07 | UI snapshot tests. |
| 09 | `components/dapps-browser/approvals/StellarSignMessageSheet.tsx` + adapter `signMessage` case. | 05 | UI snapshot tests. |
| 10 | Append Stellar rows to `components/dapps-browser/approvals/renderers.ts`. | 08, 09 | Trivial diff. |
| 11 | `namespaceForChainKey` Stellar branch (§9). | — | One-line diff + regression test. Independent of everything else — can land any time. |
| 12 | Wire `bootBridge` registration + `installStellarSigner` guard (§10). Re-test cold/warm Fast Refresh. | 04, 05 | `services/bridge/boot.ts` diff, `FEATURE_STELLAR_DAPP_BRIDGE` still `false`. |
| 13 | Telemetry: extend `bridgeEventBus` consumers with `chain=stellar` Sentry tags. Mirror Solana/Sui telemetry. | 12 | Sink change only. |
| 14 | **AI-readiness — `services/chains/stellar/agentContext.ts` + tests** (§11.5.1). | 01, 06 | Agent context builder + parity tests. |
| 15 | **AI-readiness — `services/bridge/redact.ts` Stellar branches** (§11.5.2). | 01 | Redaction branches + tests. |
| 16 | Manual smoke against the live dApps in §16.1 — connect, sign a real testnet payment, verify the decoded operation view matches what the dApp asked for. Document quirks in `docs/stellar-dapp-bridge-task/16_dapp-quirks.md`. | 12 | Quirks doc. |
| 17 | Flip `FEATURE_STELLAR_DAPP_BRIDGE` to `true` in `services/bridge/boot.ts`. Single-line diff PR. | 12, 13, 14, 15, 16 | Ship. |

### 16.1 Verified live dApps for manual testing

Each URL below was fetched and confirmed live during this spec's
research (not guessed) — type these directly into the in-app dApps
browser's address bar once `FEATURE_STELLAR_DAPP_BRIDGE` is flipped on
for local testing (§15 PR 2 onward, behind the flag before task 17):

| dApp | URL to type | Why it's a good test | Confirmed |
|---|---|---|---|
| **Soroswap** (DEX) | `https://app.soroswap.finance` | Bundles `@stellar/freighter-api` directly (the primary transport this spec implements, §1.2). Has an explicit "Connect Wallet" button; supports Testnet (requires switching network in-app) — good for a real `SUBMIT_TRANSACTION` swap test without touching mainnet funds. | Live, "Connect Wallet" CTA confirmed via direct fetch. |
| **Blend** (lending) | `https://app.blend.capital` | Different UI/UX pattern than a DEX (lend/borrow/repay operations) — good coverage for `StellarXdrDecoderInspector`'s operation-type variety (§8.1) beyond simple payments. | Confirmed via Blend's own docs — "access the application at app.blend.capital and connect your Stellar wallet." |
| **Lumenswap** (DEX) | `https://lumenswap.io` | Explicitly documents Freighter as one of its supported wallets alongside Rabet/Albedo — good cross-check that our shim doesn't accidentally only satisfy Soroswap's specific integration quirks. | Live; confirmed via direct fetch — "you can use Rabet, Freighter, Albedo, and private keys." |
| **Stellar Lab** | `https://lab.stellar.org` | SDF's own official tool — "Build, sign, and submit transactions." Useful as a from-first-principles sanity check (hand-build a simple XDR, sign it through TakumiPay) separate from any third-party dApp's own bundling/build quirks. | Live, confirmed via direct fetch. |

**Deliberately not included** (mentioned in earlier ecosystem research
but not independently re-verified live for this list — check before
relying on them, same "verify before recommending" discipline this
spec applies throughout): Aquarius/AQUA, DeFindex, Orbit CDP. Their
docs/marketing pages exist, but this list only includes dApps whose
actual **app** URL and wallet-connect UI were directly confirmed
working, not just protocols known to exist.

---

## 14. Risks & open questions

| Risk | Mitigation |
|---|---|
| A dApp calls a Freighter method genuinely outside both the confirmed `@stellar/freighter-api` export list and SEP-0043's required interface (§1.1, §1.4) — e.g. a future Freighter-only addition this spec's source read (fetched at a point in time) doesn't yet reflect. | Every unhandled `EXTERNAL_SERVICE_TYPES` value still gets a fixed decline response rather than being silently dropped (§1.5) — a dApp hitting this sees a clean "not supported" error, not a hang. Task 16's live-dApp smoke test is the practical verification step; re-check Freighter's source if it surfaces. |
| Some Stellar dApps hardcode UI copy/branding assuming the connected wallet *is* Freighter (e.g. "Open Freighter to approve"), which would be misleading once we're the one presenting the approval UI. | Out of our control — same class of cosmetic mismatch any wallet emulating another wallet's shape accepts. Not a security or correctness issue; note in the quirks doc (task 16) if observed. |
| `StellarPreflightInspector`'s Horizon reads add latency (§8.2) to every dApp-initiated payment sheet, unlike EVM/Sui/Solana where the equivalent check happens via simulation the RPC already needs to run anyway. | Bounded by the existing 2 s auto-inspector timeout; degrades to "no preflight annotation," not a blocked sheet. Revisit if user-perceived latency is a problem in task 16's smoke test. |
| Public Horizon (`horizon.stellar.org`) rate-limits under load — `StellarPreflightInspector` is additive read traffic on top of whatever the mobile UI's own send flow already generates. | Same posture as `stellar-chain-support-spec.md` §11's existing Horizon rate-limit risk row — defer a paid/dedicated provider until production load shows it's needed. |
| A dApp passes a Soroban `invokeHostFunction` XDR to `signTransaction` expecting real support. | §0 non-goal — `soroban.invoke-host-function` (danger) annotation (§8.1) makes this loud rather than silently mis-decoded; the user can still choose to sign blind (matches Freighter's own behavior for unrecognized operation types), we just don't pretend to understand it. |

### Resolved decisions
1. **Target SEP-0043's ratified interface via Freighter's concrete
   `postMessage` transport**, not a Wallet-Standard-style directly-callable
   object. §1.1–§1.4 — source-verified, not the EIP-1193-shaped guess an
   earlier draft made.
2. **No discovery handshake.** §1.1 — SEP-0043 defines the interface,
   not discovery; Freighter's contract is static presence-detection
   (`window.freighter`) plus a shared `postMessage` channel, not an
   event-registration protocol.
3. **No `onStateChange` push.** §4.4 — Freighter has no event system;
   dApps poll, and polls always read live `PermissionStore` state.
4. **Sign-only by default, sign-and-submit opt-in via SEP-0043's
   `submit`/`submitUrl`.** §1.8 — matches Freighter's shipped behavior
   by default, exceeds it when a dApp asks for more.
5. **No transaction simulation.** §0/§8.2 — Horizon has none for
   classic ops; `StellarPreflightInspector`'s targeted Horizon reads
   are the closest available substitute.
6. **No new capability on `StellarWalletKit`.** §2.1/§3.3 — the bridge
   signer docks directly onto the already-shipped
   `getStellarSignerForWallet` dwell site and does its own
   `@stellar/stellar-base` sign call, mirroring `installSuiSigner`.
7. **Existing agent executors are not rerouted through
   `submitAgentIntent`.** §11.5.3 — different trust shape from a
   dApp-supplied opaque XDR; out of scope for this spec.
8. **Hermes XDR-decode/hex-encode round-trip confirmed safe.** §10.1,
   §13 Task 00 — verified on-device by the user (2026-07-08); no
   `atob`/hex-equivalent workaround needed on the decode/hex side (the
   encode side's already-known fix, `transactionToBase64Xdr`/`bytesToBase64`,
   still applies unchanged). **Task 00 is no longer a gate** —
   implementation can start immediately at task 01.

---

## 15. Roll-out plan

1. **PR 1 (this spec)** — land the spec + empty `docs/stellar-dapp-bridge-task/` files.
2. ~~PR 2 (task 00)~~ **Already done** — Hermes XDR-decode/hex-encode round-trip confirmed by the user on-device before implementation started (§10.1). PR numbering below keeps task 00's slot for traceability but it requires no PR of its own.
3. **PR 3 (tasks 01–03)** — payloads, error codes, injected script, adapter skeleton. Adapter still returns a fixed error for every message type; injected script answers `postMessage` requests but nothing signs yet.
4. **PR 4 (tasks 04–05)** — `installStellarSigner` + `executeApproval` for `connect` / `signTransaction` / `signMessage`. Behind `FEATURE_STELLAR_DAPP_BRIDGE=false` so dApps still see the scaffold's fixed error.
5. **PR 5 (tasks 06–07)** — inspectors. No user-visible change yet.
6. **PR 6 (tasks 08–10)** — approval sheet(s). Compile but unreachable until task 17.
7. **PR 7 (task 11)** — `namespaceForChainKey` fix. Independent; can land any time, including before PR 1 if convenient.
8. **PR 8 (tasks 12–13)** — boot wiring + telemetry.
9. **PR 9 (tasks 14–15)** — AI-readiness (`agentContext.ts`, `redact.ts` branches). Lands **before** the bridge goes live, same reasoning as the Sui spec (§11.5, roll-out step 7 there): the future on-demand agent inspector finds Stellar ready when it ships, no follow-up PR needed.
10. **PR 10 (task 16)** — live dApp quirks smoke test + doc.
11. **PR 11 (task 17)** — flip `FEATURE_STELLAR_DAPP_BRIDGE` to `true`. Stellar dApp explorer is live.

---

## 16. Future work (not in this milestone)

- **Stellar Wallets Kit module listing / WalletConnect.** A second
  discovery path reaching dApps that only probe kit-registered modules
  rather than bundling `@stellar/freighter-api` or falling back to
  `window.freighterApi`/`window.freighter` detection. Requires either
  upstream coordination with Creit Tech or standing up
  our own WalletConnect relay pairing — echoes `dapp-bridge-spec.md`
  §8's open question #1 ("WalletConnect v2 as a second transport"),
  now with a concrete Stellar-specific angle (Stellar Wallets Kit's own
  WalletConnect module could be a lighter-weight path in than a
  Creit Tech PR).
- **Multi-operation preflight.** §8.2's `StellarPreflightInspector`
  only checks the destination of a single-`payment` transaction;
  batched transactions with multiple payments/trustlines get no
  preflight annotation.
- **Soroban / SAC signing support**, once `stellar-chain-support-spec.md`
  §13's own Soroban follow-up lands — at that point
  `invokeHostFunction` operations can decode into a real summary
  instead of the `soroban.invoke-host-function` danger flag.
  `signAuthEntry` support would land alongside it.
  `services/chains/stellar/xdrDecode.ts`'s current
  `{ kind: "other" }` / `{ kind: "invokeHostFunction" }` fallback rows
  are the seam that milestone extends.
- **SIWS-Stellar-style structured message signing**, if a dApp is later
  found to pass a CAIP-122/EIP-4361-shaped string through `signMessage`
  — a structured parse (domain, statement, nonce) the way
  `SolanaSignInSheet`/`SuiSignInSheet` render SIWS today. Not built
  speculatively in v1; neither SEP-0043 nor Freighter's own `signMessage`
  has a dedicated `signIn` feature the way Solana/Sui's Wallet Standard
  extensions do (§1.1) — `StellarSignMessageSheet` renders the plain
  string.
- **`takumi:switchNetwork`-style extension**, mirroring Solana's
  `takumi:switchCluster` / Sui's `takumi:switchNetwork` TakumiPay-owned
  extensions — neither SEP-0043 nor Freighter's real API has a
  dApp-triggerable network-switch primitive (network is a wallet-side
  setting the user changes in the extension's own UI), so this would be
  a pure TakumiPay addition with no existing dApp expecting it. Low
  priority; only worth it if the in-app address-bar network picker
  needs to push a network change into an already-connected dApp session.
- **Honoring `submitUrl` against a non-default Horizon** (§1.8) — v1's
  resolved decision submits to the connected wallet's own configured
  Horizon regardless of a dApp-supplied `submitUrl`, to avoid the
  wallet silently proxying a transaction to an arbitrary attacker-chosen
  endpoint. Revisit only if a real dApp's `submitUrl` usage is observed
  in task 16's smoke test and turns out to matter.

---

## 17. Sources

Every protocol-level claim in §1/§4/§5 (transport shape, message-type
enum values, request/response field names, error taxonomy) was fetched
directly and read in full — not recalled from training data or taken
from a summary — before being written into this spec. An earlier draft
of this spec, based on a plausible-sounding but unverified model, was
corrected after this pass; that correction is the reason this section
exists.

- [SEP-0043 — Standard Web Wallet API Interface](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0043.md) (fetched verbatim, version 1.2.1, **Status: Draft**) — the ratified-track interface shape, 4-code error taxonomy, `submit`/`submitUrl` fields.
- [`@stellar/freighter-api/src/*.ts`](https://github.com/stellar/freighter/tree/master/%40stellar/freighter-api/src) (fetched verbatim: `index.ts`, `getAddress.ts`, `requestAccess.ts`, `isConnected.ts`, `getNetwork.ts`, `getNetworkDetails.ts`, `signTransaction.ts`, `signMessage.ts`, `signAuthEntry.ts`, `isAllowed.ts`, `setAllowed.ts`, `addToken.ts`, `watchWalletChanges.ts`) — the confirmed public export list and per-function client logic (§1.2, §1.6).
- [`@shared/api/external.ts`](https://github.com/stellar/freighter/blob/master/%40shared/api/external.ts) (fetched verbatim) — the `sendMessageToContentScript` call sites and request-field shapes per method.
- [`@shared/api/helpers/extensionMessaging.ts`](https://github.com/stellar/freighter/blob/master/%40shared/api/helpers/extensionMessaging.ts) (fetched verbatim) — the actual `postMessage`/`addEventListener` transport, the 2000ms timeout scoped to exactly two message types, and the canonical `FreighterApiDeclinedError`/`FreighterApiInternalError` constants.
- [`@shared/constants/services.ts`](https://github.com/stellar/freighter/blob/master/%40shared/constants/services.ts) (fetched verbatim) — `EXTERNAL_SERVICE_TYPES` enum values, `EXTERNAL_MSG_REQUEST`/`EXTERNAL_MSG_RESPONSE` string constants.
- [`@shared/api/types/types.ts`](https://github.com/stellar/freighter/blob/master/%40shared/api/types/types.ts) (fetched verbatim) — the `Response`/`ExternalRequest*`/`FreighterApiError` type shapes, and the ambient `Window.freighter`/`Window.freighterApi` type declarations that confirm which global the extension itself sets versus which one only a CDN bundle populates.
- [`@shared/constants/stellar.ts`](https://github.com/stellar/freighter/blob/master/%40shared/constants/stellar.ts) (fetched verbatim) — `NETWORKS.PUBLIC = "PUBLIC"` / `NETWORKS.TESTNET = "TESTNET"`, `NetworkDetails` shape.
- [Freighter docs — "Using Freighter in the browser"](https://github.com/stellar/freighter/blob/master/docs/docs/guide/usingFreighterBrowser.mdx) (fetched verbatim) — the CDN `<script>`-tag integration path, confirming `window.freighterApi` is populated by a dApp's own loaded bundle, not by the extension itself.
- `stellar-dev` plugin skills (`dapp`, `standards`) — initial orientation (Freighter as the primary wallet integration target, Stellar Wallets Kit as secondary) that prompted the deeper source read above; the skill content alone was insufficient to derive the wire protocol and was not treated as authoritative once source access was available.
- This repo's own `docs/sui-dapp-bridge-spec.md`, `docs/stellar-chain-support-spec.md`, and the current `services/bridge/`, `services/chains/stellar/`, `services/permissions/store.ts`, `services/bridge/redact.ts` source — architecture precedent and exact file/line citations throughout.
