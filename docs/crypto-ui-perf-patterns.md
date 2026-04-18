# Crypto UI Perf Patterns — Engineering Note

**Status:** Working doc
**Owner:** Wallet team
**Scope:** `takumiaiwallet/mobile-app` — every feature that touches signer derivation, seed phrases, or cross-namespace wallet state
**Date:** 2026-04-18

---

## Why this exists

Cryptographic work — BIP-32 derivation, Ed25519 keypair generation, SLIP-0010, SIWE/SIWS signing — is **synchronous and main-thread-blocking** in React Native / Hermes. Viem's `mnemonicToAccount` costs ~100–500 ms per call on a mid-tier mobile device. `createKeyPairFromPrivateKeyBytes` for Solana costs ~50–200 ms via the WebCrypto polyfill. `deriveWalletsFromMnemonic` across multiple namespaces multiplies that.

When these fire on the render thread — inside a `useMemo`, an un-yielded `onPress` handler, or an effect that runs while a blocking UI (LockScreen, chain-switch modal) is up — the JS thread freezes. Users see the symptom as "the app is stuck", "the button doesn't work", "the switch happened but the spinner never showed". The root cause is always the same: crypto ran on the render thread without the main thread getting a chance to paint state changes first.

This doc captures the five patterns we've landed to fix this class of bug. Apply them for every new chain, every new signer surface, every new tap that triggers crypto.

---

## Pattern 1 — Yield before heavy work (the 100 ms hack)

**When**: any user-triggered action that kicks off sync crypto (signing, deriving, switching wallets, creating a wallet, PIN confirmation).

**Why it's needed**: React 18's automatic batching collapses `setLoading(true)` with any state updates the subsequent synchronous work triggers. Without a yield, React commits them all at once *after* the heavy work finishes, so the spinner state is logically set but never visually painted. User experiences the tap as dead.

**How**:

```ts
const onPress = async () => {
  if (busy) return;
  setBusy(true);

  // 100 ms yield — lets React commit the spinner and the GPU paint that
  // frame BEFORE the heavy sync work starts.
  await new Promise((r) => setTimeout(r, 100));

  try {
    await doHeavyCrypto();
  } finally {
    setBusy(false);
  }
};
```

**The number** is 100 ms. That's the well-tested value in this codebase (`app/send.tsx:392`). 16 ms (`requestAnimationFrame`) works but is tight on Android. 300 ms (`app/auth.tsx:145`) is fine for flows where the crypto step is heavier than the nav animation. Never go below 50 ms. Never above 500 ms — users start to feel the delay.

**Canonical call sites**:
- `app/send.tsx:385-392` — the reference implementation
- `app/auth.tsx:145` — 300 ms before ECDSA / Ed25519 signing
- `components/common/ChainSelector.tsx` — `handleChainSelect`, `requestAnimationFrame` variant
- `components/security/LockScreen.tsx` — two 100 ms yields (before biometric + before wallet load)
- `app/address-book.tsx` / `components/home/Main/ActivitySection.tsx` — sign-in navigation buttons

**Do NOT apply this pattern to back navigation.** Back-nav delay is almost always a *teardown* problem (FlatList unmounting too many rows, reanimated shared values being disposed, parent refocus effects firing) — not a tap-to-transition-start problem. Adding a 100 ms yield to a back button ADDS to the perceived delay instead of hiding it. See pattern 6.

**Anti-patterns**:
- `setLoading(true); await heavyFn(); setLoading(false)` with no yield between the first two. The spinner never appears.
- Using `setImmediate` / `queueMicrotask` — both stay inside the current tick. `setTimeout(0)` also stays too close (microtask); use ≥ 100 ms for reliable paint on low-end Android.

---

## Pattern 2 — Lock gate (`useAppLocked` context)

**When**: any effect, hook, or module-level work that calls into crypto OR touches SecureStore OR fires auth'd network requests on mount.

**Why it's needed**: the LockScreen is a floating `<Modal>` over the Stack. Home and every other route mount underneath it, meaning every hook runs while the user is still on the lock screen. If any of those hooks fire heavy crypto, the Unlock button freezes because the JS thread is busy. Users can't even enter the app.

**How**: read `useAppLocked()` from `@/app/_layout` and early-return when it's `true`.

