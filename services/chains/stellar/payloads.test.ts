/**
 * Contract tests for the Stellar dApp-bridge payload helpers.
 * Mirrors `services/chains/sui/payloads.test.ts`'s coverage shape.
 */

import { describe, expect, it } from "vitest";

import {
  chainToNetwork,
  isStellarNetwork,
  networkToChain,
} from "./payloads.ts";

describe("isStellarNetwork", () => {
  it("accepts mainnet/testnet", () => {
    expect(isStellarNetwork("mainnet")).toBe(true);
    expect(isStellarNetwork("testnet")).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isStellarNetwork("devnet")).toBe(false);
    expect(isStellarNetwork("pubnet")).toBe(false);
    expect(isStellarNetwork(undefined)).toBe(false);
    expect(isStellarNetwork(123)).toBe(false);
  });
});

describe("networkToChain / chainToNetwork", () => {
  it("round-trips mainnet", () => {
    expect(networkToChain("mainnet")).toBe("stellar:mainnet");
    expect(chainToNetwork("stellar:mainnet")).toBe("mainnet");
  });

  it("round-trips testnet", () => {
    expect(networkToChain("testnet")).toBe("stellar:testnet");
    expect(chainToNetwork("stellar:testnet")).toBe("testnet");
  });

  it("chainToNetwork rejects non-stellar chain identifiers", () => {
    expect(chainToNetwork("sui:mainnet")).toBeNull();
    expect(chainToNetwork("solana:mainnet-beta")).toBeNull();
    expect(chainToNetwork("stellar:pubnet")).toBeNull();
  });
});
