/**
 * TS mirrors of the `takumi_pay` Soroban contract structs used by the
 * merchant-payment settlement path
 * (`../../../../contract/stellar/contracts/takumi_pay/src/types.rs`).
 *
 * Only the payer-submit surface lives here — `MerchantQuote`
 * (`process_merchant_payment`'s backend-signed argument). Reads
 * (`get_merchant_payment`) are the backend's job, not the wallet's, so their
 * record structs are intentionally not mirrored on the mobile side.
 *
 * Numeric fields are `bigint` (u64 / i128 on-chain). On the wire the intent
 * carries them as decimal strings (`QuoteCommitmentStellar` in
 * `services/nanopay/types.ts`) to keep bigint semantics over JSON; callers
 * parse to `bigint` before handing a `MerchantQuoteFields` to the encoder.
 */

export interface MerchantQuoteFields {
  refId: string;
  merchantId: string;
  /**
   * SAC contract id (`C…`) of the payment token — NOT the classic
   * `"{CODE}:{ISSUER}"` compound string stored on the `Token` row. The
   * backend derives + emits the SAC id in the quote commitment.
   */
  token: string;
  amount: bigint;
  platformFeeAmount: bigint;
  fiatAmountMinor: bigint;
  /** 3-char ISO-4217 currency (e.g. `"IDR"`); encoded as the contract's `BytesN<3>`. */
  fiatCurrency: string;
  exchangeRateId: bigint;
  expiresAt: bigint;
}
