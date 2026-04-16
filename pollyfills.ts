// TWV-2026-002 — CSPRNG polyfill MUST stay the first import of this file
// AND this file MUST be the first import of `app/_layout.tsx`. Viem and
// `@scure/bip39` read `globalThis.crypto.getRandomValues` at call time;
// if any Viem-importing module loads before this polyfill, entropy can
// silently collapse to a non-CSPRNG fallback. Enforced by the self-check
// below + `services/walletService.test.ts`.
import "react-native-get-random-values";
import "fastestsmallesttextencoderdecoder";

if (typeof globalThis.crypto?.getRandomValues !== "function") {
  // Fail loud. A missing CSPRNG at boot is a seed-entropy incident —
  // see MetaMask / Trust Wallet Core 2023 post-mortems cited in the spec.
  throw new Error(
    "CSPRNG polyfill missing: `crypto.getRandomValues` is not a function. " +
      "Check that `pollyfills.ts` is imported before any Viem / @scure/bip39 code.",
  );
}

// TWV-2026-021 — freeze the global prototypes before any third-party
// code runs. CVE-2019-10744 (lodash) and friends mutate
// `Object.prototype` to swap addresses / chainIds mid-request; freezing
// removes the class wholesale. Self-check below logs (does not throw)
// if a downstream dep un-freezes it so we can detect regressions
// without bricking the app.
try {
  Object.freeze(Object.prototype);
  Object.freeze(Array.prototype);
  if (
    !Object.isFrozen(Object.prototype) ||
    !Object.isFrozen(Array.prototype)
  ) {
    console.error(
      "[TWV-2026-021] prototype freeze unstuck — a dep un-froze it. " +
        "Investigate before merging any prototype-pollution-relevant change.",
    );
  }
} catch (e) {
  console.error("[TWV-2026-021] prototype freeze failed:", e);
}