```ts
// hooks/queries/useAuth.ts (excerpt)
export const useIsAuthenticated = () => {
  const isLocked = useAppLocked();
  const walletKey = activeWallet?.address?.toLowerCase() || null;

  useEffect(() => {
    if (isLocked) return; // ← gate every side-effect
    // ... 5 SecureStore reads, refresh mutation, etc.
  }, [walletKey, isLocked]);
};
```

**The context lives at `app/_layout.tsx`**:

```ts
export const AppLockedContext = createContext<boolean>(false);
export const useAppLocked = (): boolean => useContext(AppLockedContext);
```

The `AppShell` component sets the initial value synchronously from `hasStoredWallets()` (MMKV sync) so the gate is active on the very first render.

**What's currently gated** (keep this list current as you add chains):
- `hooks/queries/useAuth.ts::useIsAuthenticated` — SecureStore cascade + refresh POST
- `hooks/useWallet.ts` pre-warm effect — BIP-32 / Ed25519 derivation for active-account + progressive warm
- `hooks/useWallet.ts` backfill effect — `deriveWalletsFromMnemonic` for missing-namespace pairing
- `hooks/deposit/useDepositPrefetch.ts` — `require()` of viem-heavy modules + smart-contract prefetch
- `app/index.tsx` AgentMode pre-mount — because AgentMode's `executorContext` memo calls `getAccountForWallet` synchronously during render

**Rule for new features**: if your new hook touches `walletService`, `@solana/kit`, `viem/accounts`, any SecureStore API, any auth'd backend call, or any `deriveWalletsFromMnemonic`-adjacent helper — add the `useAppLocked()` gate. Default to gating; the cost of gating a benign hook is zero (an extra boolean check) and the cost of NOT gating a heavy one is a frozen Unlock button.

---

## Pattern 3 — Chain-switching overlay for cross-namespace switches

**When**: any cross-namespace chain or wallet switch (EVM ↔ Solana ↔ Sui ↔ …). Intra-namespace switches (EVM ↔ EVM) do NOT need this — no wallet change, no derivation cost.

**Why it's needed**: cross-namespace switches force a wallet swap (`activeWallet` changes). That triggers first-touch signer derivation for the target wallet on the render thread. Without an overlay, the UI looks stuck for 100–500 ms. With a premature overlay dismiss (the bug from the first iteration), the spinner flashes and the heavy work runs *after* the overlay is gone — even worse UX.

**How**: use `runWithChainSwitchingOverlay` from `@/components/common/ChainSwitchingOverlay`. It handles the show → yield → run → hide sequence correctly.

```ts
import { runWithChainSwitchingOverlay } from "@/components/common/ChainSwitchingOverlay";

await runWithChainSwitchingOverlay(
  `Switching to ${chainLabel}…`,
  async () => {
    // 1. HEAVY — derivation for the target wallet. Must `await`.
    await warmWalletSigner(targetWallet);
    // 2. Atomic state commit.
    commit();
    // 3. Optional tail yield so the post-commit render paints against
    //    warm caches before the overlay tears down.
    await new Promise((r) => setTimeout(r, 50));
  },
);
```

The overlay is mounted once at `app/_layout.tsx` and driven by a module-level store (`chainSwitching.begin / end`). Any caller can trigger it from anywhere — no context provider wiring needed.

**Canonical call sites**:
- `hooks/useWallet.ts::changeActiveChainInternal` and `::changeActiveChainToConfig` — cross-namespace branch wraps both in `runWithChainSwitchingOverlay`
- `app/wallet.tsx::handleAccountSwitch` — wallet/account switches on the wallet screen. Same overlay because a wallet switch fires the same signer-derivation + downstream-effect cascade even within a single namespace. Plus the blocking Modal gives the user a clear "don't navigate away" signal — without it, users tap a card, see a brief visual dim, and may hit back before the switch settles, leaving downstream state inconsistent.

**When to use the overlay vs. inline spinner**:
- **Overlay** — the action is heavy enough (>150 ms) that the user might try to navigate away OR the action mutates cross-screen state (active wallet, active chain) that a half-complete switch would corrupt. Use when navigation-back would produce an inconsistent view.
- **Inline spinner** (button/row state change) — the action is quick and contained. User sees local feedback and the rest of the screen stays interactive. Use for nav-triggered loading on the source screen (pattern 1).

