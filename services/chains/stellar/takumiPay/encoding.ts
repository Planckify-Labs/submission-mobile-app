/**
 * Byte-exact XDR encoding of the `takumi_pay` contract's `MerchantQuote`
 * struct (`process_merchant_payment`'s backend-signed argument).
 *
 * WHY THIS IS LOAD-BEARING: the contract reconstructs
 * `QuoteMessage { network_id, contract, quote }`, XDR-encodes it, and
 * `ed25519_verify`s the backend signature over those bytes. If the `quote`
 * ScVal this wallet submits differs by a single byte from the one the backend
 * signed, verification **traps** and the whole invocation aborts. So this MUST
 * reproduce the backend's encoder exactly — it is a direct port of the API's
 * `signMerchantQuote` `quoteEntries`
 * (`api/src/blockchain-verification/stellar-verification.service.ts`), locked
 * to it by the byte-for-byte fixture in `encoding.test.ts`.
 *
 * `#[contracttype]` (soroban-sdk) serializes a struct as an `ScVal::Map` whose
 * entries are sorted **alphabetically by Rust field name** (not declaration
 * order). `@stellar/stellar-base@15` predates `scvSortedMap`, so — exactly like
 * the API — we reproduce that ordering locally in `scvSortedMap`.
 */

import { Address, nativeToScVal, xdr } from "@stellar/stellar-base";
import type { MerchantQuoteFields } from "./types";

function sym(name: string): xdr.ScVal {
  return xdr.ScVal.scvSymbol(name);
}

/** Sort ScVal map entries by their Symbol key — mirrors soroban-sdk's derive. */
function scvSortedMap(entries: xdr.ScMapEntry[]): xdr.ScVal {
  const sorted = [...entries].sort((a, b) => {
    const aKey = a.key().sym().toString();
    const bKey = b.key().sym().toString();
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  });
  return xdr.ScVal.scvMap(sorted);
}

/**
 * `fiat_currency` is a Rust `BytesN<3>` — always exactly 3 bytes. Encoded as
 * `SCV_BYTES`, identical to the API's `nativeToScVal(Buffer.from(code))`.
 * Shorter codes are right-padded with NUL; longer are truncated (currency
 * codes are ISO-4217, always 3 chars, so padding/truncation is defensive).
 */
function fiatCurrencyToScVal(code: string): xdr.ScVal {
  const bytes = new Uint8Array(3);
  for (let i = 0; i < 3; i++) {
    bytes[i] = i < code.length ? code.charCodeAt(i) & 0xff : 0;
  }
  // `Buffer.from` (input side) is safe under Hermes — only `.toString("base64")`
  // is broken (see base64.ts) — and the SDK types want a Buffer here.
  return xdr.ScVal.scvBytes(Buffer.from(bytes));
}

/**
 * Encode a `MerchantQuote` to the exact `ScVal` the backend signed and the
 * contract re-derives. Field order below is irrelevant — `scvSortedMap`
 * re-sorts alphabetically — but is kept aligned with the API for readability.
 */
export function encodeMerchantQuoteScVal(
  quote: MerchantQuoteFields,
): xdr.ScVal {
  const entries = [
    new xdr.ScMapEntry({
      key: sym("ref_id"),
      val: nativeToScVal(quote.refId, { type: "string" }),
    }),
    new xdr.ScMapEntry({
      key: sym("merchant_id"),
      val: nativeToScVal(quote.merchantId, { type: "string" }),
    }),
    new xdr.ScMapEntry({
      key: sym("token"),
      val: new Address(quote.token).toScVal(),
    }),
    new xdr.ScMapEntry({
      key: sym("amount"),
      val: nativeToScVal(quote.amount, { type: "i128" }),
    }),
    new xdr.ScMapEntry({
      key: sym("platform_fee_amount"),
      val: nativeToScVal(quote.platformFeeAmount, { type: "i128" }),
    }),
    new xdr.ScMapEntry({
      key: sym("fiat_amount_minor"),
      val: nativeToScVal(quote.fiatAmountMinor, { type: "u64" }),
    }),
    new xdr.ScMapEntry({
      key: sym("fiat_currency"),
      val: fiatCurrencyToScVal(quote.fiatCurrency),
    }),
    new xdr.ScMapEntry({
      key: sym("exchange_rate_id"),
      val: nativeToScVal(quote.exchangeRateId, { type: "u64" }),
    }),
    new xdr.ScMapEntry({
      key: sym("expires_at"),
      val: nativeToScVal(quote.expiresAt, { type: "u64" }),
    }),
  ];
  return scvSortedMap(entries);
}
