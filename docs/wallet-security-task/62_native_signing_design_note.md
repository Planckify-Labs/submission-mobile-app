# Task 62 — Native-signing design note (TWV-2026-057)

**Status:** Design note. No runtime migration in this task.
**Companion task file:** `62_hermes_only_native_signing_twv057_istaken_true.md`
**Review gate:** Added as a top-of-file comment in
`services/walletService.ts`. Any PR that touches the signing path must
reference this note.

## 1. Hermes audit — `app.config.ts`

Verified at commit of this note:

- Root `jsEngine: "hermes"` — present (`app.config.ts:33`).
- `ios.jsEngine: "hermes"` — present (`app.config.ts:37`).
- `android.jsEngine: "hermes"` — present (`app.config.ts:49`).
- `newArchEnabled: true` — present (`app.config.ts:34`); Hermes is the
  only engine compatible with the new architecture on RN 0.81+.

Grep confirms no `jsEngine: "jsc"` string elsewhere in the repo. No EAS
profile in `eas.json` overrides the engine. No `ios/Podfile` line
forces JSC.

**Invariant:** JSC fallback is forbidden in production builds.
Reviewers block any PR that adds `jsEngine: "jsc"` to any config or
plugin override.

## 2. Call-site inventory — JS heap exposure

Single file: `services/walletService.ts`. Every JS-heap dwell of key
material flows through these two paths.

### 2.1 `getAccountForWallet(wallet)` — `services/walletService.ts:111`

Returns a Viem `HDAccount | PrivateKeyAccount`. Both objects embed the
decrypted secret in the JS heap:

- `PrivateKey` branch (line 122): calls
  `privateKeyToAccount(wallet.privateKey)`. Viem stores the key as a
  hex string on the returned object; it is closed over by the
  `sign*` methods Viem exposes.
- `SeedPhrase` branch (line 124): calls
  `mnemonicToAccount(wallet.seedPhrase)`. The mnemonic is derived
  inside Viem; Viem keeps the HD root key and the derivation path on
  the returned object.

Both branches write the returned account into the module-level
`accountCache` (line 128), which extends dwell to the lifetime of the
JS runtime unless `clearAccountCache()` is called.

**Downstream callers** invoke `account.signTransaction` /
`account.signMessage` / `account.signTypedData` from JS. The key
material never crosses a native boundary; every byte of it — and
every signature intermediate — lives in the Hermes heap.

### 2.2 `generateWalletMnemonic(strength)` — `services/walletService.ts:154`

Produces a fresh BIP-39 mnemonic string in the JS heap from CSPRNG
entropy. The string is passed directly back to the caller who persists
it via `walletSecureStore` and optionally hands it to the user via
the seed-export screen.

**Dwell:** as long as the caller holds the reference. The seed-backup
flow holds it until the user confirms; the wallet-setup flow hands it
to `walletSecureSet` and drops the reference, but Hermes GC is not
deterministic — the string can linger through multiple collections.

## 3. Migration target — key material never enters JS

Goal: the JS layer holds an **opaque handle** to a Keychain / Keystore
item. Signing invokes a native module with `(handle, tx)` and gets
back a signature. The decrypted key never crosses the JS/native
boundary in either direction.

### 3.1 iOS — Keychain + SecKey signing

- Store the secp256k1 private key as a `kSecClassKey` item bound to
  the Secure Enclave when available (`kSecAttrTokenID =
  kSecAttrTokenIDSecureEnclave`, `kSecAttrAccessControl` with
  `kSecAccessControlBiometryCurrentSet` — see task 11 for the
  `requireAuthentication` binding and task 12 for current-set).
- Signing goes through `SecKeyCreateSignature` with algorithm
  `.ecdsaSignatureMessageX962SHA256`. The SE never releases the raw
  key bytes.
- Fallback (older devices without SE secp256k1 support, i.e. pre-iPhone
  X style): use a Keychain-only item with the same access-control
  flags, and sign via a native BoringSSL / CryptoKit wrapper. The key
  does leave the Keychain in this fallback, but it stays inside the
  native process and is zeroed after each signature.

### 3.2 Android — Keystore + StrongBox signing

- Store the key with `KeyProperties.KEY_ALGORITHM_EC`, curve
  `secp256k1` where the device supports it; use StrongBox
  (`setIsStrongBoxBacked(true)`) on devices that ship it. For older
  devices without secp256k1 Keystore support, fall back to a
  file-based Keystore item and sign via a native BouncyCastle
  wrapper inside the app process.
- Bind to current biometric set via
  `setUserAuthenticationRequired(true)` +
  `setInvalidatedByBiometricEnrollment(true)` (see task 12).

### 3.3 React Native bridge

New native module: `TakumiSigner`.

