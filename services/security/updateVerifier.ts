// TWV-2026-055 — storage-backed wrapper around the pure
// rollback-prevention decision in `./updateVerifier.pure.ts`.
//
// Expo's code-signing verifies that a manifest was signed by the key in
// `app.config.ts` — it does NOT by itself stop an attacker who captured
// a valid old manifest from replaying it onto a newer install. This
// module persists the currently-installed bundle's `createdAt` and
// refuses any candidate whose timestamp is older-or-equal.

import { storage } from "@/lib/storage/mmkv";
import {
  type CandidateManifest,
  evaluateManifestForInstall,
  toEpochMs,
  type UpdateDecision,
} from "./updateVerifier.pure";

export type { CandidateManifest, UpdateDecision };
export { evaluateManifestForInstall };

const STORAGE_KEY = "eas_update_last_installed_ts";

export function getLastInstalledTimestamp(): number | null {
  const v = storage.getNumber(STORAGE_KEY);
  return v ?? null;
}

export function setLastInstalledTimestamp(ts: number): void {
  storage.set(STORAGE_KEY, ts);
}

/** Convenience wrapper that persists acceptance as a side effect. */
export function decideAndPersistManifest(
  candidate: CandidateManifest,
): UpdateDecision {
  const last = getLastInstalledTimestamp();
  const decision = evaluateManifestForInstall(candidate, last);
  if (decision.action === "accept") {
    const ts = toEpochMs(candidate.createdAt);
    if (ts != null) setLastInstalledTimestamp(ts);
  }
  return decision;
}
