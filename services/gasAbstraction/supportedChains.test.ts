/**
 * Tests for the gas-abstraction chain gate.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { base, baseSepolia, mainnet } from "viem/chains";
import type { ChainConfig } from "@/constants/configs/chainConfig";
import {
  GAS_ABSTRACTION_CHAIN_IDS,
  isGasAbstractionSupported,
} from "./supportedChains";

describe("isGasAbstractionSupported", () => {
  it("accepts allowlisted EVM chains (Base, Base Sepolia, Ethereum)", () => {
    for (const c of [base, baseSepolia, mainnet]) {
      assert.equal(
        isGasAbstractionSupported({ namespace: "eip155", chain: c }),
        true,
        `${c.name} should be supported`,
      );
    }
  });

  it("rejects EVM chains not in the allowlist", () => {
    const unlisted: ChainConfig = {
      namespace: "eip155",
      chain: { ...mainnet, id: 424242 },
    };
    assert.equal(isGasAbstractionSupported(unlisted), false);
  });

  it("rejects non-EVM namespaces", () => {
    assert.equal(
      isGasAbstractionSupported({
        namespace: "solana",
        cluster: "devnet",
        rpcUrl: "x",
      }),
      false,
    );
    assert.equal(
      isGasAbstractionSupported({
        namespace: "sui",
        network: "testnet",
        rpcUrl: "x",
      }),
      false,
    );
  });

  it("includes the documented 1Shot networks", () => {
    // Spot-check a few ids from the published support table.
    for (const id of [1, 8453, 42161, 137, 10, 59144]) {
      assert.equal(GAS_ABSTRACTION_CHAIN_IDS.has(id), true);
    }
  });
});
