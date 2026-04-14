import { useCallback, useMemo } from "react";
import { queryClient } from "@/app/_layout";
import useRQGlobalState from "./useRQGlobalState";

export type AgentBusyReason =
  | "thinking"
  | "awaiting_approval"
  | "awaiting_preview";

export interface AgentBusyState {
  isBusy: boolean;
  reason: AgentBusyReason | null;
  cancelHandler: (() => void | Promise<void>) | null;
  /**
   * True when the current wallet has meaningful chat state the user
   * would notice losing on a wallet switch — either at least one
   * message in the live buffer OR a resumed conversation. Used by
   * `useWallet.setActiveWallet` to decide whether to show a soft
   * "switch chat?" confirmation when the agent is NOT busy.
   */
  hasActiveChat: boolean;
}

const AGENT_BUSY_QUERY_KEY = ["agent-busy-state"] as const;

const DEFAULT_STATE: AgentBusyState = {
  isBusy: false,
  reason: null,
  cancelHandler: null,
  hasActiveChat: false,
};

export const AGENT_BUSY_COPY: Record<AgentBusyReason, string> = {
  thinking:
    "Takumi Agent is running a task. Cancelling now will stop the current turn.",
  awaiting_approval:
    "Takumi Agent is waiting for you to approve a transaction. Switching now will cancel it.",
  awaiting_preview:
    "Takumi Agent is waiting for you to confirm an action. Switching now will cancel it.",
};

export function useAgentBusyPublisher() {
  // NOTE: this publisher is deliberately NOT subscribed to the query
  // data. Reading `data` here and including it in `publish`'s deps
  // would churn the callback every publish, causing the consumer's
  // `useEffect([..., busy.publish])` to fire in a loop. Instead we
  // read the current state directly from `queryClient` inside the
  // callback so `publish` stays referentially stable across renders.
  const publish = useCallback((next: Partial<AgentBusyState>) => {
    const current =
      queryClient.getQueryData<AgentBusyState>(AGENT_BUSY_QUERY_KEY) ??
      DEFAULT_STATE;
    const merged: AgentBusyState = { ...current, ...next };
    // Skip the write when nothing changed — prevents downstream
    // re-renders on rapid React state-thrash (e.g. streaming deltas).
    if (
      merged.isBusy === current.isBusy &&
      merged.reason === current.reason &&
      merged.cancelHandler === current.cancelHandler &&
      merged.hasActiveChat === current.hasActiveChat
    ) {
      return;
    }
    queryClient.setQueryData(AGENT_BUSY_QUERY_KEY, merged);
  }, []);

  const reset = useCallback(() => {
    queryClient.setQueryData(AGENT_BUSY_QUERY_KEY, DEFAULT_STATE);
  }, []);

  // Stable object reference so consumers can safely put `busy` in a
  // `useEffect` dependency list without re-firing on every render.
  return useMemo(() => ({ publish, reset }), [publish, reset]);
}

export function useAgentBusy() {
  const { data } = useRQGlobalState<AgentBusyState>({
    queryKey: AGENT_BUSY_QUERY_KEY,
    initialData: DEFAULT_STATE,
  });
  const current: AgentBusyState = data ?? DEFAULT_STATE;

  const cancel = useCallback(async () => {
    const handler = current.cancelHandler;
    if (handler) await handler();
  }, [current.cancelHandler]);

  return {
    isBusy: current.isBusy,
    reason: current.reason,
    copy: current.reason ? AGENT_BUSY_COPY[current.reason] : null,
    hasActiveChat: current.hasActiveChat,
    cancel,
  };
}
