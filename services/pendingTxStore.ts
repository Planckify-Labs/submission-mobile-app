/**
 * Pending transaction store for the Takumi Agent optimistic UI
 * (AGENT_PROTOCOL.md §1 "Why Blockchain is a separate actor",
 * §10 "Optimistic UI Pattern" and task 15).
 *
 * Responsibilities:
 *
 *   1. Remember every write-tool `tx_hash` the dispatcher has seen,
 *      together with the human summary that produced it, so the chat
 *      thread can render a "pending" card the moment a write executor
 *      returns a hash.
 *   2. Let the `get_transaction` read executor flip that same card to
 *      `confirmed` or `failed` once the chain has a receipt — per §1,
 *      a returned hash is NOT a confirmation; only the receipt is.
 *   3. Notify subscribers (the `usePendingTxCards` hook) whenever any
 *      of the above mutates, so the chat screen redraws without its
 *      own bespoke polling loop.
 *
 * This is a plain singleton (NOT a React context). The
 * `permissionGrantStore.ts` class instance pattern is wallet-scoped
 * and persisted; pending tx state is process-local, so a flat
 * `Map<string, PendingTxRecord>` with a pub/sub channel is enough.
 * The singleton shape is deliberate — the store needs to survive
 * navigation away from and back to the chat screen, which is free as
 * long as the module instance is shared across the app.
 *
 * No persistence by design: on an app cold-start the pending cards
 * disappear. That is correct behaviour — the agent-side source of
 * truth on reconnect is the SSE stream + `get_transaction` reads;
 * rehydrating stale cards from disk would lie to the user about the
 * state of an in-flight tx they no longer control.
 */

export type PendingTxState = "submitted" | "confirmed" | "failed";

/**
 * One row in the pending-tx table. Kept deliberately flat so the
 * `PendingTxCard` component can render it without ceremony.
 */
export interface PendingTxRecord {
  tx_hash: `0x${string}`;
  chain_id: number;
  /** `payload.meta.human_summary` from the tool_pending event. */
  description: string;
  state: PendingTxState;
  /** `Date.now()` at the moment the record was added. */
  submitted_at: number;
  /** `Date.now()` at the moment `markConfirmed` fired. */
  confirmed_at?: number;
  /** Block number from the confirmed receipt. */
  block_number?: number;
  /**
   * Error string from the executor or receipt path. Rendered via
   * a friendly-message mapper in PendingTxCard — not shown verbatim.
   */
  error?: string;
  /**
   * Backend transaction record id from `transactionApi.createTransaction`.
   * Present when the executor successfully recorded the transfer history.
   * Used by PendingTxCard to link to the activity-detail screen.
   */
  transactionId?: string;
}

/**
 * Shape of the `add()` argument. `state` and `submitted_at` are
 * defaulted inside `add()` so callers don't have to repeat themselves,
 * but we still expose `state` as an optional override for the
 * "failed-before-submit" edge case where the executor reverts BUT
 * still produced a hash — the dispatcher passes `state: "failed"` +
 * `error` so the UI can show the explorer link alongside the error
 * string.
 */
export type AddPendingTxInput = Omit<
  PendingTxRecord,
  "state" | "submitted_at"
> & {
  state?: PendingTxState;
};

type Listener = (records: PendingTxRecord[]) => void;

// --- Module-private state ---------------------------------------------------

const records = new Map<string, PendingTxRecord>();
const listeners = new Set<Listener>();

function normalizeHash(hash: string): string {
  // Hash equality must be case-insensitive. Viem produces lowercase
  // hashes, but defensive normalisation protects us if an external
  // caller hands us a checksummed / uppercased value.
  return hash.toLowerCase();
}

function snapshot(): PendingTxRecord[] {
  // Order by submitted_at descending so the newest card appears first
  // in the UI. Subscribers get a fresh array on every emit so
  // `useState` treats each update as a new reference.
  return Array.from(records.values()).sort(
    (a, b) => b.submitted_at - a.submitted_at,
  );
}

function emit(): void {
  const current = snapshot();
  for (const listener of listeners) {
    try {
      listener(current);
    } catch (err) {
      // A broken subscriber must NOT poison the notification pipeline —
      // log and continue so the remaining listeners still fire.
      console.warn(`[pendingTxStore] listener threw: ${String(err)}`);
    }
  }
}

// --- Public API -------------------------------------------------------------

