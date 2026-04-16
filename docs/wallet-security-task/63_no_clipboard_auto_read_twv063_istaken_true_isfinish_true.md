# Task 63 — No clipboard auto-read; explicit "Paste" with BIP-39 warn

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-063, §7, §9

## Why this matters

Older MetaMask versions auto-read the clipboard to pre-fill address
fields. That (a) triggered iOS clipboard-access banners that alarmed
users, (b) interacted badly with malicious keyboards that logged
clipboard reads, and (c) conditioned users to copy-paste across
screens, leading to seed phrases being pasted into the wrong field.
TakumiAI should never auto-read; every clipboard interaction is
explicit, and seed-like content triggers a warning.

## Scope

UI-behaviour mitigation:

- Grep the codebase for `Clipboard.getStringAsync`, `Clipboard.get*`,
  `Clipboard.addListener`, `@react-native-clipboard/clipboard` APIs.
  Any call on screen mount / focus is a finding; remove it or gate it
  behind an explicit user action.
- Replace any auto-paste UX with an explicit "Paste" button: the
  clipboard is read only as a direct result of the tap.
- On seed-import and private-key-import screens, after a paste:
  - Scan the pasted content. If it looks like BIP-39 words (word-count
    in {12, 15, 18, 21, 24}; all words match the BIP-39 English
    wordlist), show a warning modal: "Pasting a seed phrase exposes it
    to clipboard malware. Consider typing each word instead."
  - Offer "Type instead" and "Paste anyway" actions; no auto-dismiss.
- After any paste of sensitive material (seed, private key, auth
  token), clear the clipboard (cross-link to task 20 /
  TWV-2026-022's clipboard-swap handling).
- Document the rule in `docs/clipboard-policy.md` (new) so future
  screens follow the pattern.

## Rules (non-negotiable)

- No clipboard read runs on mount, focus, or any lifecycle hook;
  reads are always tap-driven.
- BIP-39 detection scan runs client-side offline; no remote call.
- Clipboard is cleared after sensitive pastes, even when the user
  taps "Paste anyway."
- Policy doc is the source of truth; PRs touching clipboard APIs
  cite it in the PR description.

## Acceptance

- [ ] Grep shows no `Clipboard.get*` or equivalent call on mount /
      focus across the codebase.
- [ ] "Paste" buttons are explicit on seed-import and private-key
      import screens; BIP-39 warning modal wired in with a unit test
      covering a known 12-word mnemonic.
- [ ] Clipboard-clear runs after sensitive pastes.
- [ ] `docs/clipboard-policy.md` exists and is linked from the task.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Clipboard-swap malware detection (task 20 handles that).
- Address-pasting UX on send screens — covered by existing work; this
  task focuses on the seed-import surface.
- Custom-keyboard blocking.
