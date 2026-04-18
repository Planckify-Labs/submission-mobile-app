# Post-Unlock Freeze — Retrospective

**Status:** Closed (at JS-only ceiling)
**Owner:** Wallet team
**Date:** 2026-04-18
**Related:** `docs/crypto-ui-perf-patterns.md`

---

## TL;DR

After unlock, the home screen was frozen for interactions for several seconds. We burned a lot of time guessing at React / query / network / React-Navigation causes before we actually **profiled** — and then the problem turned out to be mostly **a single un-accelerated crypto library** plus **dev-mode overhead**.

The pure-JS BIP-32 derivation in `@scure/bip32` takes ~1–2 s per wallet in dev and ~200–400 ms in release, and cannot be accelerated by `react-native-quick-crypto` the way we initially assumed. Warming multiple wallets sequentially at unlock time multiplied that cost into multi-second stalls.

---

## Mistakes we made (so you don't repeat them)

### Mistake 1: Guessing before measuring

The majority of the investigation was pattern-matching against the Metro log — retry storms, query invalidations, race conditions, StrictMode double-fires, animation costs, React cascades. Some of those were real bugs and worth fixing. None of them were the primary freeze source.

**What worked:** adding `console.log(Date.now())` timestamps at key phases (tap, biometric, wallets loaded, signers warm, onUnlocked returns, first non-skeleton render). Within one unlock the numbers pointed straight at the bottleneck.

**Rule:** for any "app feels frozen" report, ship timing logs on the first iteration, not the fifth.

### Mistake 2: Believing `react-native-quick-crypto` would accelerate BIP-32

The library's README suggests 10× speedups for "EVM crypto." That's true for primitives that route through `globalThis.crypto.subtle` or Node's `crypto` module (secp256k1 signing, SHA-family hashes, AES, random bytes).

**But `@scure/bip32`** — the library viem uses under `mnemonicToAccount` — bundles its own `@noble/hashes` implementation. It doesn't touch `global.crypto` at all. Installing quick-crypto had zero effect on BIP-32 derivation wall-time.

Evidence (from the timing logs): `mnemonicToAccount` was still 1–2 s per call in dev after quick-crypto was installed and confirmed active via the `@solana/webcrypto-ed25519-polyfill` "falling back to native" warning.

**Rule:** if a library claims X% speedup for a specific op, verify by timing that op specifically, not downstream UX.

### Mistake 3: Assuming `react-native-worklets-core` would offload anything

The worker context doesn't have Metro's `require` function injected. `require("@scure/bip32")` inside a `"worklet"` body throws `Property 'require' doesn't exist`. The worker then crashed on every call and we fell back to main-thread — pure overhead.

Getting a crypto library to run in a worklet would have required either inlining the entire derivation code (hundreds of lines, hostile to security review) or forking the lib to be worklet-compatible. Not worth it for the 100–500 ms potential win.

**Rule:** workers in RN are useful for pure-data computation you own end-to-end. They are hostile to third-party library code that assumes a full Node-style module environment. Don't reach for workers when the code needs `require()`.

### Mistake 4: Pre-warming too eagerly

We had three tiers of pre-warm:
- Tier 1 — active account's paired wallets (EVM + Solana), warmed at unlock
- Tier 2 — up to 50 more wallets in background with `setTimeout(0)` yields
- Tier 3 — lazy on first touch

Profiling showed tier 1 alone was the dominant cost (2 × ~2 s = 4 s). Tier 2 fired immediately after `isLocked` flipped and chained another ~4 s of cascading React + BIP-32 work. Both were eliminated in favor of:

- **Warm ONLY the active wallet** at unlock (single derivation, ~1–2 s)
- **Lazy on everything else** — derivation happens inside the chain-switch overlay or on first access, where the user already expects a wait

**Rule:** pre-warming is only a win if (a) the warmed resource is cheap OR (b) the user is likely to hit it immediately. Warming 50 BIP-32 derivations at boot is neither.

### Mistake 5: Adding phases to LockScreen to "mask" the freeze

We piled on LockScreen phases (Loading wallet → Syncing chains → Preparing wallet → Loading home → Opening app) plus multi-frame yields plus a 400 ms two-phase settle at the end. Each was defensible individually; together they added ~1 s of wait for no perceivable benefit when the real bottleneck was BIP-32.

**Rule:** every `await setTimeout(100)` you add for "React paint" is 100 ms of user wait. Add them when you've measured a specific paint racing with specific work, not as general decoration.

### Mistake 6: `initialData` doesn't backfill

`useQuery({ initialData: () => syncReadFromCache() })` only runs `initialData` on the FIRST render per query instance. If the cache was empty at that moment (e.g. because `LockScreen` hadn't populated it yet), the query permanently held `data: undefined` until the async `queryFn` resolved.

Fix: **`queryClient.setQueryData(key, value)` inside LockScreen** forces the cache to update synchronously, and every subscriber re-renders with real data immediately — even if they'd already completed their first render with empty data.

**Rule:** `initialData` is for "synchronous cache available at first render." When you need to backfill data AFTER other consumers have mounted, use `setQueryData`.

---

## Actual root causes (in order of impact)

### 1. BIP-32 derivation in pure JS (unfixable without native module)

`@scure/bip32` → `@noble/hashes` → pure-JS HMAC-SHA-512 + SHA-256. Single derivation: ~200–400 ms release, ~1–2 s dev mode. Unavoidable with current library choice.

**Fix:** warm only what's necessary, lazy-warm the rest. Real long-term fix is TWV-2026-057 (native-layer signing via Kotlin/Swift Turbo Module).

### 2. Warming multiple wallets sequentially

Tier 1 pre-warm looped `for (const w of account.wallets) await warmWalletSigner(w)`. With 2+ wallets per account, cost multiplied. **Fixed** by warming only the active wallet in `LockScreen.attempt` and removing the tier-1 effect from `useWallet`.

### 3. `useQuery` not seeded on first render

Home mounts behind the LockScreen Modal. `useWallet`'s wallets query ran `initialData()` when `cachedWallets` was still `null` → returned `undefined` → every downstream hook (`useIsAuthenticated`'s `walletKey`, auth-gated queries) saw empty state. **Fixed** by `queryClient.setQueryData([wallets], loaded)` inside `LockScreen.attempt` after `loadWalletsFromStorage` resolves.

