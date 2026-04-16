# Bridge boundary — Zod-validated payloads (TWV-2026-021)

**Owner:** mobile-app · **Spec ref:**
`docs/wallet-security-vulnerabilities-spec.md` TWV-2026-021.

## The rule

The outermost trust boundary between the WebView and the wallet is
`app/dapps-browser.tsx#handleMessage` → `DappBridge#dispatch`. Every
EIP-1193 payload that crosses it MUST be parsed through a Zod schema
before any property read. Dynamic-key reads on untrusted input are
forbidden.

Combined with the boot-time `Object.freeze(Object.prototype)` in
`pollyfills.ts`, prototype-pollution CVEs in transitive deps cannot
mutate the parsed payload mid-request.

## Current dispatch entry points

| Method                              | File                                      | Schema source                                    |
|-------------------------------------|-------------------------------------------|--------------------------------------------------|
| `eth_sendTransaction`               | `services/chains/evm/EvmAdapter.ts`       | `EvmSendTxPayload` shape in `payloads.ts`        |
| `eth_signTypedData_v4`              | `services/chains/evm/EvmAdapter.ts`       | `EvmSignTypedDataPayload` shape in `payloads.ts` |
| `personal_sign`                     | `services/chains/evm/EvmAdapter.ts`       | `EvmSignMessagePayload` shape in `payloads.ts`   |
| `wallet_addEthereumChain` (EIP-3085)| `services/chains/evm/EvmAdapter.ts`       | `EvmAddChainPayload` shape in `payloads.ts`      |
| `wallet_switchEthereumChain`        | `services/chains/evm/EvmAdapter.ts`       | `EvmSwitchChainPayload` shape in `payloads.ts`   |
| `wallet_watchAsset`                 | `services/chains/evm/EvmAdapter.ts`       | `EvmWatchAssetPayload` shape in `payloads.ts`    |
| EIP-7702 authorisation              | `services/chains/evm/EvmAdapter.ts`       | `EvmAuthorizationPayload` shape in `payloads.ts` |

The `payloads.ts` shapes are TypeScript interfaces today; converting
to Zod runtime schemas is a `TODO(twv-021)` for each handler. Until
then:

- The bridge wrapper (`DappBridge.dispatch`) MUST treat every parsed
  field as `unknown` and narrow with `typeof` / `Array.isArray` /
  explicit shape checks before passing to the adapter.
- The adapter handlers MUST do the same on first read.
- A Zod schema lives in the same file as the corresponding TypeScript
  interface; runtime parse uses `.safeParse` and bails to
  `PROVIDER_ERRORS.invalidParams(...)` on failure.

## Review gate

Any PR that adds or widens an EIP-1193 method handler MUST:

1. Cite TWV-2026-021 in the description.
2. Add (or update) a Zod schema in `payloads.ts` for the new shape.
3. Confirm no property is read off the raw `params` array without
   a shape check first.
