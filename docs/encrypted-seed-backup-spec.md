# Encrypted seed backup to the user's Google Drive

**Status:** Spec. Not implemented.
**Related:** `wallet-security-vulnerabilities-spec.md` (TWV-2026-002 entropy,
TWV-2026-003 exfiltration), `hot-wallet-custody-policy.md`,
`social-recovery-spec.md`.

## 1. Problem

A wallet minted by `bootstrapFirstLoginWallets()` exists only in the
SecureStore of the device that minted it. `generateWalletMnemonic()` draws
fresh CSPRNG entropy on every call and derives nothing from the Google
identity. So signing in with the same Google account on a second device
mints a **different** mnemonic and a different set of addresses.

Today `app/login.tsx` does that silently. The user sees a zero balance and an
unfamiliar address and concludes their funds are gone. They aren't — the funds
are reachable from the seed phrase on the original device — but nothing says so.

## 2. Non-goal: custody

TakumiPay must never be able to reconstruct a user's key. That rules out
server-side escrow and rules out deriving the seed from the Google `sub`
(which is not secret, appears in every ID token, and is known to Google).

This design keeps the wallet non-custodial: the ciphertext lives in the
**user's own** Drive `appDataFolder`, encrypted under a key derived from a
passphrase that never leaves the device. TakumiPay cannot decrypt it. Google
cannot decrypt it.

## 3. Threat model

| Adversary | Outcome |
|---|---|
| TakumiPay backend compromise | No effect. No ciphertext, no passphrase, no seed ever reaches our servers. |
| Google account takeover **only** | Attacker holds ciphertext, not the passphrase. Must break Argon2id offline. |
| Passphrase phished **only** | Attacker has no ciphertext without Drive access. |
| Google takeover **+** weak passphrase | **Funds drained.** This is the new attack surface this feature introduces. |
| Device theft (unlocked) | Pre-existing exposure; SecureStore already holds the seed. |

The fourth row is the whole reason the passphrase policy in §5 is a hard
requirement rather than a suggestion.

## 4. Crypto

All primitives are already available via `react-native-quick-crypto`
(installed and `install()`-ed in `pollyfills.ts`). **No new dependency.**

- **KDF:** Argon2id, native (`argon2Sync("argon2id", …)`).
  Parameters: `memory = 65536` (64 MiB), `passes = 3`, `parallelism = 1`,
  `tagLength = 32`, `nonce` = 16-byte CSPRNG salt.
  Exceeds the OWASP floor (m=19 MiB, t=2, p=1). Chosen to make an offline
  guess expensive on GPU while staying under ~1 s on a mid-range Android.
- **Cipher:** AES-256-GCM via `createCipheriv`, 12-byte CSPRNG IV, 16-byte tag.
- **AAD:** the canonical-JSON header (`v`, `kdf`, `createdAt`) is fed as
  additional authenticated data, so an attacker cannot downgrade the KDF
  parameters in the blob and have the client honour them.
- **Plaintext:** the BIP-39 mnemonic, UTF-8. Nothing else.

Blob format (`takumi-seed-backup.v1.json`):

```jsonc
{
  "v": 1,
  "kdf": { "alg": "argon2id", "m": 65536, "t": 3, "p": 1, "salt": "<b64>" },
  "cipher": { "alg": "aes-256-gcm", "iv": "<b64>", "ct": "<b64>", "tag": "<b64>" },
  "createdAt": 1752134400000
}
```

Deliberately **no wallet addresses** in the blob. Restore succeeds or fails on
decryption; including addresses would hand Google a map of the user's
on-chain identities for no functional gain.

> **Hermes hazard.** Encoding must not rely on an ambient global `Buffer`.
> Use the `Buffer` returned by quick-crypto (`@craftzdog/react-native-buffer`)
> or an explicit `btoa`-based encoder, and verify the round-trip **on device**,
> not just under Node. See the prior incident where a dependency's bare
> `Buffer#toString("base64")` silently produced comma-joined garbage under
> this app's Hermes runtime with no thrown error.

