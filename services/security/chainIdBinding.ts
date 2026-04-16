// TWV-2026-029 — chainId binding guards. Every signed transaction MUST
// declare a chainId; every EIP-712 typed payload MUST carry
// `domain.chainId` matching the active chain. Replays on forked chains
// (ETH/ETC 2016, ETH/ETHW 2022) are the failure mode this prevents.
//
// Pure predicates wired into the signer call paths.

export interface SignedTxLike {
  type?: 0 | 1 | 2 | "legacy" | "eip2930" | "eip1559";
  chainId?: number;
}

export interface TypedDataLike {
  domain?: { chainId?: number | string };
  primaryType?: string;
  message?: unknown;
  types?: unknown;
}

export type ChainIdBindingDecision =
  | { ok: true }
  | { ok: false; code: "missing_chainid" | "legacy_type" | "domain_mismatch"; message: string };

/**
 * Refuse signing if the payload doesn't declare chainId, or if the
 * type defaults to legacy (no fork-replay protection without an
 * explicit user-opt-in path that this codebase does not ship today).
 */
export function decideTxChainBinding(
  tx: SignedTxLike,
  activeChainId: number,
): ChainIdBindingDecision {
  if (typeof tx.chainId !== "number") {
    return {
      ok: false,
      code: "missing_chainid",
      message: "tx is missing chainId — fork-replay protection requires it",
    };
  }
  if (tx.chainId !== activeChainId) {
    return {
      ok: false,
      code: "domain_mismatch",
      message: `tx chainId ${tx.chainId} does not match active chain ${activeChainId}`,
    };
  }
  if (tx.type === 0 || tx.type === "legacy") {
    return {
      ok: false,
      code: "legacy_type",
      message: "legacy (type-0) tx signing is disabled by default",
    };
  }
  return { ok: true };
}

/**
 * Refuse signing of typed data missing `domain.chainId`, or where the
 * declared chainId disagrees with the active chain. The latter is the
 * SIWE / Permit replay surface (paired with TWV-2026-012).
 */
export function decideTypedDataChainBinding(
  typedData: TypedDataLike,
  activeChainId: number,
): ChainIdBindingDecision {
  const declared = typedData.domain?.chainId;
  if (declared === undefined || declared === null) {
    return {
      ok: false,
      code: "missing_chainid",
      message: "typed data missing domain.chainId",
    };
  }
  const declaredNum =
    typeof declared === "string" ? Number(declared) : declared;
  if (!Number.isFinite(declaredNum)) {
    return {
      ok: false,
      code: "missing_chainid",
      message: "typed data domain.chainId is not a number",
    };
  }
  if (declaredNum !== activeChainId) {
    return {
      ok: false,
      code: "domain_mismatch",
      message: `typed data chainId ${declaredNum} does not match active chain ${activeChainId}`,
    };
  }
  return { ok: true };
}