### 4. Auth-gated queries firing retry storms

`usePointBalance` and `useRedemptionHistory` had no `enabled: isAuthenticated === true` guard. They fired before tokens were loaded, the `beforeRequest` ky hook threw "Not authenticated," React Query retried, error cascades fanned out. **Fixed** by adding the guard + `retry: false` on both.

### 5. Namespace-pairing backfill on home render

`useWallet`'s backfill effect ran `deriveWalletsFromMnemonic` for missing namespace pairs — heavy work firing on every `isLocked` flip for users upgrading from EVM-only. **Fixed** by moving the backfill inside `LockScreen.attempt` (behind the spinner) and gating the home effect on `isLocked`.

### 6. `refetchOnMount: "always"` in useTokens / useSmartContracts

Each component mount triggered a fresh `/tokens` request → large JSON response → `JSON.stringify(~200 tokens)` + `storage.set` on the main thread. Multiple consumers produced 5× fires per home mount. **Fixed** by changing to `refetchOnMount: true` (honors `staleTime`).

### 7. Dev-mode overhead (unfixable in dev)

Hermes in dev mode runs JS significantly slower than in release — exact multiplier varies by device and op but ~5–10× is common for CPU-heavy workloads. Most of our remaining unlock time in dev is this, not our code.

**Action:** test in a release build (`eas build --profile preview`) to measure the real user-facing number. Dev-mode numbers are not representative.

---

## What fixed what (map)

| Fix | Component freeze removed |
|---|---|
| Warm active wallet only (not pair) | ~50% of LockScreen signer-warming time |
| Remove tier-1 + tier-2 pre-warm effect | ~3–4 s of post-unlock cascade |
| `setQueryData([wallets])` in LockScreen | Activity skeleton flash |
| `primeAuthState` in LockScreen | Activity skeleton + auth-gated query cascade |
| `enabled: isAuthenticated === true` on auth queries | Retry storms (6× duplicate requests) |
| Backfill moved into LockScreen spinner window | Post-unlock derivation thread-blocking |
| `useAppLocked` context gate on heavy effects | Thread being pegged while LockScreen is showing |
| Remove AgentMode pre-mount from `app/index.tsx` | ~300–500 ms of React mount work on unlock frame 0 |
| `react-native-quick-crypto` install | Faster Ed25519 (Solana) + SHA primitives. **Not** BIP-32. |
| `refetchOnMount: true` on useTokens / useSmartContracts | 5× redundant network + MMKV writes per mount |

---

## What's still a ceiling

1. **BIP-32 wall time** — pure JS, ~1–2 s dev / 200–400 ms release per derivation. Only fixable with a native module.
2. **Dev-mode slowdown** — unavoidable in Expo dev builds. Always measure in release before concluding a bug.
3. **React reconciliation cost for large trees** — home has ~10 useQuery consumers + ~15 useEffect-dependent hooks. Every cross-namespace state transition re-renders a lot. Can be tamed with memoization audits or splitting state, but the payoff is marginal compared to the BIP-32 issue.

---

## Recommendations for the next person

1. **If a user reports "app is frozen after X"**, before changing any code:
   - Add `console.log(\`[perf] +\${Date.now() - t0}ms <phase>\`)` at every phase boundary in the suspected path.
   - Add render-time logs in the component the user sees stuck (e.g. `[activity-perf] render with isLoading=X`).
   - Have the user reproduce once and paste the log.
   - Analyze. Then code.

2. **If the path touches crypto libraries**, the first question is "is this native-accelerated?" Don't assume. Benchmark one call with `console.time` / `console.timeEnd`.

3. **Always test perf questions in a release build before concluding.** Dev mode can make a 50 ms op look like a 500 ms op. `eas build --profile preview --platform android` takes 6 minutes and tells you if the problem is real.

4. **When offloading work off the main thread, prefer native modules over worklets.** Worklets-core is great for animation math; hostile to third-party library code.

5. **When `useQuery` needs to be populated from imperative code**, use `queryClient.setQueryData` inside that imperative flow. `initialData` only fires on first render and cannot backfill retroactively.

6. **Guard every auth-gated query** with `enabled: isAuthenticated === true && !isAuthLoading` AND `retry: false`. Otherwise a single missing guard becomes a retry-storm perf incident.

7. **Pre-warming is a strict win only when the warmed item is cheap.** Expensive pre-warm is just freeze-shifting, not freeze-removal.

8. **Keep `docs/crypto-ui-perf-patterns.md` up to date** with every new pattern you land. Future you will forget the subtleties within weeks.
