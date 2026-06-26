import { useCallback } from "react";
import useRQGlobalState from "./useRQGlobalState";

const AGENT_PREFILL_QUERY_KEY = ["agent-prefill-prompt"] as const;

/**
 * One-shot channel for handing a prompt to the Takumi Agent chat from a
 * sibling screen (e.g. the home `TakumiAgentSection` voice bar) without
 * prop-drilling through the home pager.
 *
 * The producer (home section) writes the text via `setPrefill`; the
 * consumer (`AgentMode`) reads it on mount / change, drops it into the
 * `ChatInput` value (it is NOT auto-sent — the user reviews and taps
 * send), then `clearPrefill`s so a later remount doesn't re-fill a stale
 * value. Backed by `useRQGlobalState` so both screens share the same
 * React-Query cache entry.
 */
export function useAgentPrefill() {
  const { data, setNewData } = useRQGlobalState<string | null>({
    queryKey: AGENT_PREFILL_QUERY_KEY,
    initialData: null,
  });

  const setPrefill = useCallback(
    (text: string) => {
      setNewData(text);
    },
    [setNewData],
  );

  const clearPrefill = useCallback(() => {
    setNewData(null);
  }, [setNewData]);

  return { prefill: data ?? null, setPrefill, clearPrefill };
}
