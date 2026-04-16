/**
 * Swap aggregator — calls takumipay-api for routing.
 */

import ky from "ky";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

export interface SwapParams {
  fromToken: string;
  toToken: string;
  amount: string;
  slippage: number;
  chainId: number;
  userAddress: string;
}

export interface SwapRoute {
  aggregator: string;
  fromToken: { address: string; symbol: string; decimals: number };
  toToken: { address: string; symbol: string; decimals: number };
  fromAmount: string;
  toAmount: string;
  toAmountMin: string;
  priceImpact: number;
  gasEstimate: string;
  calldata: string;
  to: string;
  value: string;
  requiresApproval: boolean;
  approvalAddress?: string;
}

export async function getSwapRoute(params: SwapParams): Promise<SwapRoute> {
  const response = await ky
    .post(`${API_URL}/swap/route`, { json: params })
    .json<SwapRoute>();
  return response;
}

export function getPriceImpactSeverity(
  impact: number,
): "safe" | "warn" | "danger" {
  if (Math.abs(impact) < 2) return "safe";
  if (Math.abs(impact) < 10) return "warn";
  return "danger";
}

export function validateSlippage(slippage: number): {
  valid: boolean;
  warning?: string;
} {
  if (slippage < 0.01) return { valid: false, warning: "Slippage too low" };
  if (slippage > 50) return { valid: false, warning: "Slippage too high" };
  if (slippage > 1)
    return {
      valid: true,
      warning: "High slippage — you may receive significantly less",
    };
  return { valid: true };
}
