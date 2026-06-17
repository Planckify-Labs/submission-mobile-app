/**
 * `RiskCheck` — the guardian docking port (Sui Intent Engine, spec §5.1).
 *
 * The guardian is the make-or-break must-have: the sub-track explicitly
 * rejects "a swap chatbot with no guardian." Each risk class is one
 * `RiskCheck` that inspects the compiled PTB + dry-run + targeted on-chain
 * reads and emits a plain-language `RiskFlag`. New risk classes dock by
 * registering a `RiskCheck` — no branching anywhere else changes
 * (space-docking, `feedback_space_docking`).
 *
 * Copy discipline (CLAUDE.md user-facing-errors): `title`/`detail` are
 * hand-written, parameterised only by numbers we control — never a raw
 * RPC/SDK string.
 */

import type { SuiSimulationSummary } from "@/services/chains/sui/payloads";
import type { Intent } from "../intentSchema";
import type { CompileContext, CompiledIntent } from "../intentTypes";

export type Severity = "info" | "warn" | "block";

export type RiskCode = "slippage.high" | "oracle.stale" | "concentration.high";

export interface RiskFlag {
  code: RiskCode;
  severity: Severity;
  /** Hand-written, plain-language. Never a raw RPC/SDK string. */
  title: string;
  /** Hand-written, plain-language. e.g. "This swap could lose ~3.2% to price impact." */
  detail: string;
}

export interface RiskCheckArgs {
  intent: Intent;
  compiled: CompiledIntent;
  /** From `simulateSuiTransaction` (dryRunTransactionBlock). May be null on RPC failure. */
  dryRun: SuiSimulationSummary | null;
  ctx: CompileContext;
}

export interface RiskCheck {
  readonly code: RiskCode;
  /** Pure-ish: inspect the compiled PTB + dry-run + on-chain reads. null = passed. */
  run(args: RiskCheckArgs): Promise<RiskFlag | null>;
}

/** Severity ordering helper — higher = worse. */
export function severityRank(s: Severity): number {
  return s === "block" ? 2 : s === "warn" ? 1 : 0;
}

/** The worst severity across a set of flags (null when none). */
export function worstSeverity(flags: RiskFlag[]): Severity | null {
  if (flags.length === 0) return null;
  return flags.reduce<Severity>(
    (acc, f) =>
      severityRank(f.severity) > severityRank(acc) ? f.severity : acc,
    "info",
  );
}

/** True when the guardian verdict makes the intent un-signable (SI-5). */
export function isBlocked(flags: RiskFlag[]): boolean {
  return flags.some((f) => f.severity === "block");
}
