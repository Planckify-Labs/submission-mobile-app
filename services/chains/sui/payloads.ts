/**
 * Sui dApp bridge approval payloads + structural types.
 * Per `docs/sui-dapp-bridge-spec.md` §6.
 *
 * Contract goals:
 *   - JSON/secret-free invariants (§11.5.2) encoded in the type system,
 *     not carried in prose. Every adapter / inspector / sheet imports
 *     from this module rather than re-declaring shapes.
 *   - `bigint` fields stay native at the wire-side. The JSON-safe
 *     coercion to string happens in `agentContext.ts` and `redact.ts`.
 *   - No `signAllTransactions` analogue. Wallet Standard Sui has none —
 *     PTBs express batches natively.
 */

export type SuiNetwork = "mainnet" | "testnet" | "devnet";
export type SuiChain = `sui:${SuiNetwork}`;

/** Connect (`standard:connect`) — silent vs. interactive choice. */
export type SuiConnectPayload = {
  network: SuiNetwork;
  /** Mirror of Solana `onlyIfTrusted`; true = silent reconnect. */
  onlyIfTrusted: boolean;
};

/**
 * SIWS (Sign-In-With-Sui) — EIP-4361-shaped per spec §6.
 * The canonical message string is patched onto this payload by
 * `SuiSiwsInspector` at intent enqueue.
 */
export type SuiSignInPayload = {
  domain: string;
  address?: string;
  statement?: string;
  uri?: string;
  version?: "1";
  chainId?: SuiNetwork;
  nonce?: string;
  issuedAt?: string;
  expirationTime?: string;
  notBefore?: string;
  requestId?: string;
  resources?: string[];
  /** Canonical SIWS message — populated by `SuiSiwsInspector`. */
  message?: string;
};

export type SuiSignPersonalMessagePayload = {
  address: string;
  /** base64 of the raw bytes the dApp passed in. */
  message: string;
  display: "utf8" | "base64";
};

export type SuiSignTxMode = "sign-only" | "sign-and-execute";

export type SuiTxOptions = {
  showEffects?: boolean;
  showEvents?: boolean;
  showObjectChanges?: boolean;
  showBalanceChanges?: boolean;
  showRawEffects?: boolean;
};

/**
 * PTB-decoded structural view emitted by `SuiPtbDecoderInspector`.
 * Discriminated by `kind`; sheets and the agent reader narrow on it.
 */
export type SuiDecodedCommand =
  | {
      kind: "MoveCall";
      package: string;
      module: string;
      function: string;
      argumentCount: number;
      typeArgumentCount: number;
    }
  | {
      kind: "TransferObjects";
      recipientArgIndex: number;
      objectArgCount: number;
    }
  | {
      kind: "SplitCoins";
      sourceArgIndex: number;
      amountCount: number;
    }
  | {
      kind: "MergeCoins";
      targetArgIndex: number;
      sourceArgCount: number;
    }
  | {
      kind: "Publish";
      modules: number;
      dependencies: number;
    }
  | {
      kind: "Upgrade";
      modules: number;
      dependencies: number;
    }
  | {
      kind: "MakeMoveVec";
      type?: string;
      elements: number;
    };

/** Discriminated warning union emitted by decoder + simulation inspectors. */
export type SuiSimulationWarning =
  | { code: "ownership.transfer-out"; coinType: string; amount: bigint }
  | { code: "object.delete"; objectId: string }
  | { code: "object.transfer-out"; objectType: string }
  | { code: "publish.upgrade-cap" }
  | { code: "gas.high-budget"; budgetMist: bigint }
  | { code: "sender.mismatch"; expected: string; got: string };

export type SuiSimulationSummary = {
  /** "success" or an error string per dryRunTransactionBlock effects status. */
  status: "success" | string;
  gasUsed: {
    computation: bigint;
    storage: bigint;
    storageRebate: bigint;
    nonRefundableStorageFee: bigint;
  };
  balanceChanges: Array<{
    owner: string;
    coinType: string;
    amount: bigint;
  }>;
  objectChanges: Array<{
    kind: "created" | "mutated" | "transferred" | "deleted";
    objectType?: string;
    objectId?: string;
    recipient?: string;
  }>;
  warnings: SuiSimulationWarning[];
};

