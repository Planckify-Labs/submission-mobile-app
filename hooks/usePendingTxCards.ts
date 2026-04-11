/**
 * React hook wrapping `services/pendingTxStore` for use inside the
 * chat-thread render tree.
 *
 * The store is a process-level singleton (see
 * `services/pendingTxStore.ts` for the rationale), so every caller of
 * this hook sees the same records. On mount it subscribes, seeds its
 * local state with the current snapshot, and cleans up on unmount so
 * navigating between screens never leaks listeners.
 *
 * Consumers receive the records array newest-first — identical
 * ordering to `pendingTxStore.list()`.
 */

import { useEffect, useState } from "react";
import {
  type PendingTxRecord,
  pendingTxStore,
} from "@/services/pendingTxStore";

/**
 * Returns the current list of pending transaction cards. Rerenders
 * the consuming component whenever the store mutates.
 */
export function usePendingTxCards(): PendingTxRecord[] {
  // Seed with the current snapshot so the first render already has
  // the right data — `subscribe` will also call the listener
  // immediately, but seeding here avoids a one-frame flash when the
  // component mounts mid-stream.
  const [records, setRecords] = useState<PendingTxRecord[]>(() =>
    pendingTxStore.list(),
  );

  useEffect(() => {
    const unsubscribe = pendingTxStore.subscribe((next) => {
      setRecords(next);
    });
    return unsubscribe;
  }, []);

  return records;
}
