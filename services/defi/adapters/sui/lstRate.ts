/**
 * Sui LST exchange-rate reads — the SUI⇄LST conversion every venue needs for
 * partial withdraw (SUI amount → LST to redeem) and live `readPosition` (LST
 * balance → SUI-equivalent).
 *
 * Each venue exposes a clean, ORACLE-FREE on-chain source (verified via
 * devInspect 2026-07-04). Read by `devInspect` (a pure view — signs nothing):
 *   - Volo      → native_pool::from_shares / to_shares (direct converters)
 *   - Aftermath → staked_sui_vault::afsui_to_sui (direct; invert via a 1-LST reference)
 *   - Haedal    → staking::get_exchange_rate (SUI-per-haSUI × 1e6)
 *   - SpringSui → total_sui_supply / total_lst_supply (ratio)
 *
 * All amounts are raw u64 (9 dp). Reads throw a curated `network_error` on RPC
 * failure so callers can retry or fall back (never a raw error — CLAUDE.md).
 */

import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { DefiError } from "../../errors/defiErrors";
import { leBytesToBigInt } from "./coins";
import type { SuiLstConfig } from "./lst.config";

/** Haedal `get_exchange_rate` is SUI-per-haSUI scaled by 1e6 (verified on-chain). */
const HAEDAL_XR_SCALE = 1_000_000n;
/** 1 LST/SUI (9 dp) — reference amount for rate reads that lack a direct inverse. */
const ONE_UNIT = 1_000_000_000n;

/** Run a devInspect of `tx` and return each move-call's first u64 return value. */
async function inspectU64s(
  client: SuiJsonRpcClient,
  sender: string,
  tx: Transaction,
): Promise<bigint[]> {
  const res = await client.devInspectTransactionBlock({
    transactionBlock: tx,
    sender,
  });
  if (res.effects?.status?.status !== "success") {
    throw new DefiError("network_error", "lst: exchange-rate read failed");
  }
  return (res.results ?? []).map((r) => {
    const bytes = r.returnValues?.[0]?.[0];
    return bytes && bytes.length > 0 ? leBytesToBigInt(bytes) : 0n;
  });
}

/**
 * SUI-equivalent (raw, 9 dp) of `lstAmount` of the venue's receipt coin — used
 * to value a live position. Falls back to a 1:1 estimate only when a divisor is
 * zero (never silently wrong by orders of magnitude).
 */
export async function lstToSui(
  cfg: SuiLstConfig,
  client: SuiJsonRpcClient,
  sender: string,
  lstAmount: bigint,
): Promise<bigint> {
  const tx = new Transaction();
  switch (cfg.venue) {
    case "haedal": {
      tx.moveCall({
        target: `${cfg.packageId}::staking::get_exchange_rate`,
        arguments: [tx.object(cfg.poolObject)],
      });
      const [xr] = await inspectU64s(client, sender, tx);
      return xr > 0n ? (lstAmount * xr) / HAEDAL_XR_SCALE : lstAmount;
    }
    case "volo": {
      tx.moveCall({
        target: `${cfg.packageId}::native_pool::from_shares`,
        arguments: [
          tx.object(cfg.poolObject),
          tx.object(requireMeta(cfg)),
          tx.pure.u64(lstAmount),
        ],
      });
      const [sui] = await inspectU64s(client, sender, tx);
      return sui;
    }
    case "springsui": {
      tx.moveCall({
        target: `${cfg.packageId}::liquid_staking::total_sui_supply`,
        arguments: [tx.object(cfg.poolObject)],
      });
      tx.moveCall({
        target: `${cfg.packageId}::liquid_staking::total_lst_supply`,
        arguments: [tx.object(cfg.poolObject)],
      });
      const [totalSui, totalLst] = await inspectU64s(client, sender, tx);
      return totalLst > 0n ? (lstAmount * totalSui) / totalLst : lstAmount;
    }
    case "aftermath": {
      tx.moveCall({
        target: `${cfg.packageId}::staked_sui_vault::afsui_to_sui`,
        arguments: [
          tx.object(cfg.poolObject),
          tx.object(requireSafe(cfg)),
          tx.pure.u64(lstAmount),
        ],
      });
      const [sui] = await inspectU64s(client, sender, tx);
      return sui;
    }
  }
}

/**
 * LST amount (raw, 9 dp) to redeem to receive approximately `suiAmount` SUI —
 * used to size a partial withdraw. The realised SUI is slightly less after the
 * venue's redeem/unstake fee; callers clamp to the held balance.
 */
export async function suiToLst(
  cfg: SuiLstConfig,
  client: SuiJsonRpcClient,
  sender: string,
  suiAmount: bigint,
): Promise<bigint> {
  const tx = new Transaction();
  switch (cfg.venue) {
    case "haedal": {
      tx.moveCall({
        target: `${cfg.packageId}::staking::get_exchange_rate`,
        arguments: [tx.object(cfg.poolObject)],
      });
      const [xr] = await inspectU64s(client, sender, tx);
      return xr > 0n ? (suiAmount * HAEDAL_XR_SCALE) / xr : suiAmount;
    }
    case "volo": {
      tx.moveCall({
        target: `${cfg.packageId}::native_pool::to_shares`,
        arguments: [
          tx.object(cfg.poolObject),
          tx.object(requireMeta(cfg)),
          tx.pure.u64(suiAmount),
        ],
      });
      const [lst] = await inspectU64s(client, sender, tx);
      return lst;
    }
    case "springsui": {
      tx.moveCall({
        target: `${cfg.packageId}::liquid_staking::total_sui_supply`,
        arguments: [tx.object(cfg.poolObject)],
      });
      tx.moveCall({
        target: `${cfg.packageId}::liquid_staking::total_lst_supply`,
        arguments: [tx.object(cfg.poolObject)],
      });
      const [totalSui, totalLst] = await inspectU64s(client, sender, tx);
      return totalSui > 0n ? (suiAmount * totalLst) / totalSui : suiAmount;
    }
    case "aftermath": {
      // No direct sui→afSUI: read SUI for 1 afSUI, then invert.
      tx.moveCall({
        target: `${cfg.packageId}::staked_sui_vault::afsui_to_sui`,
        arguments: [
          tx.object(cfg.poolObject),
          tx.object(requireSafe(cfg)),
          tx.pure.u64(ONE_UNIT),
        ],
      });
      const [suiPerUnit] = await inspectU64s(client, sender, tx);
      return suiPerUnit > 0n ? (suiAmount * ONE_UNIT) / suiPerUnit : suiAmount;
    }
  }
}

function requireMeta(cfg: SuiLstConfig): string {
  if (!cfg.metadataObject) {
    throw new DefiError("network_error", `${cfg.displayName}: config`);
  }
  return cfg.metadataObject;
}

function requireSafe(cfg: SuiLstConfig): string {
  if (!cfg.safeObject) {
    throw new DefiError("network_error", `${cfg.displayName}: config`);
  }
  return cfg.safeObject;
}
