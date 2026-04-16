# No runtime remote JS loading in the app process

**Spec reference:** `wallet-security-vulnerabilities-spec.md`
TWV-2026-019 (task 47). Companion: TWV-2026-055 (task 9, EAS Update
code signing), TWV-2026-056 (task 32, bundle-integrity runtime check).

**Status:** Audit + policy. Ran at commit of this note.

The `@ledgerhq/connect-kit-loader` supply-chain compromise (Dec 2023,
$600k drained via Angel Drainer; SushiSwap, Kyber, Revoke.cash, and
Zapper affected) replaced a CDN-loaded script with a drainer. Any
wallet process that loads JS from outside the signed bundle is one
CDN compromise away from that class of loss. Expo/Hermes ships
everything at build time, but this note records the audit result and
freezes the rule as non-negotiable going forward.

## 1. Rule (non-negotiable)

- No string-to-code evaluation primitives (the dynamic-code builtins
  that take a string and return executable behaviour) in any
  app-process file, in any form.
- No dynamic `import()` whose URL argument is computed at runtime.
  Static string arguments — `await import("./sseClient.ts")` — are
  resolved by Metro at build time and are permitted.
- No `require(runtimeString)`. `require("expo-secure-store")` and
  similar constant-string requires are fine (they are bundled).
- Injected provider script (`services/chains/evm/injectedScript.ts`)
  is a build-time-bundled module. It is not fetched from a CDN or
  npm registry at runtime.
- No `WebView.injectJavaScript(fetchedString)` pattern. All
  `injectJavaScript` / `injectedJavaScript` callers must pass a
  bundled string. A string computed from user data is fine when the
  data is serialised with `JSON.stringify` and embedded in a template
  literal — that is not "remote JS," it is "data-in-code."
- The dApp-browser WebView is the explicit exception: the dApp loads
  its own remote JS. That is the dApp's problem. The wallet protects
  itself via simulation (task 17), calldata decoding (task 8), and
  allowlist checks (tasks 13, 30). This boundary is explicit; do not
  blur it.

## 2. Audit run — 2026-04-16

Ripgrep queries and findings:

### 2.1 String-to-code primitives

Searched for the dynamic-code builtin identifiers across
`--type ts --type tsx --type js --type jsx`.

**Finding:** zero matches in app code. Only TypeScript type-level
mentions (e.g., `typeof foo === "function"`) match the broad pattern;
none construct executable code from a string.

### 2.2 Dynamic `import()` / `require(...)`

Searched for `await import(...)` and `require(...)` with
non-string-literal arguments across `--type ts --type tsx`.

**Finding:** every `await import(...)` and `require(...)` call in
the app code uses a **static string literal**. Representative
samples:

- `services/agentSession/dispatcher.ts:236` — `await
  import("./executeToolWithRetry...")`. Static relative path.
- `services/agentSession/agentSession.ts:186` — `await
  import("./sseClient.ts")`. Static relative path.
- `services/agent-executors/retry.ts:177` — `await
  import("./index.ts")`. Static relative path.
- `services/transferThresholdStore.ts:110` — `require("expo-secure-store")`.
  Static package name.
- `services/permissionGrantStore.ts:66` — same.
- `components/wallet/WalletDetails.tsx:12` — `React.lazy(() =>
  import("@/components/wallet/WalletInfoDisplay"))`. Static alias
  path resolved at build time.

None of these compute the argument at runtime. Every one is a
dependency that Metro resolves during bundling.

### 2.3 WebView injection

Searched for `injectJavaScript` and `injectedJavaScript` across
`--type ts --type tsx`.

**Finding:** four call sites, all passing bundled strings:

- `app/dapps-browser.tsx:100` — `webViewRef.current?.injectJavaScript(
  injectedJavaScript)` where `injectedJavaScript` is a
  `useMemo(() => getEvmInjectedScript(...), [...])` result — built
  from `services/chains/evm/injectedScript.ts`, which is bundled.
- `app/dapps-browser.tsx:244, :250` — `injectedJavaScriptBeforeContentLoaded`
  / `injectedJavaScript` props; same bundled source.
- `app/dapps-browser.tsx:263` — re-injection on navigation using
  the same bundled template.
- `services/bridge/DappBridge.ts:266, :287, :390` — post-connect
  state updates. The injected code is a **template literal** with
  `JSON.stringify(addr)` etc. embedded — data-in-code, not remote
  JS. No fetched string is passed through `injectJavaScript`.

### 2.4 Injected provider script

`services/chains/evm/injectedScript.ts` exports `getEvmInjectedScript`
which builds the EIP-1193 provider script from `./eip6963.ts`
(`buildAnnounceScript`). Both files ship in the bundle; Metro
resolves them at build time. Zero CDN references. Zero `fetch()` of
JS.

Bundler config (`metro.config.js`) has no remote-JS resolver plugin.

## 3. Expected result met

The audit ran with the expectation of zero findings, and zero
findings were recorded. No immediate-fix tickets were filed.

## 4. Review gate

Reviewers: block PRs that add any of the following, unless the PR
cites TWV-2026-019 and documents the compensating control:

- A `WebView.injectJavaScript(x)` where `x` is not a bundled or
  `JSON.stringify`-constructed string.
- A `require(str)` / `await import(str)` where `str` is a binding
  rather than a literal.
- A call to a string-to-code evaluation primitive.
- A `fetch(...)` that feeds the response into `injectJavaScript`
  or any code-execution primitive.
- A package that shells out to a CDN-hosted loader at startup.

## 5. Lint / CI follow-up

Tracked as a follow-up (not blocking this audit): an ESLint / Biome
rule that flags string-to-code primitives and dynamic-argument
`import()` in diff view. Ship alongside the next dev-tooling PR.

## 6. Cross-links

- Task 9 / TWV-2026-055 — EAS Update code signing. OTA updates are
  signed code, not runtime remote JS.
- Task 32 / TWV-2026-056 — launch-time bundle SHA-256 check.
- Task 18 / TWV-2026-013 — WebView hardening; the dApp-browser
  boundary lives there.
