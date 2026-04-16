// TWV-2026-055 — pure decision logic for rollback-prevention. Kept
// dependency-free so it's unit-testable under plain Node without any
// TS path-alias resolver. The storage-backed wrapper lives in
// `./updateVerifier.ts`.

export interface CandidateManifest {
  /** ISO-8601 string, or epoch-ms number. */
  createdAt: string | number;
  runtimeVersion?: string;
}

export type UpdateDecision =
  | { action: "accept"; reason: string }
  | { action: "reject"; reason: string };

export function toEpochMs(v: string | number | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

/**
 * Pure decision — returns `accept` only when the candidate is strictly
 * newer than the last installed manifest.
 */
export function evaluateManifestForInstall(
  candidate: CandidateManifest,
  lastInstalledTs: number | null,
): UpdateDecision {
  const ts = toEpochMs(candidate.createdAt);
  if (ts == null) {
    return { action: "reject", reason: "candidate manifest has no timestamp" };
  }
  if (lastInstalledTs == null) {
    return { action: "accept", reason: "first install" };
  }
  if (ts <= lastInstalledTs) {
    return {
      action: "reject",
      reason: `rollback blocked (candidate ts=${ts} <= installed ts=${lastInstalledTs})`,
    };
  }
  return { action: "accept", reason: "newer timestamp" };
}
