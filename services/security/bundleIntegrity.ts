// TWV-2026-056 — launch-time bundle integrity check. Pairs with the
// EAS Update code-signing pipeline (TWV-2026-055): code signing
// proves the manifest was issued by us; THIS check proves the bytes
// the runtime is actually executing match the bytes the manifest
// advertises. Closes the "tampered bundle on disk, valid binary
// signature" gap planted via OTA compromise, jailbreak tool, or MDM.
//
// Pure decision logic. The native bundle-read + SHA-256 compute lives
// behind `readCurrentBundleSha256()` (TODO-glued to expo-file-system /
// expo-updates in a follow-up); this module is unit-testable today.

export type IntegrityDecision =
  | { ok: true; sha256: string }
  | { ok: false; code: "mismatch" | "missing_manifest" | "missing_runtime"; message: string };

export interface IntegrityInputs {
  /** SHA-256 hex of the JS bundle currently loaded on disk. */
  runtimeSha256: string | null;
  /** SHA-256 hex advertised by the (already signature-verified) manifest. */
  manifestSha256: string | null;
}

function normaliseHex(h: string | null | undefined): string | null {
  if (typeof h !== "string") return null;
  const trimmed = h.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Pure decision — caller passes the runtime + manifest hashes; this
 * returns the verdict without touching native modules. Constant-time
 * comparison so a per-byte timing leak is not observable.
 */
export function decideBundleIntegrity(
  inputs: IntegrityInputs,
): IntegrityDecision {
  const runtime = normaliseHex(inputs.runtimeSha256);
  if (!runtime) {
    return {
      ok: false,
      code: "missing_runtime",
      message: "could not compute runtime bundle SHA-256",
    };
  }
  const manifest = normaliseHex(inputs.manifestSha256);
  if (!manifest) {
    return {
      ok: false,
      code: "missing_manifest",
      message: "manifest does not advertise a bundle SHA-256",
    };
  }
  if (runtime.length !== manifest.length) {
    return {
      ok: false,
      code: "mismatch",
      message: "runtime / manifest hash length differs",
    };
  }
  let diff = 0;
  for (let i = 0; i < runtime.length; i++) {
    diff |= runtime.charCodeAt(i) ^ manifest.charCodeAt(i);
  }
  if (diff !== 0) {
    return {
      ok: false,
      code: "mismatch",
      message: "runtime bundle SHA-256 does not match signed manifest",
    };
  }
  return { ok: true, sha256: runtime };
}