```
interface TakumiSigner {
  // Replace privateKeyToAccount / mnemonicToAccount from Viem.
  // The native side derives the secp256k1 key from seed or stored
  // private key and persists it in Keychain / Keystore under `handle`.
  importPrivateKey(privateKey: string): Promise<{ handle: string; address: string }>;
  importMnemonic(mnemonic: string, derivationPath: string): Promise<{ handle: string; address: string }>;
  generateMnemonic(strength: 128 | 256): Promise<{ handle: string; mnemonic: string }>;

  // Sign operations take an opaque handle — not a key.
  signMessage(handle: string, message: string): Promise<`0x${string}`>;
  signTransaction(handle: string, txRlp: `0x${string}`): Promise<`0x${string}`>;
  signTypedData(handle: string, typedDataJson: string): Promise<`0x${string}`>;

  // Lifecycle
  erase(handle: string): Promise<void>;
}
```

Mnemonic generation still surfaces the plaintext string **once** to the
JS layer so the user can back it up (there is no way to show the user
the words without the words existing somewhere). The rule is: the JS
reference is held for exactly one backup flow, zeroed on navigation
away, and never written to disk. Task 4 / task 5 already gate the
screen (`FLAG_SECURE`, secure `TextInput`). Consider also a
native-rendered seed-display view as a follow-up so the mnemonic
plaintext never enters JS at all.

### 3.4 Viem shim

Viem's `Account` interface is a duck-typed object with `signMessage`,
`signTransaction`, `signTypedData`. We replace the `HDAccount |
PrivateKeyAccount` return value of `getAccountForWallet` with a custom
`HandleAccount` that implements the same interface but delegates each
`sign*` call to `TakumiSigner`. Downstream callers (EVM adapter,
bridge, agent executors) do not change — they keep calling
`account.signTransaction(...)`. This is the refactor surface that
keeps the migration tractable.

## 4. Short-term palliatives (until native signing lands)

Active today, documented so they do not regress:

- Signing call sites pass the account to the Viem signer immediately
  and drop their reference at function exit. Do not stash an account
  on a component or hook for "later" signing.
- `clearAccountCache()` (`services/walletService.ts:138`) is called on
  lock / logout / wallet removal. Verify each new lock trigger path
  calls it.
- Agent-session bearer tokens are rotated on a short cadence; a
  long-lived token in the JS heap is a finding. The session TTL is
  enforced in `services/agentSession`; any PR extending the TTL must
  reference TWV-2026-057.

## 5. Jailbreak / root heuristic (advisory)

The warning is soft — users proceed at their own risk. Detection is
unreliable; a hard gate is worse than none because it conditions
users to dismiss it.

### 5.1 Indicators (library: `expo-device`)

- `Device.isRootedExperimentalAsync()` — Expo's built-in heuristic.
  Unreliable but free.

### 5.2 iOS indicators (beyond `expo-device`)

- `FileManager.default.fileExists(atPath:)` for classic jailbreak
  markers: `/Applications/Cydia.app`, `/private/var/lib/apt`,
  `/private/var/lib/cydia`, `/usr/sbin/sshd`,
  `/etc/apt`, `/usr/bin/ssh`. Wrapped in a native module because RN
  sandboxing hides these paths from JS.
- `canOpenURL("cydia://package/com.example.package")` — returns true
  on jailbroken devices with URL schemes registered.
- `fork()` call that succeeds outside the sandbox (signals a non-
  sandboxed binary).
- Writable check on `/private/jailbreak_test.txt`. Delete immediately.

### 5.3 Android indicators (beyond `expo-device`)

- Presence of `su`, `busybox`, `magisk` binaries in `$PATH`
  (`/system/bin`, `/system/xbin`, `/sbin`, `/data/local/xbin`,
  `/data/local/bin`, `/vendor/bin`).
- Packages installed: `com.topjohnwu.magisk`, `com.noshufou.android.su`,
  `eu.chainfire.supersu`, `de.robv.android.xposed.installer`.
- `Build.TAGS` contains `test-keys`.
- `ro.debuggable`, `ro.secure` system properties read via
  `SystemProperties.get` indicating a dev build in production hands.
- Selinux mode `permissive` via `getenforce`.

### 5.4 UI wiring

- Run the check once on cold start, cache the result for the session.
- If any indicator fires, show a non-blocking banner on the wallet
  home screen: "Your device appears modified. Takumi still works, but
  modified devices can read app memory. Use at your own risk."
- Do NOT persist the detection state to analytics with user-identifying
  fields; a rooted-device flag without user ID is sufficient.

## 6. Review gate — `services/walletService.ts`

A header comment is appended to `services/walletService.ts` pointing
at this note. Any PR that:

- adds a new call to `privateKeyToAccount` / `mnemonicToAccount`
  outside `getAccountForWallet`;
- returns a Viem `Account` (or the raw key) from a public helper;
- extends `accountCache`'s lifetime;
- adds a new seed-material logging / persistence path;

must reference TWV-2026-057 in the PR description and confirm the
invariants above still hold.

## 7. Follow-up tasks (not in scope here)

- [ ] Build the `TakumiSigner` native module (iOS + Android).
- [ ] Swap `getAccountForWallet` to return `HandleAccount`.
- [ ] Add a native-rendered seed-display view so mnemonic plaintext
      never enters JS during backup.
- [ ] Wire the jailbreak / root check; ship behind a feature flag for
      one release before enforcing the banner on all users.