**Extend when adding a chain**: if the new chain introduces a distinct wallet type, the cross-namespace logic in `changeActiveChainInternal` already handles it via `pickWalletForChain`. You just need to make sure `warmWalletSigner` knows how to derive the new kind of signer (`services/walletService.ts` has the switch on `wallet.namespace`). Add your branch there.

---

## Pattern 4 — Signer pre-warming

**When**: any code path that might need a signer later but isn't signing right now. Specifically: after wallet load, after account switch, on chain-selector open ("warm on hover").

**Why it's needed**: the first call to `getAccountForWallet` / `getSolanaSignerForWallet` for a given wallet pays the full derivation tax. Every subsequent call is a cache hit (free). Pre-warming during idle time moves the tax off the user's critical path.

**How**: the pre-warm happens in three tiers (`hooks/useWallet.ts`):

1. **Tier 1 — active account** (always warmed). The paired EVM + Solana wallets of the currently-active account. Constant cost (usually 2 derivations) regardless of total wallet count.
2. **Tier 2 — background progressive** (capped at `PREWARM_MAX_EXTRA = 50`). Every other wallet, yielded between each via `setTimeout(0)` so the main thread stays responsive during warming. Scheduled via `InteractionManager.runAfterInteractions` so it doesn't fight the first paint.
3. **Tier 3 — lazy fallback** (unchanged). Wallet 51+ and any wallet imported after boot pays the one-time tax on first use.

Plus warm-on-hover in `ChainSelector`: when the picker opens, fire `warmNamespace("eip155")` / `warmNamespace("solana")` so whichever row the user picks is already warm by the time their tap lands.

**Extend when adding a chain**: add a branch in the module-level `warmWalletSigner` helper in `hooks/useWallet.ts`:

```ts
async function warmWalletSigner(w: TWallet): Promise<void> {
  try {
    if (w.namespace === "eip155") {
      walletService.getAccountForWallet(w);
    } else if (w.namespace === "solana") {
      await walletService.getSolanaSignerForWallet(w);
    } else if (w.namespace === "sui") {
      await walletService.getSuiSignerForWallet(w); // ← new branch
    }
  } catch (err) {
    if (__DEV__) console.warn(`[useWallet] warm failed for ${w.address}:`, err);
  }
}
```

Also add the equivalent `getSuiSignerForWallet` in `services/walletService.ts` following the TWV-2026-070 dwell-site rules (single blessed JS-heap dwell, extractable-false CryptoKey, module-level cache wiped on `clearAccountCache`).

---

## Pattern 5 — Reset spinner state on screen focus

**When**: any button that triggers navigation and shows a local loading state (like "Opening sign-in…" on the SIWS CTA).

**Why it's needed**: if the user navigates away and comes back (cancels on `/auth`, hits hardware back, etc.), the component stays mounted in expo-router's stack cache. Its local `useState` doesn't reset. The spinner state persists and the button looks broken.

**How**: `useFocusEffect` from `@react-navigation/native` to clear the state when the screen regains focus.

```ts
import { useFocusEffect } from "@react-navigation/native";

const [navigating, setNavigating] = useState(false);

useFocusEffect(
  useCallback(() => {
    setNavigating(false);
  }, []),
);
```

**Canonical call sites**:
- `app/address-book.tsx` — `goToAuth` spinner
- `components/home/Main/ActivitySection.tsx::SignInCta` — home sign-in button

---

## Pattern 6 — Windowing lists that use reanimated rows

**When**: any screen rendering a list (FlatList, ScrollView map, etc.) where each row owns reanimated `useSharedValue`, `useAnimatedStyle`, or a `GestureDetector`. Also: any row that does a `FadeInDown` / `FadeInRight` mount animation with per-row delay.

**Why it's needed**: FlatList's defaults are `windowSize: 21` (in viewport heights) — on a screen of 30 contacts it keeps ~30 rows mounted. Each mounted row is a reanimated tree (shared values, animated styles, gesture handlers). When the user navigates away (forward OR back), the native stack kicks off a 300 ms transition animation on the UI thread, while React tears down all those reanimated trees on the JS thread. The two contend for frames and the transition looks janky — what the user calls "back nav is laggy".

**How**: tune FlatList windowing props.

```tsx
<FlatList
  data={items}
  renderItem={renderItem}
  keyExtractor={keyExtractor}
  // These 4 props are the fix:
  removeClippedSubviews       // clip offscreen rows at the native layer
  initialNumToRender={8}       // mount only 8 rows on first paint
  maxToRenderPerBatch={6}      // per-frame mount budget during scroll
  windowSize={5}               // keep ~2 viewports total in memory
  // …
/>
```

