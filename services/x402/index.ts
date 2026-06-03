/**
 * `services/x402` — provider-neutral x402 micropayment orchestrator
 * (spec Phase 5 §5.4). Barrel export for the agent executor and tests.
 *
 * Contains NO Venice / no hardcoded resource hosts / no SDK imports
 * (SI-7) — it pays whatever x402 resource the agent targets, bounded only
 * by the allowance, and dispatches settlement through the resolved
 * `WalletKitAdapter.settleX402Payment` capability (SI-8).
 */

export {
  type RunAgentX402FetchArgs,
  type RunAgentX402FetchResult,
  runAgentX402Fetch,
} from "./agentX402Client.ts";
export {
  type SpendStorageAdapter,
  X402SpendLedger,
  type X402SpendLedgerOptions,
} from "./budget.ts";
export {
  parseX402Erc7710Challenge,
  tryParseAcceptEntry,
} from "./parseX402Erc7710Challenge.ts";
