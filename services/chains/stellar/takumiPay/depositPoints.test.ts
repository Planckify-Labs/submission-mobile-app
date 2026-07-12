/**
 * Unit tests for the `deposit_points` argument encoder + SAC resolver.
 *
 * Unlike the merchant-quote encoder there is no byte-exact backend fixture to
 * match (no signature over these bytes), so these assert the structural shape
 * the contract ABI expects: `deposit_points(payer: Address, token: Address,
 * ref_id: String, amount: i128)`.
 */

import { Address, Networks, scValToNative } from "@stellar/stellar-base";
import { describe, expect, it } from "vitest";

import {
  buildDepositPointsArgs,
  resolveStellarSacId,
} from "./depositPoints.ts";

const PAYER = "GCZ6IK35AZZU2DC5HLRSEE2I3F5YUBRTALUA3ILI7V2FV5KLT2OR4LWM";
const SAC = "CDJGWVHOS6XGCL5MJJFL2WTCNSFCKAGKW2KFZQ6CDEYZICUPEWS5FT4E";

describe("buildDepositPointsArgs", () => {
  it("encodes (payer, token, ref_id, amount) in ABI order and types", () => {
    const args = buildDepositPointsArgs({
      payer: PAYER,
      tokenSacId: SAC,
      refId: "pt_123_abc",
      amount: 10_000_000n, // 1 USDC @ 7dp
    });

    expect(args).toHaveLength(4);
    expect(args[0].switch().name).toBe("scvAddress");
    expect(Address.fromScVal(args[0]).toString()).toBe(PAYER);
    expect(args[1].switch().name).toBe("scvAddress");
    expect(Address.fromScVal(args[1]).toString()).toBe(SAC);
    expect(args[2].switch().name).toBe("scvString");
    expect(scValToNative(args[2])).toBe("pt_123_abc");
    // i128 → bigint
    expect(scValToNative(args[3])).toBe(10_000_000n);
  });
});

describe("resolveStellarSacId", () => {
  it("returns an already-resolved C… contract id unchanged", () => {
    expect(resolveStellarSacId(SAC, Networks.TESTNET)).toBe(SAC);
  });

  it("derives a deterministic C… SAC id from a compound CODE:ISSUER", () => {
    const compound = `USDC:${PAYER}`;
    const sac = resolveStellarSacId(compound, Networks.TESTNET);
    expect(sac.startsWith("C")).toBe(true);
    expect(sac).toHaveLength(56);
    // Deterministic for the same (code, issuer, network).
    expect(resolveStellarSacId(compound, Networks.TESTNET)).toBe(sac);
    // Network-scoped: mainnet derives a different id.
    expect(resolveStellarSacId(compound, Networks.PUBLIC)).not.toBe(sac);
  });

  it("rejects a malformed token identifier", () => {
    expect(() => resolveStellarSacId("USDC", Networks.TESTNET)).toThrow(
      /Invalid Stellar token identifier/,
    );
    expect(() => resolveStellarSacId("USDC:", Networks.TESTNET)).toThrow(
      /Invalid Stellar token identifier/,
    );
  });
});