For lists where each row is genuinely expensive (deep component trees, reanimated), consider `FlashList` from Shopify — recycles row instances instead of mounting/unmounting. ActivitySection already uses FlashList; follow that pattern for new heavy lists.

**Canonical call sites**:
- `app/address-book.tsx` — the back-nav delay bug was literally this (N reanimated rows × slow teardown). Windowing config fixes it.
- `components/home/Main/ActivitySection.tsx` — FlashList with recycling.

**Rule for new list screens**: if your rows use reanimated primitives OR gesture handlers OR per-row entering animations, do NOT accept FlatList's defaults. Either tune windowing (as above) or reach for FlashList.

---

## Space-docking implications for new chains

The wallet is already built on the space-docking pattern (see `docs/solana-adapter-spec.md` §2, `docs/dapp-bridge-spec.md` §2). Every new chain plugs in via `WalletKitAdapter` + `ChainAdapter` — no branches in shared code.

The perf patterns above **compose with docking**. None of them require shared-file edits when a new chain lands. Concrete checklist:

1. **New kit** (`services/walletKit/<new-chain>/<NewChain>WalletKit.ts`) — register in `bootWalletKits()`. Implements `getSignerForWallet`, `getNativeBalance`, etc.
2. **New signer dwell site** (`services/walletService.ts`) — add `get<NewChain>SignerForWallet(wallet)` alongside the EVM and Solana ones. Follow TWV-2026-070 (single dwell, non-extractable key, module-level cache).
3. **Add the warm branch** in `warmWalletSigner` (pattern 4 above). That's the single place where "how do I derive a signer for this namespace" is encoded.
4. **Chain selector, switcher, and overlay** work automatically. `changeActiveChainInternal` routes via `buildChainConfigFromBlockchain`; cross-namespace overlay fires whenever `pickWalletForChain` returns a target.
5. **Lock gates stay correct**. All shared hooks read `useAppLocked()` — new chain's signer derivation inherits the gate automatically when it flows through the existing warm path.
6. **Add decoders + inspectors** per the dApp bridge spec. These run inside the `IntentInspector` pipeline and don't touch the perf-critical path.

If a new chain introduces a fundamentally different signer primitive (e.g. MPC-based, hardware-only, threshold signatures), the principle stays the same: **whatever part of the derivation blocks the JS thread goes behind pattern 1 (yield) + pattern 2 (lock gate) + pattern 4 (pre-warm)**.

---

## Future perf frontier

Things we haven't needed yet but which will likely come up as the wallet matures. Noted so the next person isn't blindsided:

- **Native-layer signing** (TWV-2026-057). Moving derivation to native code removes the JS-thread-block problem entirely. Until then, pattern 1 + 2 are the only defense.
- **JSI-backed crypto** (react-native-quick-crypto, react-native-mmkv already uses JSI). Similar win — native-speed, no main-thread cost.
- **Worker threads** (react-native-worklets, react-native-bridgeless). Useful for background derivation post-boot.
- **Token-2022 confidential transfer ZK proofs**. Order of magnitude heavier than standard derivation; when these land (see `docs/solana-adapter-spec.md` §9), pattern 1 is not enough — we need worker offload.

When those migrations happen, the overlay + lock-gate patterns stay exactly as they are. The underlying async boundary moves, but the UI contracts don't change.

---

## Quick-reference decision tree

For any new feature that touches crypto:

1. **Does it run on a user tap?** → Pattern 1 (yield 100 ms after setting loading state). **Exception: back navigation** — yield hides nothing, see pattern 6.
2. **Does it run in a hook / effect on mount?** → Pattern 2 (`useAppLocked` gate).
3. **Is it a chain/wallet switch that crosses namespaces?** → Pattern 3 (overlay).
4. **Will the user need a signer we haven't derived yet?** → Pattern 4 (pre-warm).
5. **Does it show a local spinner before navigation?** → Pattern 5 (reset on focus).
6. **Does the screen render a list of reanimated / gesture-enabled rows?** → Pattern 6 (windowing).

Apply all that match. The cost is a few lines of code per call site; the benefit is an app that never freezes on crypto work and never lags through a transition.
