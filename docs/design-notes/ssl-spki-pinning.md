# SSL / SPKI pinning — TWV-2026-026

**Owner:** mobile-app · **Spec ref:** TWV-2026-026.

> **Status:** Native networking work. `expo-network` and Expo's default
> `fetch` do not pin certificates; this requires `react-native-ssl-pinning`
> or an iOS `URLSessionDelegate` + Android `OkHttp.CertificatePinner`
> bridge. The JS-side hooks below describe what callers must do once
> the native module lands.

## Hosts to pin

Pin SubjectPublicKeyInfo (SPKI) hashes — not full certs — so leaf
rotation doesn't require an app update.

| Host | Why |
|---|---|
| `takumipay-api` backend hosts | Auth tokens flow through this — MITM = full account takeover |
| Pinned RPC hosts (per chain — see TWV-2026-028) | Critical reads, simulator (TWV-2026-011), 7702 bytecode sniff (TWV-2026-010) |
| EAS Update CDN | Code-signing manifest fetch (TWV-2026-055). Belt-and-braces with the signature itself. |
| Scam-domain feed host (TWV-2026-051) | Lookups must resolve via a trusted path |
| `takumi.wallet` (App Links AASA / assetlinks.json — TWV-2026-024) | Verification fetch by Apple / Google must hit the real host |

## JS surface

When the native pinning module ships, every fetch call site in the
list above MUST switch from the default `fetch` to a pinned wrapper
exported from `services/security/pinnedFetch.ts` (to be created).
Pin failures throw a stable error code (`PINNED_HOST_PIN_FAILED`)
that callers surface as "network unavailable — try again on a
trusted network", never as a silent fallback.

## Pre-implementation checklist

- [ ] Pick the native module (`react-native-ssl-pinning` is the
      battle-tested option).
- [ ] Generate SPKI hashes for the current cert + the next backup
      cert; commit both so a rotation doesn't brick clients.
- [ ] Implement `services/security/pinnedFetch.ts`.
- [ ] Migrate the call sites listed above; add lint rule to forbid
      bare `fetch(` calls to those hosts.
- [ ] Document the rotation runbook (`docs/runbooks/spki-rotation.md`).

## Review gate

Any PR that adds a fetch to a host on the pinned list MUST cite
TWV-2026-026 and route through `pinnedFetch`.
