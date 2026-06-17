import { describe, expect, it } from "vitest";
import type { SuiChainConfig } from "@/constants/configs/chainConfig";
import type { TWallet } from "@/constants/types/walletTypes";
import type { SuiNetwork } from "@/services/chains/sui/payloads";
import { getSuiSwapRoute } from "./suiSwapRouter";
import {
  SuiSwapError,
  type SuiSwapRouteParams,
  type SuiSwapVenue,
} from "./types";
import { selectSwapRoute } from "./venueSelector";

function params(network: SuiNetwork): SuiSwapRouteParams {
  return {
    wallet: { address: "0xabc", namespace: "sui" } as unknown as TWallet,
    chain: {
      namespace: "sui",
      network,
      rpcUrl: "http://localhost",
    } as unknown as SuiChainConfig,
    fromSymbol: "SUI",
    toSymbol: "USDC",
    fromCoinType: "0x2::sui::SUI",
    toCoinType: "0xUSDC::usdc::USDC",
    fromDecimals: 9,
    toDecimals: 6,
    amountHuman: "5",
    amountRaw: 5_000_000_000n,
    maxSlippageBps: 50,
  };
}

function makeVenue(
  id: string,
  networks: SuiNetwork[],
  result: bigint | "throw" | null,
): SuiSwapVenue {
  return {
    id,
    supports: (n) => networks.includes(n),
    getRoute: async (p) => {
      if (result === "throw") throw new Error("boom");
      if (result === null) return null;
      return {
        venue: id,
        ptbBase64: "AAA=",
        expectedOut: result,
        priceImpact: 0,
        fromCoinType: p.fromCoinType,
        toCoinType: p.toCoinType,
      };
    },
  };
}

const ALL: SuiNetwork[] = ["mainnet", "testnet", "devnet"];
const MAINNET: SuiNetwork[] = ["mainnet"];

describe("selectSwapRoute", () => {
  it("on testnet resolves only DeepBook (ignores mainnet-only venues)", async () => {
    const venues = [
      makeVenue("deepbook", ALL, 100n),
      makeVenue("cetus", MAINNET, 999n),
      makeVenue("7k", MAINNET, 999n),
    ];
    const route = await selectSwapRoute(params("testnet"), venues);
    expect(route?.venue).toBe("deepbook");
    expect(route?.expectedOut).toBe(100n);
  });

  it("on mainnet picks the best expected-out", async () => {
    const venues = [
      makeVenue("cetus", MAINNET, 200n),
      makeVenue("7k", MAINNET, 300n),
      makeVenue("deepbook", ALL, 100n),
    ];
    const route = await selectSwapRoute(params("mainnet"), venues);
    expect(route?.venue).toBe("7k");
    expect(route?.expectedOut).toBe(300n);
  });

  it("breaks ties toward the earlier-priority venue", async () => {
    const venues = [
      makeVenue("cetus", MAINNET, 200n),
      makeVenue("7k", MAINNET, 200n),
      makeVenue("deepbook", ALL, 200n),
    ];
    const route = await selectSwapRoute(params("mainnet"), venues);
    expect(route?.venue).toBe("cetus");
  });

  it("skips venues that throw", async () => {
    const venues = [
      makeVenue("cetus", MAINNET, "throw"),
      makeVenue("7k", MAINNET, 300n),
      makeVenue("deepbook", ALL, 100n),
    ];
    const route = await selectSwapRoute(params("mainnet"), venues);
    expect(route?.venue).toBe("7k");
  });

  it("returns null when no venue answers", async () => {
    const venues = [
      makeVenue("cetus", MAINNET, null),
      makeVenue("7k", MAINNET, null),
      makeVenue("deepbook", ALL, null),
    ];
    expect(await selectSwapRoute(params("mainnet"), venues)).toBeNull();
  });

  it("re-throws a venue's actionable reason when no route wins", async () => {
    const belowMin: SuiSwapVenue = {
      id: "deepbook",
      supports: () => true,
      getRoute: async () => {
        throw new SuiSwapError("amount_below_minimum", "min 1 SUI");
      },
    };
    await expect(
      selectSwapRoute(params("testnet"), [belowMin]),
    ).rejects.toMatchObject({ code: "amount_below_minimum" });
  });

  it("ignores a venue's reason when another venue produces a route", async () => {
    const belowMin: SuiSwapVenue = {
      id: "cetus",
      supports: (n) => n === "mainnet",
      getRoute: async () => {
        throw new SuiSwapError("amount_below_minimum");
      },
    };
    const venues = [belowMin, makeVenue("deepbook", ALL, 100n)];
    const route = await selectSwapRoute(params("mainnet"), venues);
    expect(route?.venue).toBe("deepbook");
    expect(route?.expectedOut).toBe(100n);
  });
});

describe("getSuiSwapRoute", () => {
  it("throws no_swap_route when no venue answers", async () => {
    const venues = [makeVenue("deepbook", ALL, null)];
    await expect(getSuiSwapRoute(params("testnet"), venues)).rejects.toThrow(
      SuiSwapError,
    );
  });
});
