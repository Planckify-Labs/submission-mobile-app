/**
 * Pure logic for the `ApprovalSheet` component.
 *
 * Extracted from `ApprovalSheet.tsx` so that `node --test --experimental-strip-types`
 * can import and exercise these helpers without pulling the React Native /
 * JSX runtime. `ApprovalSheet.tsx` re-exports everything from this file.
 *
 * Spec: `AGENT_PROTOCOL.md` §6 "The Approval Sheet with Grant Selection", §10.
 * Task: 14.
 */

import type {
  GrantLifetime,
  GrantScope,
  PermissionGrant,
  ToolCapability,
} from "@/services/permissionGrantStore";

// --- Types ------------------------------------------------------------------

/**
 * Minimum shape the approval sheet consumes from a pending tool call.
 * Task 09 will consolidate the canonical `ToolPendingPayload` type with
 * the dispatcher's session state; this local copy documents the contract
 * this component requires today.
 */
export interface ToolPendingPayload {
  tool_call_id: string;
  name: string;
  meta: {
    human_summary: string;
    capability: ToolCapability;
  };
}

export interface GrantOption {
  /** Stable id: "once" | "session" | "timed_relative" | "timed_until" | "permanent" */
  id: string;
  label: string;
  lifetime: GrantLifetime;
  scope: GrantScope;
}

export interface GrantChoice {
  scope: GrantScope;
  lifetime: GrantLifetime;
}

// --- Relative-duration dropdown presets -------------------------------------

export interface DurationPreset {
  id: string;
  label: string;
  ms: number;
}

export const DURATION_PRESETS: readonly DurationPreset[] = [
  { id: "15m", label: "15 minutes", ms: 15 * 60 * 1000 },
  { id: "1h", label: "1 hour", ms: 60 * 60 * 1000 },
  { id: "4h", label: "4 hours", ms: 4 * 60 * 60 * 1000 },
  { id: "24h", label: "24 hours", ms: 24 * 60 * 60 * 1000 },
] as const;

export const DEFAULT_DURATION_PRESET_ID = "1h";

// --- buildGrantOptions ------------------------------------------------------

/**
 * Build the five default grant options described in `AGENT_PROTOCOL.md` §6.
 *
 * The order is load-bearing — task 14 spec mandates:
 *   1. "Just this once"         (default selection)
 *   2. "For this session"
 *   3. "For the next [dropdown]" (relative timed)
 *   4. "Until [date picker]"    (absolute timed)
 *   5. "Always (manage in Settings)"
 *
 * The "timed_relative" option is seeded with the default preset (1h);
 * the component updates it based on the dropdown selection at approve-time
 * so the `expires_at` stamp is always "relative to now", not to render time.
 *
 * The "timed_until" option is seeded with `expires_at: 0` — a sentinel the
 * component replaces the moment the user picks a date. If the user selects
 * this option without picking a date, the component keeps Approve disabled.
 */
export function buildGrantOptions(
  sessionId: string,
  toolName: string,
  now: number = Date.now(),
): GrantOption[] {
  const toolScope: GrantScope = { kind: "tool", key: toolName };
  const defaultPreset = DURATION_PRESETS.find(
    (p) => p.id === DEFAULT_DURATION_PRESET_ID,
  );
  const defaultPresetMs = defaultPreset ? defaultPreset.ms : 60 * 60 * 1000;

  return [
    {
      id: "once",
      label: "Just this once",
      lifetime: { type: "once" },
      scope: toolScope,
    },
    {
      id: "session",
      label: "For this session",
      lifetime: { type: "session", session_id: sessionId },
      scope: toolScope,
    },
    {
      id: "timed_relative",
      label: "For the next",
      lifetime: { type: "timed", expires_at: now + defaultPresetMs },
      scope: toolScope,
    },
    {
      id: "timed_until",
      label: "Until",
      // Sentinel: 0 means "user has not picked a date yet". The component
      // disables Approve while this is still 0.
      lifetime: { type: "timed", expires_at: 0 },
      scope: toolScope,
    },
    {
      id: "permanent",
      label: "Always (manage in Settings)",
      lifetime: { type: "permanent" },
      scope: toolScope,
    },
  ];
}

// --- specialWarning ---------------------------------------------------------

const warnings: Record<string, string> = {
  approve_erc20:
    "This grants an external contract permission to spend your tokens. Only approve contracts you trust.",
  cancel_booking:
    "This may be irreversible depending on the vendor's cancellation policy.",
};

export function specialWarning(toolName: string): string | undefined {
  return warnings[toolName];
}

// --- buildApprovalSheetHandlers --------------------------------------------

/**
 * Dispatcher-facing factory that turns an ApprovalSheet interaction into
 * the `(persist grant?) → execute | reject` flow task 09 owns.
 *
 * Today task 09 is not implemented. This helper documents the contract and
 * is unit-tested so the wiring direction is locked in.
 *
 * TODO(task 09): dispatcher will call this. For now it only returns the
 * handler pair — `grantStore` persistence and tool execution happen in the
 * caller per task 09 spec. The `wallet_address` passed through on the
 * persisted grant is a placeholder until task 09 threads the live wallet.
 */
export function buildApprovalSheetHandlers({
  payload: _payload,
  sessionId: _sessionId,
  onExecute,
  onReject,
  onPersistGrant,
}: {
  payload: ToolPendingPayload;
  sessionId: string;
  onExecute: () => void;
  onReject: (reason: string) => void;
  onPersistGrant: (grant: PermissionGrant) => void;
}): {
  onApprove: (choice: GrantChoice) => void;
  onReject: () => void;
} {
  return {
    onApprove: (choice: GrantChoice) => {
      if (choice.lifetime.type !== "once") {
        onPersistGrant({
          scope: choice.scope,
          lifetime: choice.lifetime,
          // Task 09 will substitute the real active wallet address here.
          wallet_address: "0x0" as `0x${string}`,
          granted_at: Date.now(),
        });
      }
      onExecute();
    },
    onReject: () => onReject("user_declined"),
  };
}
