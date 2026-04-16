# Task 05 — Secure `TextInput` props on seed screens

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-005, §7 (non-regression), §9 (DiD checklist rows)

## Why this matters

iOS QuickType and Android GBoard / Samsung Keyboard learn words typed
into generic text inputs. Once a BIP-39 word enters the keyboard
dictionary it surfaces as a suggestion in Mail/Notes — and a malicious
third-party keyboard silently uploads every keystroke. The spec names
"seed import/backup components" as the surface; §9 "Seed / sensitive-
screen UX" first row requires a specific prop set on every seed
`TextInput`.

## Scope

1. Grep for every `<TextInput>` on seed-import, seed-verify, and
   seed-restore components in `components/` and any `app/` route that
   renders such a field.
2. On each, set exactly: `autoCorrect={false}`, `spellCheck={false}`,
   `autoCapitalize="none"`, `textContentType="none"` (iOS),
   `keyboardType="visible-password"` (Android disables suggestions
   there), `importantForAutofill="no"` (Android). Add
   `secureTextEntry={true}` where the seed-per-word UX permits it.
3. Create a thin wrapper component (e.g. `SeedWordInput`) that
   encodes the prop set once; refactor call sites to use it so future
   seed inputs can't forget a prop.
4. Add a lint-style assertion (unit test that scans the wrapper's
   default props) guaranteeing the prop set cannot silently drift.

## Rules (non-negotiable)

- **Full prop set on every seed input.** Missing any single prop in
  the list is a merge-block.
- **Wrapper is the only seed-input type.** Raw `TextInput` on seed
  screens is prohibited after this task lands.
- **Signable-tx parity (§7).** Non-seed text inputs (labels, memos,
  recipient fields) are untouched.
- **No custom in-app keyboard yet.** Spec mentions it as "ultimate
  defense, high UX cost" — deferred.

## Acceptance

- [ ] `SeedWordInput` (or equivalent) exists and is used by every
      seed-import, seed-verify, and seed-restore screen.
- [ ] Unit test on the wrapper asserts the default prop set matches
      the spec list exactly.
- [ ] Manual regression on Android device: type a non-BIP-39 word on
      a seed input — no suggestion bar appears. Type the same word in
      a memo field on the send screen — suggestions still work.
- [ ] Manual regression on iOS device: QuickType does not learn words
      typed into the seed field (verify by checking predictive bar on
      a subsequent Notes entry).
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Screenshot / recording protection — TWV-2026-023 (task 04).
- Clipboard-paste warning with BIP-39 detection — TWV-2026-063
  (Phase 3, task 63).
- Custom in-app keyboard for seed entry (explicitly deferred in spec).
