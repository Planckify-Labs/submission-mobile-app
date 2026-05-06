/**
 * Shared wire shape for every "list balances" tool, regardless of
 * namespace. Both `get_wallet_tokens` (EVM) and `get_wallet_spl_tokens`
 * (Solana) — and any future per-namespace balance tool — emit a
 * `WalletBalancesPayload`. A single `BalancesCard` consumes it.
 *
 * Naming the integer raw amount `balance_raw` (instead of `balance_wei`
 * / `balance_lamports`) keeps the card namespace-agnostic. The agent
 * never reads the raw amount — it reasons over `balance_display`.
 */

export type Namespace = "evm" | "solana" | "sui";

export type BalanceTokenRow = {
  symbol: string;
  name?: string;
  address: string; // "" or zero-address for native
  decimals: number;
  is_native: boolean;
  is_stable_coin?: boolean;
  logo_url?: string;
  pegged_currency?: string;
  balance_raw?: string;
  balance_display?: string;
};

export type BalanceGroup = {
  namespace: Namespace;
  /**
   * Numeric chain id for EVM, cluster name for Solana ("mainnet-beta" /
   * "devnet" / "testnet"), chain id string for Sui. Treated as opaque
   * by the card — used only as a stable React key.
   */
  chain_id?: number | string;
  chain_label: string; // "Ethereum", "Solana Mainnet", "Sui Testnet"
  chain_symbol?: string; // "ETH" | "SOL" | "SUI"
  chain_logo_url?: string;
  tokens: BalanceTokenRow[];
};

export type GroupError = {
  namespace: Namespace;
  chain_id?: number | string;
  chain_label: string;
  error: string;
};

export type WalletBalancesPayload = {
  groups: BalanceGroup[];
  group_errors?: GroupError[];
};

export type WalletBalancesOutput = {
  status?: "success" | "failed" | string;
  error?: string;
  display?: WalletBalancesPayload;
  data?: WalletBalancesPayload;
};

/**
 * Compact agent-facing slice — the LLM reads this, not `display`.
 * Drop logos / raw amounts / stable-coin tags (the model can infer
 * them) so each balance call costs as few input tokens as possible.
 */
export type AgentSliceTokenRow = Pick<
  BalanceTokenRow,
  "symbol" | "address" | "decimals" | "is_native" | "balance_display"
>;

export function toAgentSlice(
  payload: WalletBalancesPayload,
): WalletBalancesPayload {
  return {
    groups: payload.groups.map((g) => ({
      namespace: g.namespace,
      chain_id: g.chain_id,
      chain_label: g.chain_label,
      chain_symbol: g.chain_symbol,
      tokens: g.tokens.map(
        (t): BalanceTokenRow => ({
          symbol: t.symbol,
          address: t.address,
          decimals: t.decimals,
          is_native: t.is_native,
          ...(t.balance_display !== undefined
            ? { balance_display: t.balance_display }
            : {}),
        }),
      ),
    })),
    ...(payload.group_errors ? { group_errors: payload.group_errors } : {}),
  };
}
