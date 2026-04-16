// TWV-2026-033 — Independent Safe tx-hash re-derivation. Bybit (~$1.46B,
// Feb 2025) signers trusted a compromised dApp frontend to tell them
// what they were signing; the hardware wallet only showed `delegatecall`
// and an opaque hash. The defence is to recompute the EIP-712 Safe tx
// hash inside the wallet from the raw fields and surface it to the
// signer UI for out-of-band comparison against Safe Transaction Service.

import { hashTypedData, type Hex } from "viem";

export interface SafeTxFields {
  to: `0x${string}`;
  value: bigint;
  data: `0x${string}`;
  /** 0 = CALL, 1 = DELEGATECALL (almost always the attack surface). */
  operation: 0 | 1;
  safeTxGas: bigint;
  baseGas: bigint;
  gasPrice: bigint;
  gasToken: `0x${string}`;
  refundReceiver: `0x${string}`;
  nonce: bigint;
}

export interface SafeTxContext {
  /** The Safe (multisig) contract address. */
  safeAddress: `0x${string}`;
  chainId: number;
}

const SAFE_TX_TYPES = {
  SafeTx: [
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "data", type: "bytes" },
    { name: "operation", type: "uint8" },
    { name: "safeTxGas", type: "uint256" },
    { name: "baseGas", type: "uint256" },
    { name: "gasPrice", type: "uint256" },
    { name: "gasToken", type: "address" },
    { name: "refundReceiver", type: "address" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

/**
 * Recompute the Safe transaction hash from raw fields. This is what
 * the user signs with `eth_signTypedData_v4` for a Safe co-sign.
 *
 * MUST be invoked locally from raw payload fields — never trust the
 * dApp's pre-computed hash.
 */
export function computeSafeTxHash(
  fields: SafeTxFields,
  ctx: SafeTxContext,
): Hex {
  return hashTypedData({
    domain: {
      chainId: ctx.chainId,
      verifyingContract: ctx.safeAddress,
    },
    types: SAFE_TX_TYPES,
    primaryType: "SafeTx",
    message: {
      to: fields.to,
      value: fields.value,
      data: fields.data,
      operation: fields.operation,
      safeTxGas: fields.safeTxGas,
      baseGas: fields.baseGas,
      gasPrice: fields.gasPrice,
      gasToken: fields.gasToken,
      refundReceiver: fields.refundReceiver,
      nonce: fields.nonce,
    },
  });
}

/**
 * Discriminator for the signer UI — true if the Safe payload uses
 * `delegatecall`. The UI must hard-warn (red banner + cool-down) on
 * true; this is the single most common attack surface.
 */
export function isDelegatecall(fields: SafeTxFields): boolean {
  return fields.operation === 1;
}
