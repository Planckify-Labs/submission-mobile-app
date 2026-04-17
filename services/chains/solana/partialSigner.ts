/**
 * Partial / multi-signer support per Task 24 + §4.11.
 *
 * When the active wallet is NOT the fee payer of the transaction, the
 * signer produces a *partially* signed transaction — the wallet signs
 * its slot only, and the co-signer (fee payer) completes the signing
 * downstream. The output is the same base64 wire format, but with
 * incomplete signatures.
 *
 * Feature detection: read the message header's first account — if it
 * differs from the active wallet address, this is a co-signer flow.
 */

export interface PartialSignerAnalysis {
  isPartial: boolean;
  /** Fee payer — always `message.staticAccountKeys[0]`. */
  feePayer: string;
  /** True when the active wallet is the fee payer. */
  activeIsFeePayer: boolean;
  /** Remaining signers after the active wallet completes its slot. */
  remainingSigners: string[];
}

export function analysePartialSigner(args: {
  feePayer: string;
  activeWallet: string;
  signerAccounts: string[];
}): PartialSignerAnalysis {
  const activeIsFeePayer = args.feePayer === args.activeWallet;
  const remaining = args.signerAccounts.filter(
    (s) => s !== args.activeWallet,
  );
  return {
    isPartial: remaining.length > 0,
    feePayer: args.feePayer,
    activeIsFeePayer,
    remainingSigners: remaining,
  };
}

/**
 * Sheet annotation helper — call when `analysePartialSigner().isPartial`
 * returns true. The Transaction sheet surfaces this so the user knows
 * they're signing a tx that requires additional signatures before it
 * can broadcast.
 */
export function buildPartialSigningAnnotation(
  a: PartialSignerAnalysis,
): {
  code: "signer.partial";
  severity: "info";
  title: string;
  detail: string;
  source: "local";
} {
  return {
    code: "signer.partial",
    severity: "info",
    title: a.activeIsFeePayer
      ? "Partial signature required"
      : "Third-party fee payer",
    detail: a.activeIsFeePayer
      ? `This transaction needs ${a.remainingSigners.length} more signer(s) before it can broadcast.`
      : `Fees are paid by ${a.feePayer}. This site is signing as a co-signer.`,
    source: "local",
  };
}
