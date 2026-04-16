# Task 49 — WalletConnect v2 transport + session management UI

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.7

## Why this matters

WalletConnect is the standard protocol for connecting mobile wallets to desktop
dApps. Without it, users can only interact with dApps through the in-app browser.
This task makes TakumiAI Wallet connectable from any WC-compatible desktop dApp.

## Scope

Create:

- `services/walletconnect/WalletConnectTransport.ts`:
  - `pair(uri: string)` — start pairing from a WC URI (scanned or deep-linked).
  - `getSessions(): WCSession[]` — active sessions, persisted across restarts.
  - `disconnect(topic: string)` — disconnect a session.
  - WC v2 sessions produce JSON-RPC requests. Convert them to `ChainRequest`
    and feed into `DappBridge.handleRequest()` — same gate, same inspectors,
    same approval sheets, same event bus.
  - Origin is `{ transport: "walletconnect", ... }` so inspectors can
    distinguish WC requests from WebView requests.
- `services/walletconnect/sessionStore.ts` — persist active sessions in
  `expo-sqlite` across app restarts. Restore on app launch.
- `components/walletconnect/SessionList.tsx` — active sessions list:
  - dApp name, icon, connected chains, connected accounts.
  - "Disconnect" button per session.
- `components/walletconnect/PairingSheet.tsx` — session approval bottom sheet:
  - Shows dApp metadata (name, icon, URL).
  - Requested chains and methods.
  - User approves/rejects per the existing `ApprovalIntent<connect>` flow.
- `app/settings/walletconnect.tsx` — WC session management screen.
- **CAIP-2 namespace mapping**: map `eip155:1` → `Namespace("eip155")` + `chainId: 1`.
  When Solana adapter lands, `solana:mainnet` routes to `SolanaAdapter`
  with zero changes.

## Rules (non-negotiable)

- **WC requests go through DappBridge** — no separate approval path.
- **Session persistence is mandatory** — losing sessions on app restart is
  a dealbreaker for users.
- **Use WalletConnect's public relay** (`relay.walletconnect.com`). Self-hosted
  relay is a follow-up.
- **CAIP-2 mapping must be extensible** — adding Solana namespace is one
  mapping entry, not a rewrite.

## Acceptance

- [ ] Pair with WC URI (from QR scan or deep link).
- [ ] Session approval sheet shows dApp metadata and requested capabilities.
- [ ] Signing requests from WC session route through DappBridge approval flow.
- [ ] Sessions persist across app restarts.
- [ ] Session list shows active sessions with disconnect capability.
- [ ] CAIP-2 → Namespace mapping works for `eip155:*`.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- WC push notifications for background requests (platform task P3).
- Self-hosted relay.
- Solana WC sessions (requires SolanaAdapter from bridge task 30).

## Depends on

- Bridge Phase 1a (`DappBridge.handleRequest()`).
- Platform task P2 (WalletConnect project ID registration).

## Unblocks

- Task 50 (deep links — WC URI handling).