/**
 * Sign-transaction payload — covers both sign-only and sign-and-execute
 * (mode flag). Optional fields are populated by the auto-pipeline:
 *   - `decoded` / `sender` / `gasOwner` / `gasBudget` / `gasPrice` /
 *     `inputArgumentCount` from `SuiPtbDecoderInspector` (priority 15)
 *   - `simulation` from `SuiSimulationInspector` (priority 20)
 */
export type SuiSignTxPayload = {
  mode: SuiSignTxMode;
  address: string;
  network: SuiNetwork;
  /** Base64-encoded BCS bytes — primary source of truth. */
  transaction: string;
  options?: SuiTxOptions;
  simulation?: SuiSimulationSummary;
  decoded?: SuiDecodedCommand[];
  /** Decoded structural fields. */
  sender?: string;
  /** ≠ sender ⇒ sponsored tx; sheets render an annotation. */
  gasOwner?: string;
  gasBudget?: bigint;
  gasPrice?: bigint;
  inputArgumentCount?: number;
};

export type SuiSwitchNetworkPayload = {
  from: SuiNetwork;
  to: SuiNetwork;
};

/** Top-level discriminated union — one entry per approval kind. */
export type SuiApprovalPayload =
  | ({ kind: "connect" } & SuiConnectPayload)
  | ({ kind: "signIn" } & SuiSignInPayload)
  | ({ kind: "signMessage" } & SuiSignPersonalMessagePayload)
  | ({ kind: "signTransaction" } & SuiSignTxPayload)
  | ({ kind: "switchNetwork" } & SuiSwitchNetworkPayload);

/**
 * `sui:signAndExecuteTransaction` payload alias — the bridge dispatcher
 * collapses sign-only and sign-and-execute onto `SuiSignTxPayload` (mode
 * discriminator), so `SuiSignAndExecuteTxPayload` is just the same shape
 * pinned to the `sign-and-execute` mode at the type level. Kept as a
 * distinct exported type so the dApp-bridge spec can reference the
 * Wallet-Standard method name 1:1 without restating the shape.
 */
export type SuiSignAndExecuteTxPayload = SuiSignTxPayload & {
  mode: "sign-and-execute";
};

/**
 * Legacy aliases — Wallet-Standard Sui used to suffix transaction methods
 * with `Block` (`sui:signTransactionBlock`, `sui:signAndExecuteTransactionBlock`).
 * Some dApps (older Suiet builds, third-party SDK forks) still emit the old
 * names. Keeping these as type aliases (not separate shapes) lets a single
 * dispatcher arm handle both once the bridge ships, per
 * `docs/sui-dapp-bridge-spec.md`.
 */
export type SuiSignTransactionBlockPayload = SuiSignTxPayload;
export type SuiSignAndExecuteTransactionBlockPayload =
  SuiSignAndExecuteTxPayload;

// ── Helpers ────────────────────────────────────────────────────────────

const ALL_NETWORKS: ReadonlySet<SuiNetwork> = new Set<SuiNetwork>([
  "mainnet",
  "testnet",
  "devnet",
]);

export function isSuiNetwork(value: unknown): value is SuiNetwork {
  return typeof value === "string" && ALL_NETWORKS.has(value as SuiNetwork);
}

export function networkToChain(net: SuiNetwork): SuiChain {
  return `sui:${net}`;
}

export function chainToNetwork(chain: string): SuiNetwork | null {
  if (!chain.startsWith("sui:")) return null;
  const ref = chain.slice(4);
  return isSuiNetwork(ref) ? ref : null;
}

/**
 * Normalise a dApp-supplied chain identifier. Accepts the three short
 * forms; rejects unknowns with a typed error code (the adapter narrows
 * the throw to `-32602` per `errorCodes.ts`). Localnet is rejected here
 * — adapter accepts it only with an explicit RPC override.
 */
export function canonicalizeSuiChain(input: string): SuiChain {
  const net = chainToNetwork(input);
  if (net) return `sui:${net}`;
  const err = new Error(`invalid Sui chain identifier: ${input}`);
  (err as Error & { code?: number }).code = -32602;
  throw err;
}
