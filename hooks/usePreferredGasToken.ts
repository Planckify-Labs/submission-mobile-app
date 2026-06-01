/**
 * `usePreferredGasToken` — the user's default gas-payment token.
 *
 * Canonical store is MMKV (`storage`), so the value is readable
 * synchronously both inside React (this hook, via `useRQGlobalState` for
 * reactive UI) and outside it (`getPreferredGasToken()` for the agent
 * executor, which runs off the render tree). `"usdc"` is the default —
 * the whole point of the gas-abstraction layer is to pay gas in
 * stablecoin unless the user opts back into native.
 */

import { useCallback } from "react";
import { storage } from "@/lib/storage/mmkv";
import type { GasFeeTokenPreference } from "@/services/gasAbstraction/types";
import useRQGlobalState from "./useRQGlobalState";

const STORAGE_KEY = "takumipay_preferred_gas_token";
const QUERY_KEY = ["preferredGasToken"];
const DEFAULT: GasFeeTokenPreference = "usdc";

function normalize(raw: string | undefined): GasFeeTokenPreference {
  return raw === "native" || raw === "usdc" ? raw : DEFAULT;
}

/** Non-reactive accessor for code outside React (agent executors). */
export function getPreferredGasToken(): GasFeeTokenPreference {
  return normalize(storage.getString(STORAGE_KEY));
}

/** Persist + broadcast. Exported so non-hook callers can also write. */
export function setStoredPreferredGasToken(pref: GasFeeTokenPreference): void {
  storage.set(STORAGE_KEY, pref);
}

export function usePreferredGasToken() {
  const { data, setNewData } = useRQGlobalState<GasFeeTokenPreference>({
    queryKey: QUERY_KEY,
    initialData: getPreferredGasToken(),
  });

  const setPreferredGasToken = useCallback(
    (pref: GasFeeTokenPreference) => {
      setStoredPreferredGasToken(pref);
      setNewData(pref);
    },
    [setNewData],
  );

  return {
    preferredGasToken: data ?? DEFAULT,
    setPreferredGasToken,
  };
}
