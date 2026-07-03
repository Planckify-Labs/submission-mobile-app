/**
 * Erc4626Adapter — ONE generic adapter for the entire ERC-4626 vault family
 * (Morpho MetaMorpho, Yearn v3, Euler v2, Gearbox…), the biggest coverage
 * unlock in the pool-level deposits spec (§7, §7.1).
 *
 * Unlike the per-deployment adapters (aaveV3/morpho/yearnV3 with a hardcoded
 * market), this one is parametrised entirely by the resolved
 * `DepositTarget` — `{ kind: "erc4626", vault, asset }` — that the backend
 * resolver produced and the executor re-fetched by `pool_id`. It is routed by
 * `DepositTarget.kind` (`targetKinds: ["erc4626"]`), NOT by slug/chainId, so a
 * single instance serves every sibling vault on every EVM chain. The LLM never
 * supplies the vault address; it arrives on `args.target` from the trusted
 * server round-trip (§6, §8).
 *
 * Deposit uses the canonical `deposit(assets, receiver)`. Withdraw uses
 * `redeem(shares,…)` for a full exit (avoids dust) and `withdraw(assets,…)`
 * for a partial. `readPosition(walletAddress)` returns null — the vault can't
 * be derived from an address alone, so 4626 positions fall back to the DB
 * snapshot (best-effort, spec §14.5); the withdraw path threads the target
 * from the position's pinned `poolId`.
 */

import { type Address, encodeFunctionData } from "viem";
import { assertEvmChain } from "@/constants/configs/chainConfig";
import { getPublicClient } from "@/utils/clients";
import { DefiError } from "../errors/defiErrors";
import type {
  BuildDepositArgs,
  BuildWithdrawArgs,
  DefiPosition,
  DefiProtocolAdapter,
  DepositTarget,
  UnsignedCall,
} from "../types";

const ERC4626_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "redeem",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "assets", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

function requireErc4626Target(
  target: DepositTarget | undefined,
): Extract<DepositTarget, { kind: "erc4626" }> {
  if (!target || target.kind !== "erc4626") {
    // The executor must re-fetch + pass the server-resolved target; a missing
    // one is a wiring error, never LLM-supplied.
    throw new DefiError(
      "protocol_not_found",
      "erc4626 adapter requires a resolved { kind: 'erc4626' } depositTarget",
    );
  }
  return target;
}

export const Erc4626Adapter: DefiProtocolAdapter = {
  slug: "erc4626",
  namespace: "eip155",
  kind: "yield_vault",
  // Nominal — this adapter is routed by `DepositTarget.kind`, not chainId. 0
  // keeps it out of per-chain venue listings (`listDefiAdaptersForChain`).
  chainId: 0,
  displayName: "ERC-4626 Vault",
  targetKinds: ["erc4626"],

  async buildDeposit({
    wallet,
    asset,
    amount,
    target,
  }: BuildDepositArgs): Promise<UnsignedCall> {
    const t = requireErc4626Target(target);
    // Defence-in-depth: if the caller passed an explicit asset contract it
    // must match the target's underlying (the target is the trusted source).
    if (
      asset.contract &&
      asset.contract.toLowerCase() !== t.asset.toLowerCase()
    ) {
      throw new DefiError(
        "unsupported_asset",
        "erc4626: asset does not match resolved vault underlying",
      );
    }
    return {
      kind: "evm-call",
      to: t.vault,
      data: encodeFunctionData({
        abi: ERC4626_ABI,
        functionName: "deposit",
        args: [amount, wallet.address as Address],
      }),
      needsApproval: {
        token: t.asset,
        spender: t.vault,
        amount,
      },
    } as UnsignedCall;
  },

  async buildWithdraw({
    wallet,
    chain,
    amount,
    target,
  }: BuildWithdrawArgs): Promise<UnsignedCall> {
    const t = requireErc4626Target(target);
    const owner = wallet.address as Address;
    if (amount === "MAX") {
      const evm = assertEvmChain(chain);
      const client = getPublicClient(evm.chain);
      const shares = await client.readContract({
        address: t.vault,
        abi: ERC4626_ABI,
        functionName: "balanceOf",
        args: [owner],
      });
      if (shares === 0n) {
        throw new DefiError("position_not_found", "erc4626: no shares");
      }
      return {
        kind: "evm-call",
        to: t.vault,
        data: encodeFunctionData({
          abi: ERC4626_ABI,
          functionName: "redeem",
          args: [shares, owner, owner],
        }),
      } as UnsignedCall;
    }
    return {
      kind: "evm-call",
      to: t.vault,
      data: encodeFunctionData({
        abi: ERC4626_ABI,
        functionName: "withdraw",
        args: [amount, owner, owner],
      }),
    } as UnsignedCall;
  },

  readPosition(): Promise<DefiPosition | null> {
    // The vault address lives on the resolved target, not derivable from the
    // wallet address, so a standalone read isn't possible. Positions opened
    // through this adapter fall back to the backend snapshot (spec §14.5).
    return Promise.resolve(null);
  },
};
