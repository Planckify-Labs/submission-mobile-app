# Task 50 — Deep link handling: EIP-681, WC URIs, custom schemes

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.8

## Why this matters

Users encounter wallet-related URIs everywhere: payment links, WC QR codes,
dApp deep links. The app must handle them natively to be a first-class citizen
in the Ethereum ecosystem.

## Scope

Create:

- `services/deeplinks/eip681.ts` — EIP-681 URI parser:
  - Parse full spec: `ethereum:0x1234@137/transfer?address=0x5678&uint256=1e18`.
  - Extract: target address, chainId, function name, parameters, value.
  - Handle edge cases: missing chainId (default to current), missing function
    (native transfer), scientific notation amounts.
  - Returns a typed `EIP681Intent` that pre-fills the send flow.
- `services/deeplinks/router.ts` — URI scheme → screen mapping:
  - `ethereum:*` → parse EIP-681 → open send flow pre-filled.
  - `wc:*` → extract WC URI → initiate pairing (task 49).
  - `takumiwallet://send?to=&amount=&chain=` → internal send deep link.
  - `takumiwallet://dapp?url=` → open dApp browser to URL.
  - `takumiwallet://connect?uri=` → WC pairing via deep link.
  - Unknown → toast: "Unrecognized link".
- Register URL schemes in `app.config.ts`:
  - `takumiwallet://` custom scheme.
  - `ethereum:` scheme (via intent filters on Android / URL types on iOS).
- Handle incoming links in `app/_layout.tsx` via `expo-linking`:
  - On cold start: check initial URL.
  - On warm start: listen for incoming URL events.
  - Route to `deeplinks/router.ts`.
- **Chain mismatch handling**: if EIP-681 specifies a chain the user isn't on,
  prompt `wallet_switchEthereumChain` before opening the send flow.
- **Security**: deep links that trigger signing or transactions always show
  the approval sheet. Never auto-approve from a deep link. Origin is
  `"deeplink://<scheme>"`.

## Rules (non-negotiable)

- **Never auto-approve from a deep link** — always show approval sheet.
- **EIP-681 parser must handle the full spec**, including function calls with
  typed parameters (`uint256`, `address`, `bytes`).
- **Chain mismatch must prompt** — don't silently switch chains.
- **Unknown URIs fail gracefully** — toast, not crash.

## Acceptance

- [ ] `ethereum:0x1234` opens send flow with recipient pre-filled.
- [ ] `ethereum:0x1234@137/transfer?address=0x5678&uint256=1e18` pre-fills
      full token transfer on Polygon.
- [ ] `wc:` URI initiates WalletConnect pairing.
- [ ] `takumiwallet://send` opens send flow with params.
- [ ] `takumiwallet://dapp?url=` opens dApp browser.
- [ ] Chain mismatch shows switch chain prompt.
- [ ] Cold start + warm start deep links both work.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- QR scanner (task 51 — produces URIs that feed into this router).

## Depends on

- Task 49 (WalletConnect — for `wc:` URI handling).
