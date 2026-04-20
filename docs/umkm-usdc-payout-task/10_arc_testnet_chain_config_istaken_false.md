# Task 10 — Arc Testnet `ChainConfig` + Base Sepolia wiring

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §7, §10, §11 M2

## Why this matters

M2 needs the mobile app to hold USDC on Base Sepolia (Nanopay source) and
talk to Arc Testnet (settlement destination). Both need to be in
`chainConfig.ts` so `useWallet` can activate them through the usual seam.

## Scope

- Add an entry to `constants/configs/chainConfig.ts` for **Arc Testnet** per
  §7:
  ```ts
  {
    namespace: "eip155",
    chain: {
      id: 5042002,
      name: "Arc Testnet",
      nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
      rpcUrls:        { default: { http: [process.env.EXPO_PUBLIC_ARC_RPC_URL!] } },
      blockExplorers: { default: { name: "Arcscan", url: "https://testnet.arcscan.app" } },
    },
    iconUrl: "…",        // from docs.arc.network; pin an in-repo copy
    isTestnet: true,
  }
  ```
- Verify Base Sepolia entry already exists and exposes
  `EXPO_PUBLIC_USDC_BASE_SEPOLIA_ADDRESS` via a token-registry helper. If
  not, add it — tasks 11–15 assume Base Sepolia USDC is addressable from
  the token registry.
- Extend `.env.example` with the full UMKM block from §10: `EXPO_PUBLIC_ARC_*`,
  `EXPO_PUBLIC_NANOPAY_SOURCE_CHAIN_ID`, `EXPO_PUBLIC_USDC_*`,
  `EXPO_PUBLIC_CIRCLE_GATEWAY_*`, `EXPO_PUBLIC_CIRCLE_NANOPAY_*`,
  `EXPO_PUBLIC_CIRCLE_PAYMASTER_V07`, `EXPO_PUBLIC_ERC4337_BUNDLER_*`,
  `EXPO_PUBLIC_X402_DEFAULT_FACILITATOR`, `EXPO_PUBLIC_TAKUMIPAY_QR_PUBKEY_JWK`.
- Add `USDC on Arc Testnet` at `0x3600…0000` (6-decimals interface view) to
  the token registry. Document in a code comment that native view is 18
  decimals but the ERC-20 interface is 6 — EvmWalletKit must stay on the
  ERC-20 view for transfer math.
- No env values filled in — leave blanks so each engineer fills from their
  own credential-setup run (§13).

## Rules (non-negotiable)

- **One knob per chain.** RPC URL is only read from env; never hardcode a
  URL into any service.
- **Do not ship mainnet addresses in M2.** §7 locks v1 to testnet; mainnet
  migration is §10.1's checklist and a separate PR.
- **Token decimals.** USDC on Arc advertises 18 at the chain level but 6 in
  the ERC-20 interface. All merchant-payment math uses the ERC-20 6-dec
  view. Comment this inline.

## Acceptance

- [ ] `constants/configs/chainConfig.ts` includes Arc Testnet.
- [ ] `.env.example` contains every var from §10.
- [ ] Token registry returns USDC for both Base Sepolia and Arc Testnet
      with 6-decimals metadata.
- [ ] `pnpm check:syntax` passes.
- [ ] Manual: switching the active chain to Arc Testnet via the existing
      chain picker renders the USDC balance (0 is fine).

## Out of scope

- Adding `WalletKitAdapter` methods — that's task 11.
- Mainnet addresses — §10.1 migration, separate PR.
