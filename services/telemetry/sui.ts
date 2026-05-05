/**
 * Sui telemetry wrapper — Sentry-shaped tag / breadcrumb / context API.
 *
 * Spec reference: `docs/sui-chain-support-spec.md` §10 row 12, §6, §13.
 *
 * Why a wrapper, not a direct Sentry call?
 *   This codebase does not yet initialise `@sentry/react-native` (the
 *   only Sentry mention is a TODO in `services/bridge/sinks/TelemetrySink.ts`
 *   that documents this exact seam). Task 13 must NOT introduce a new
 *   transport / DSN — it's a tag + breadcrumb plumbing extension. So
 *   this module exposes the Sentry-shaped surface as no-ops (with dev
 *   `console.info` mirroring) and the four call sites in
 *   `SuiWalletKit.ts`, `tokenKind.ts`, and `walletService.getSuiSignerForWallet`
 *   wire to it. When the project's Sentry SDK lands, this single file
 *   gets the four `Sentry.*` swaps and every breadcrumb call site flows
 *   through automatically.
 *
 * Privacy invariants (verified by grep at the end of Task 13):
 *   - NEVER pass seed bytes, mnemonic words, private-key strings, or
 *     raw signer references to any function in this module.
 *   - NEVER pass user-pasted CoinType strings. For v1 we treat all
 *     CoinTypes as PII-tinted because token rows don't yet carry an
 *     `isUserPasted` discriminator. (TODO: source-tag the CoinType once
 *     token rows carry the flag.)
 *   - Public chain identifiers (denyListId, tokenPolicyId, tx digests
 *     after success) are fine — they're on-chain data.
 */

type BreadcrumbLevel = "info" | "warning" | "error";

interface BreadcrumbInput {
  category: string;
  message?: string;
  level?: BreadcrumbLevel;
  data?: Record<string, unknown>;
}

interface ChainTagInput {
  /** Namespace, e.g. `"sui" | "solana" | "evm"`. */
  chain: string;
  /** Network within the namespace, e.g. `"mainnet" | "testnet" | "devnet"`. */
  network?: string;
}

/**
 * Set the active-chain tag pair (`chain` + `network`). Called from the
 * active-chain effect when the user switches to a Sui chain.
 *
 * Mirrors the Solana shape — `chain="solana"`, `network=cluster` — so
 * dashboards can split error rates per namespace + network without
 * reasoning about the union type.
 *
 * TODO: wire to Sentry once initialized:
 *   Sentry.setTag("chain", input.chain);
 *   if (input.network) Sentry.setTag("network", input.network);
 */
export function setSuiChainTag(input: ChainTagInput): void {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.info(
      "[telemetry.sui] setTag",
      "chain=",
      input.chain,
      "network=",
      input.network ?? "(none)",
    );
  }
}

/**
 * Add a Sentry-style breadcrumb. Use `info` for start/success, `error`
 * for failure paths.
 *
 * TODO: wire to Sentry once initialized:
 *   Sentry.addBreadcrumb({ category, message, level, data });
 */
export function breadcrumb(input: BreadcrumbInput): void {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.info(
      "[telemetry.sui]",
      input.category,
      input.level ?? "info",
      input.message ?? "",
      input.data ?? {},
    );
  }
}

/**
 * Capture an exception with optional structured context. The `context`
 * object is attached as a Sentry context block (NOT as breadcrumb
 * `data`) so it survives sampling.
 *
 * TODO: wire to Sentry once initialized:
 *   if (context) Sentry.setContext(context.name, context.payload);
 *   Sentry.captureException(err);
 */
export function captureException(
  err: unknown,
  context?: { name: string; payload: Record<string, unknown> },
): void {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    const name = err instanceof Error ? err.name : typeof err;
    console.info(
      "[telemetry.sui] captureException",
      name,
      context?.name ?? "(no-context)",
      context?.payload ?? {},
    );
  }
}
