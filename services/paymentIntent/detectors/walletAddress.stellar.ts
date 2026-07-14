/**
 * Stellar wallet-address detector — see `docs/stellar-chain-support-spec.md`
 * and the chain-extension discipline in
 * `feedback_chain_extension_discipline.md`.
 *
 * Matches raw canonical Stellar account addresses only: StrKey `G…`
 * ed25519 public keys (56 chars, base32). Delegates to
 * `isValidStellarAddress` (the `@stellar/stellar-base` `StrKey` wrapper
 * already used everywhere else in the Stellar chain support surface)
 * rather than hand-rolling base32 / checksum validation here.
 *
 * Lives in its own file (rather than alongside the EVM/Solana shapes in
 * `walletAddress.ts`) per that file's header discipline note: "Adding a
 * new bare-address shape is a new detector file, not a new `if` here."
 * Mirrors `walletAddress.sui.ts`.
 *
 * Priority 50 — peer to `walletAddressDetector` / `walletAddressSuiDetector`.
 * StrKey `G…` addresses don't overlap the EVM `0x…{40}` or Sui `0x…{64}`
 * shapes, so registration order between the three doesn't matter.
 *
 * Purity: no React, no network. Returns the raw address as-is so the
 * /send screen remains the single authority on canonicalisation.
 */

import { isValidStellarAddress } from "../../chains/stellar/strkey.ts";
import { type Detector, register } from "../detectorRegistry.ts";
import type { PaymentIntent, RawScan } from "../types.ts";

export const walletAddressStellarDetector: Detector = {
  name: "walletAddressStellar",
  priority: 50,
  detect: (raw: RawScan): PaymentIntent | null => {
    const trimmed = raw.trim();
    if (!isValidStellarAddress(trimmed)) return null;

    return {
      source: "qr",
      channel: {
        kind: "wallet",
        namespace: "stellar",
        address: trimmed,
        target: undefined,
      },
      rawScan: raw,
    };
  },
};

register(walletAddressStellarDetector);
