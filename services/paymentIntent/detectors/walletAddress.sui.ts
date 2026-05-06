/**
 * Sui wallet-address detector — see `docs/sui-chain-support-spec.md` §1.4
 * and the chain-extension discipline in
 * `feedback_chain_extension_discipline.md`.
 *
 * Matches raw canonical Sui addresses only: `0x` + 64 lowercase hex chars
 * (32-byte form). The 20-byte legacy shape is intentionally rejected here
 * — `app/send.tsx` surfaces a migration message for it via
 * `classifySuiRecipient`, so passing a legacy address through to /send as
 * a "valid" intent would skip that user-facing pointer.
 *
 * Lives in its own file (rather than alongside the EVM/Solana shapes in
 * `walletAddress.ts`) per the discipline note in that file's header:
 * "Adding a new bare-address shape (e.g. SUI) is a new detector file,
 * not a new `if` here."
 *
 * Priority 50 — peer to `walletAddressDetector`. The 0x{40} (EVM) and
 * 0x{64} (Sui) regexes don't overlap, so registration order between the
 * two doesn't matter.
 *
 * Purity: no React, no network. Returns the raw address as-is so the
 * /send screen remains the single authority on canonicalisation.
 */

import { type Detector, register } from "../detectorRegistry.ts";
import type { PaymentIntent, RawScan } from "../types.ts";

const SUI_ADDRESS = /^0x[0-9a-f]{64}$/;

export const walletAddressSuiDetector: Detector = {
  name: "walletAddressSui",
  priority: 50,
  detect: (raw: RawScan): PaymentIntent | null => {
    const trimmed = raw.trim();
    if (!SUI_ADDRESS.test(trimmed)) return null;

    return {
      source: "qr",
      channel: {
        kind: "wallet",
        namespace: "sui",
        address: trimmed,
        target: undefined,
      },
      rawScan: raw,
    };
  },
};

register(walletAddressSuiDetector);
