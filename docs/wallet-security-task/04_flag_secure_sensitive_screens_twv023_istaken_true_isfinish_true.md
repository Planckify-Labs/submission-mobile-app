# Task 04 — `FLAG_SECURE` / `expo-screen-capture` on sensitive screens

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-023, §7 (non-regression), §9 (DiD checklist rows)

## Why this matters

SpyAgent-class Android malware runs OCR over the photo library and
live screen-recording streams to harvest 12/24-word phrases. iOS is
not immune — ReplayKit captures include the seed-display frame unless
the app opts out. The spec references `services/security/screenshotGuard.ts`
as the existing guard surface, and §9 "Seed / sensitive-screen UX"
requires `FLAG_SECURE` / `expo-screen-capture` on every seed,
private-key, and signature-prompt screen.

## Scope

1. Extend `services/security/screenshotGuard.ts` to expose a
   mount/unmount pair (e.g. a `useScreenshotGuard()` hook) that wraps
   `expo-screen-capture.preventScreenCaptureAsync` /
   `allowScreenCaptureAsync` with a refcount so nested guarded screens
   don't re-enable capture prematurely.
2. Apply the guard on every sensitive screen. Categories the spec
   names: seed-display, seed-import, private-key export, and the
   native signer-UI modals (see task 14 / TWV-2026-064). Audit the
   `app/` tree and wallet-setup components for coverage.
3. iOS extras: subscribe to `UIApplicationUserDidTakeScreenshotNotification`
   to surface a "never screenshot this" toast when the user attempts
   one on a guarded screen; observe `UIScreen.isCaptured` and blur the
   sensitive content when recording is active.
4. Onboarding copy update: "Never take a photo of this phrase" shown
   adjacent to seed display (copy already in the spec's mitigation).

## Rules (non-negotiable)

- **Every seed / key / signature screen is guarded.** No exceptions
  for "preview" or "confirmation" sub-screens that also show the seed.
- **Guard is refcounted.** Two nested guarded screens unmounting in
  reverse order must leave capture disabled until the outer unmount.
- **No behaviour regression on unguarded screens.** Screenshot/record
  still works on balances, dApp browser, transaction history.
- **iOS recording detection is best-effort.** Blur is the UX response,
  not a hard block — OS does not provide a reliable preempt.

## Acceptance

- [ ] `services/security/screenshotGuard.ts` exports a hook (or
      equivalent) used by every sensitive screen.
- [ ] Unit test covers refcount semantics: two mount calls + one
      unmount leaves capture disabled; second unmount re-enables.
- [ ] Manual regression on Android device: attempt screenshot on
      seed-backup screen — system toast "can't take screenshot due to
      security policy" appears. Attempt on balance screen — works.
- [ ] Manual regression on iOS device: start screen recording while on
      seed-backup screen, confirm seed is blurred or the screen shows
      a recording-active warning.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Secure `TextInput` props on seed fields — TWV-2026-005 (task 05).
- Logger scrubbers for seed-like strings — TWV-2026-003 (task 06).
- Native-only signer modals replacing any HTML overlays —
  TWV-2026-064 (task 14).
