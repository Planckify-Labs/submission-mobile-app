# Task 14 — Boot register + signer guard + inspector boot registration

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-dapp-bridge-spec.md` §10 (boot diff), §8.4 (inspector boot registration).

## Why this matters

Everything before this task is dormant code. This task wires the
`SuiAdapter` into the registry, registers the three inspectors, and
installs the bridge-side signer behind the wallet-kit guard. After this
task lands the bridge accepts Sui requests — but the `FEATURE_SUI_DAPP_BRIDGE`
flag (Task 20) keeps them gated until ship time.

## Scope

- `services/bridge/boot.ts` per §10:
  - After `ChainAdapterRegistry.register(solanaAdapter)`:
    ```ts
    const suiAdapter = createSuiAdapter();
    ChainAdapterRegistry.register(suiAdapter);
    ```
  - Per §8.4, after the SIWS Solana inspector registration:
    ```ts
    InspectorRegistry.register(SuiPtbDecoderInspector);
    InspectorRegistry.register(SuiSimulationInspector);
    InspectorRegistry.register(SuiSiwsInspector);
    ```
  - Behind `walletKitRegistry.has("sui")` guard mirroring
    `services/bridge/boot.ts:100-121`:
    ```ts
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
      booted = false;
    }
    ```
- Re-test cold + warm Fast Refresh — the auto-retry on `booted = false`
  must catch the kit becoming available between mounts.

## Rules (non-negotiable)

- **Wallet-kit guard is mandatory.** Without it, `installSuiSigner` throws
  at install time (Task 05), poisoning the bridge.
- **Inspector registration uses `InspectorRegistry.register`** —
  do NOT push directly to whatever array; ordering is by priority, not
  insertion.
- **`booted = false` on missing kit** — same auto-retry pattern Solana
  uses. Fast Refresh re-runs `bootBridge`; if the kit landed in the
  meantime, retry succeeds.
- **No hard-coded mainnet RPC.** Read from
  `EXPO_PUBLIC_SUI_*_RPC` env when present; fallback to public
  fullnode URLs above.

## Acceptance

- [ ] Cold boot with Sui kit present: adapter + signer + inspectors
      registered, no warnings.
- [ ] Cold boot without Sui kit (e.g. wallet-kit spec not landed):
      adapter + inspectors registered, signer NOT installed, dev warning
      logged once, `booted = false`.
- [ ] Warm Fast Refresh after kit becomes available retries successfully.
- [ ] EVM + Solana bridge flows unchanged.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- `FEATURE_SUI_DAPP_BRIDGE` flip (Task 20).
- `installSuiSigner` itself (Task 05).
