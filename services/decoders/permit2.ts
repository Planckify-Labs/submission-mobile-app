import type { TypedDataDefinition } from "viem";

const UNLIMITED_THRESHOLD = (1n << 160n) - (1n << 10n) - 1n;

export interface DecodedPermit2 {
  standard: "Permit2";
  verifyingContract: `0x${string}`;
  spender: `0x${string}`;
  tokens: Array<{ address: `0x${string}`; amount: bigint; expiration: bigint }>;
  sigDeadline: bigint;
  nonce: bigint;
  isUnlimited: boolean;
}

export function tryDecodePermit2(
  typedData: TypedDataDefinition | null | undefined,
): DecodedPermit2 | null {
  if (!typedData) return null;
  try {
    const { domain, types, primaryType, message } = typedData as any;
    if (domain?.name !== "Permit2") return null;

    if (primaryType === "PermitSingle" && types?.PermitSingle) {
      const d = message.details;
      const amount = BigInt(d.amount);
      return {
        standard: "Permit2",
        verifyingContract: (domain.verifyingContract as `0x${string}`) ?? "0x",
        spender: message.spender,
        tokens: [
          {
            address: d.token,
            amount,
            expiration: BigInt(d.expiration),
          },
        ],
        sigDeadline: BigInt(message.sigDeadline),
        nonce: BigInt(d.nonce),
        isUnlimited: amount >= UNLIMITED_THRESHOLD,
      };
    }

    if (primaryType === "PermitBatch" && types?.PermitBatch) {
      const details = (message.details ?? []) as Array<{
        token: `0x${string}`;
        amount: string | bigint;
        expiration: string | bigint;
        nonce: string | bigint;
      }>;
      const tokens = details.map((d) => ({
        address: d.token,
        amount: BigInt(d.amount),
        expiration: BigInt(d.expiration),
      }));
      return {
        standard: "Permit2",
        verifyingContract: (domain.verifyingContract as `0x${string}`) ?? "0x",
        spender: message.spender,
        tokens,
        sigDeadline: BigInt(message.sigDeadline),
        nonce: BigInt(details[0]?.nonce ?? 0),
        isUnlimited: tokens.some((t) => t.amount >= UNLIMITED_THRESHOLD),
      };
    }

    // Permit2 signature-transfer variants — no allowance is granted, but
    // the user authorises a specific spender to pull an exact amount.
    if (primaryType === "PermitTransferFrom" && types?.PermitTransferFrom) {
      const permitted = message.permitted as {
        token: `0x${string}`;
        amount: string | bigint;
      };
      const amount = BigInt(permitted.amount);
      return {
        standard: "Permit2",
        verifyingContract: (domain.verifyingContract as `0x${string}`) ?? "0x",
        spender: message.spender,
        tokens: [{ address: permitted.token, amount, expiration: 0n }],
        sigDeadline: BigInt(message.deadline ?? message.sigDeadline ?? 0),
        nonce: BigInt(message.nonce ?? 0),
        isUnlimited: amount >= UNLIMITED_THRESHOLD,
      };
    }

    if (
      primaryType === "PermitBatchTransferFrom" &&
      types?.PermitBatchTransferFrom
    ) {
      const permitted = (message.permitted ?? []) as Array<{
        token: `0x${string}`;
        amount: string | bigint;
      }>;
      const tokens = permitted.map((p) => ({
        address: p.token,
        amount: BigInt(p.amount),
        expiration: 0n,
      }));
      return {
        standard: "Permit2",
        verifyingContract: (domain.verifyingContract as `0x${string}`) ?? "0x",
        spender: message.spender,
        tokens,
        sigDeadline: BigInt(message.deadline ?? message.sigDeadline ?? 0),
        nonce: BigInt(message.nonce ?? 0),
        isUnlimited: tokens.some((t) => t.amount >= UNLIMITED_THRESHOLD),
      };
    }

    return null;
  } catch {
    return null;
  }
}
