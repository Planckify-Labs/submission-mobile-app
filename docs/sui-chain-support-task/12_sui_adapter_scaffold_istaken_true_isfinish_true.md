# Task 12 — `SuiAdapter` scaffold + `FEATURE_SUI_DAPP_BRIDGE` boot guard

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-chain-support-spec.md` §0 (non-goals), §3.2,
§5, §13.

## Why this matters

The dApp-browser injected `window.sui` provider is **explicitly deferred
to a follow-up spec** (`sui-dapp-bridge-spec.md`) — the user wants the
WebView integration to land in a separate session. But the seams need
to be in place so flipping it ON later is a one-line change rather than
a re-architecture. This task lands the scaffold: file structure,
disabled boot wire-up, and stub `handleRequest` returning -32601 so
any accidental reach into Sui from a webview during development fails
loudly.

## Scope

- `services/chains/sui/SuiAdapter.ts`:
  ```ts
  export class SuiAdapter implements ChainAdapter {
    readonly namespace = "sui" as const;
    getInjectedScript() {
      return "/* sui injected provider not enabled */";
    }
    onStateChange() { return null; }
    async handleRequest(req: ChainRequest): Promise<ChainResult> {
      return {
        status: "error",
        code: 4200,  // -32601 method not supported (Wallet Standard mapping)
        message: "Sui dApp bridge not enabled in this build",
      };
    }
    async executeApproval(): Promise<unknown> {
      throw new Error("not enabled");
    }
  }
  export function createSuiAdapter(): SuiAdapter { return new SuiAdapter(); }
  ```
- `services/chains/sui/injectedScript.ts` — placeholder file exporting
  `getSuiInjectedScript() => "/* sui disabled */"`. Stays here so the
  follow-up spec only needs to fill it.
- `services/chains/sui/signer.ts` — placeholder
  `installSuiSigner(kit)` that no-ops. Mirrors
  `services/chains/solana/signer.ts` shape so flipping
  `FEATURE_SUI_DAPP_BRIDGE` later is one line.
- `services/chains/sui/payloads.ts` — type-only file declaring
  `SuiConnectPayload`, `SuiSignTxPayload`,
  `SuiSignPersonalMessagePayload`, `SuiSignAndExecuteTxPayload` (and
  their legacy `…Block` aliases per spec §1.3). Mirrors the Solana
  `payloads.ts` shape. **Type-only** — no runtime behaviour, no
  imports from `@mysten/sui` (kept dependency-free so the Hermes
  bundle isn't perturbed by the disabled scaffold). The follow-up
  spec fills `handleRequest` against these types.
- `services/bridge/boot.ts`:
  ```ts
  const FEATURE_SUI_DAPP_BRIDGE = false;
  if (FEATURE_SUI_DAPP_BRIDGE) {
    ChainAdapterRegistry.register(createSuiAdapter());
    installSuiSigner(walletKitRegistry.get("sui"));
  }
  ```
- Tests:
  - `SuiAdapter.test.ts` — `handleRequest` always returns the -32601
    error; `getInjectedScript` returns the placeholder string.
  - Boot test — with the flag OFF, `ChainAdapterRegistry.get("sui")`
    is `undefined`. Flipping the flag in test wires the adapter in.

## Rules (non-negotiable)

- **Flag default is OFF.** No environment / build profile flips this
  to ON in v1. The follow-up spec owns the rollout plan.
- **Placeholder strings, not throwing imports.** The injected-script
  file must return a string (even if empty / commented) so any
  reach-through never causes a JS bundle parse error in the WebView.
- **No partial wiring.** Either the flag is ON (and all four pieces
  — adapter, injected script, signer install, request handler — are
  alive) or it's OFF and they're all inert. Half-wired states are a
  review block.
- **`installSuiSigner` must accept a possibly-undefined kit.** During
  the no-op phase the kit might still be undefined in some test
  contexts; defensive `if (!kit) return;`.

## Acceptance

- [ ] `SuiAdapter` lands with stub `handleRequest`.
- [ ] `injectedScript.ts`, `signer.ts`, and `payloads.ts` placeholders
      land. `payloads.ts` is type-only and imports nothing.
- [ ] `services/bridge/boot.ts` carries the
      `FEATURE_SUI_DAPP_BRIDGE = false` constant + guarded register.
- [ ] Tests confirm OFF-state inertness and ON-state registration.
- [ ] `pnpm check:syntax` passes; `pnpm run test` passes.
- [ ] Flipping the flag locally to `true` shows `window.sui` becomes
      defined in the WebView (manual sanity check; revert before
      merging).

## Out of scope

- Live `window.sui` provider implementation
  (`sui-dapp-bridge-spec.md`).
- Approval sheets, PTB inspector, sign-in-with-Sui (SIWS).
- `reportTransactionEffects` relay.