## 5. Passphrase policy (hard requirement)

- The backup passphrase is **not** the app PIN. The PIN is 6 digits — a
  10^6 keyspace. Even at 64 MiB Argon2id an attacker who steals the blob
  exhausts it cheaply. Reusing the PIN here would convert "Google account
  takeover" straight into "drained".
- Minimum 10 characters, with a strength meter and a blocklist of the
  obvious (`password`, the user's email local-part, `takumipay`, …).
- The passphrase is **never persisted**. Not in SecureStore, not in MMKV.
  It is held in memory for the duration of the encrypt/decrypt call and the
  string reference dropped immediately.
- Forgetting the passphrase is unrecoverable. The UI must say this before
  the user commits, in the same breath as "we cannot reset it for you".

## 6. Drive integration

Scope `https://www.googleapis.com/auth/drive.appdata` — **non-sensitive** per
Google's Drive API auth guide, so it needs only basic OAuth app verification,
no security assessment. Request it via `GoogleSignin.configure({ scopes })`,
or `addScopes()` for users who already granted the base scopes. Get a bearer
token from `GoogleSignin.getTokens()`.

| Operation | Request |
|---|---|
| Upload | `POST /upload/drive/v3/files?uploadType=multipart`, metadata `{ name, parents: ["appDataFolder"] }` |
| List | `GET /drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)` |
| Download | `GET /drive/v3/files/{id}?alt=media` |

`appDataFolder` is hidden from the Drive UI, but **the user can still delete
it**, and it is removed when they disconnect the app from Drive. Therefore:

## 7. The seed phrase remains the root backup

Drive backup is a **convenience**, never the system of record. It can vanish
(user deletes app data) and it can become undecryptable (user forgets the
passphrase). Both are outside our control.

So the seed-phrase reveal + verify flow on `app/wallet.tsx` is a prerequisite,
not a follow-up: every user must still be able to see and write down their
12 words. `services/walletKit/bootstrap.ts` already anticipates this
("the auto-mint mnemonic is only revealed via the settings-flow verify-words
step"). That screen must set `FLAG_SECURE` via
`services/security/screenshotGuard.ts` and gate on PIN/biometric.

## 8. Flows

**Backup (opt-in, from wallet screen or post-creation nudge)**
1. PIN/biometric gate → read mnemonic from SecureStore.
2. Prompt for a new passphrase (twice), enforce §5.
3. `argon2id(passphrase, salt)` → 32-byte key. AES-256-GCM encrypt mnemonic.
4. Upload blob to `appDataFolder`, overwriting any prior version.
5. Record a local flag `seed_backup_at` (timestamp only) so the wallet screen
   can show "Backed up 3 days ago". The flag is a hint, not proof — verify
   against Drive on demand.

**Restore (new device, zero local wallets, after Google + OTP)**
1. Do **not** auto-mint. List `appDataFolder`.
2. Blob found → "Restore your wallet" → prompt passphrase → decrypt →
   `deriveWalletsFromMnemonic` → `saveWalletsToStorage` → `authenticateWallet`.
3. Wrong passphrase → GCM tag mismatch → fixed copy ("That passphrase didn't
   work"). Rate-limit attempts locally with backoff; the blob is offline-
   attackable regardless, so this is UX not security.
4. No blob found → offer "Create a new wallet" **or** "I have a seed phrase"
   (existing `ImportSeedPhraseSheet`). Never mint silently.

## 9. Scope

v1 backs up the **single bootstrap mnemonic** — the one `deriveWalletsFromMnemonic`
fans out across every registered kit. Wallets imported from a foreign private
key have no mnemonic and are out of scope; the UI must not imply they are
covered.

## 10. Error surfaces

Per CLAUDE.md, no raw error text reaches the user. Curated codes:
`backup_unavailable` (Drive unreachable / scope denied), `passphrase_rejected`
(GCM tag mismatch), `backup_missing`, `backup_corrupt` (blob fails schema or
AAD check), `unknown`. Raw Drive/API detail goes to `__DEV__` logs only.
