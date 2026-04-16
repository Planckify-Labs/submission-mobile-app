# Clipboard policy

**Spec reference:** `wallet-security-vulnerabilities-spec.md` TWV-2026-063
(no auto-read; explicit paste with BIP-39 warn). Also TWV-2026-022 for
clipboard-swap detection.

This document is the source of truth for any Takumi screen that touches
the clipboard. PRs that add or modify a clipboard call MUST cite this
doc in the PR description.

## Rules (non-negotiable)

1. **No auto-read.** No screen calls `Clipboard.getStringAsync`,
   `Clipboard.getString`, `Clipboard.addListener`, or any equivalent API
   on mount, focus, resume, or any React lifecycle hook. Clipboard reads
   are always a direct consequence of a user tap on a visible control
   that says "Paste".
2. **Visible intent.** The control that triggers the paste must be
   labelled "Paste" (or equivalent), with a clipboard icon. Hidden
   shortcuts (long-press on a generic row, swipe gestures) are not
   acceptable as the only trigger.
3. **BIP-39 warn.** On seed-import and private-key-import screens the
   pasted value must pass through
   `services/security/sensitivePaste.ts#looksLikeBip39` before it is
   committed to screen state. If `looksLikeBip39` returns true, show
   `components/security/Bip39PasteWarningModal.tsx`. The modal offers
   "Type instead" (preferred) and "Paste anyway" (consent). It does not
   auto-dismiss.
4. **Clear after.** After any paste of sensitive material (seed, private
   key, auth token) — regardless of which modal branch the user chose —
   the consumer calls `Clipboard.setStringAsync("")` to clear the
   clipboard so other apps and malicious keyboards cannot re-read it.
   Best-effort: `.catch(() => {})` is acceptable because the paste has
   already happened.
5. **Offline detection only.** BIP-39 detection runs entirely on the
   device against the in-bundle wordlist. No remote call.

## Screens covered today

- `app/import-seed-phrase.tsx` — explicit Paste button + BIP-39 warn +
  clipboard clear.
- `app/import-private-key.tsx` — explicit Paste button; BIP-39 warn
  fires if the user pastes a seed phrase onto the PK screen by mistake;
  clipboard clear on any commit.
- `components/login/WalletImport.tsx` — shared component behind the
  login-flow wallet import; same guard + clear.
- `app/send.tsx` — pastes a recipient address via
  `handlePasteAddress`. Not classified as sensitive material for the
  BIP-39 warn, but still tap-driven (no mount read).
- `components/security/SeedExportScreen.tsx`,
  `components/common/SeedPhraseGrid.tsx` — these _write_ the mnemonic
  to the clipboard for backup. They clear the clipboard after a short
  TTL (`Clipboard.setStringAsync("")`), covered by TWV-2026-022.

## What is NOT clipboard-sensitive (per this policy)

- Pasting an address into the send screen. The warning is not BIP-39
  shaped; address-poisoning is handled separately
  (`services/security/addressPoisoning.ts`).
- Pasting a URL into the dApp browser. Not sensitive material under
  TWV-2026-063.

## Review checklist for clipboard PRs

- [ ] No call to `Clipboard.get*` is inside `useEffect` with empty deps,
      `useFocusEffect`, or any lifecycle hook.
- [ ] The paste is triggered by an `onPress` on a visible "Paste"
      control.
- [ ] If the screen handles seed phrases or private keys, the paste
      path goes through `looksLikeBip39` and the warning modal.
- [ ] The clipboard is cleared after sensitive pastes via
      `Clipboard.setStringAsync("")`.
- [ ] PR description cites this doc and the relevant TWV IDs.

## Cross-links

- `services/security/sensitivePaste.ts` — detection helper + tests.
- `components/security/Bip39PasteWarningModal.tsx` — warning modal.
- `docs/wallet-security-task/63_no_clipboard_auto_read_twv063_istaken_true.md`
  — the task file that introduced this policy.
- `docs/wallet-security-task/20_clipboard_swap_detection_twv022_istaken_false.md`
  — companion clipboard-swap detection work (not yet merged).