export const pendingTxStore = {
  /**
   * Record a new pending transaction. Idempotent on `tx_hash` — if the
   * same hash is added twice (e.g. a dispatcher re-run after a
   * reconnect), the existing record is preserved UNLESS the incoming
   * record carries a terminal state (`confirmed` / `failed`), in which
   * case it replaces the existing one so reverted-before-submit edge
   * cases upgrade cleanly.
   */
  add(input: AddPendingTxInput): void {
    const key = normalizeHash(input.tx_hash);
    const existing = records.get(key);
    const incomingState: PendingTxState = input.state ?? "submitted";

    if (existing && incomingState === "submitted") {
      // Do not clobber a terminal state with a stale "submitted" —
      // reconnect races are a real concern per the dispatcher spec.
      return;
    }

    const record: PendingTxRecord = {
      tx_hash: input.tx_hash,
      chain_id: input.chain_id,
      description: input.description,
      state: incomingState,
      submitted_at: existing?.submitted_at ?? Date.now(),
      confirmed_at: existing?.confirmed_at,
      block_number: existing?.block_number,
      error: input.error ?? existing?.error,
    };
    records.set(key, record);
    emit();
  },

  /**
   * Flip an existing pending record to `confirmed`. Called by the
   * `get_transaction` executor on a successful receipt
   * (`receipt.status === "success"`). Unknown hashes are a silent
   * no-op — the executor may legitimately fetch a receipt for a tx
   * the store never saw (e.g. the user pasted a hash directly), and
   * we don't want that to crash the read path.
   */
  markConfirmed(tx_hash: string, blockNumber: number): void {
    const key = normalizeHash(tx_hash);
    const existing = records.get(key);
    if (!existing) return;
    if (existing.state === "confirmed") return; // already terminal
    records.set(key, {
      ...existing,
      state: "confirmed",
      confirmed_at: Date.now(),
      block_number: blockNumber,
      // Clear any prior error — a confirmed receipt is authoritative.
      error: undefined,
    });
    emit();
  },

  /**
   * Flip an existing pending record to `failed`. Called by the
   * `get_transaction` executor on a reverted receipt, OR by the
   * dispatcher when the write executor returned
   * `{ status: "failed", tx_hash }` (reverted-but-submitted).
   *
   * Unknown hashes are a silent no-op for the same reason as
   * `markConfirmed`.
   */
  markFailed(tx_hash: string, error: string): void {
    const key = normalizeHash(tx_hash);
    const existing = records.get(key);
    if (!existing) return;
    if (existing.state === "confirmed") return; // never downgrade
    records.set(key, {
      ...existing,
      state: "failed",
      error,
    });
    emit();
  },

  /** Look up a single record by hash. Case-insensitive. */
  get(tx_hash: string): PendingTxRecord | undefined {
    return records.get(normalizeHash(tx_hash));
  },

  /**
   * Current snapshot, newest first. Safe to call from React render —
   * returns a fresh array on every invocation.
   */
  list(): PendingTxRecord[] {
    return snapshot();
  },

  /**
   * Subscribe to every mutation. The listener is called immediately
   * with the current snapshot so hook consumers don't have to
   * double-initialise their local state. Returns an unsubscribe
   * function — the `usePendingTxCards` hook wires this into a
   * `useEffect` cleanup.
   */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    // Prime the listener with the current state so it doesn't have to
    // race a separate `list()` call on mount.
    try {
      listener(snapshot());
    } catch (err) {
      console.warn(
        `[pendingTxStore] initial listener snapshot threw: ${String(err)}`,
      );
    }
    return () => {
      listeners.delete(listener);
    };
  },

  /**
   * Drop every record. Used by tests — and reserved for future
   * navigation-cleanup hooks if product ever decides the cards
   * should not persist past a session boundary. NOT called from any
   * production code path today.
   */
  clear(): void {
    if (records.size === 0) return;
    records.clear();
    emit();
  },
};

// --- Test helpers -----------------------------------------------------------

/**
 * Test-only helpers. Mirrors the `__testing` convention used by
 * `services/agentSession/agentSession.ts`. Not exported from any
 * barrel — tests import it via the file path.
 */
export const __testing = {
  /** Hard reset: drops records and unsubscribes every listener. */
  reset(): void {
    records.clear();
    listeners.clear();
  },
  /** Inspect the raw listener set size (for unsubscribe assertions). */
  listenerCount(): number {
    return listeners.size;
  },
};
