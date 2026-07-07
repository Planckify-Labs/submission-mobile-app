/**
 * Stroops ⇄ decimal-string amount conversion.
 *
 * Every Stellar asset (native XLM AND non-native assets like USDC) uses
 * 7 decimal places of fixed-point precision — 1 XLM = 10,000,000
 * stroops (spec §1.3, §3.8). Horizon's REST API and `Operation.payment`
 * / `Operation.createAccount` both speak decimal strings, not raw
 * integer units, so this module is the one place that bigint stroops
 * get converted to/from that string form — string-based arithmetic
 * throughout so large amounts never round-trip through a floating-point
 * `Number` and lose precision.
 */

const STROOPS_PER_UNIT = 10_000_000n;
const STROOPS_DECIMALS = 7;

/** Converts raw stroops to the decimal-string amount Horizon/SDK operations expect. */
export function formatStroopsAsDecimalString(stroops: bigint): string {
  const negative = stroops < 0n;
  const abs = negative ? -stroops : stroops;
  const whole = abs / STROOPS_PER_UNIT;
  const frac = abs % STROOPS_PER_UNIT;
  const fracStr = frac.toString().padStart(STROOPS_DECIMALS, "0");
  const result = `${whole.toString()}.${fracStr}`;
  return negative ? `-${result}` : result;
}

/** Parses a decimal-string amount (e.g. a Horizon balance) into raw stroops. */
export function parseDecimalStringAsStroops(amount: string): bigint {
  const trimmed = amount.trim();
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [wholeRaw, fracRaw = ""] = unsigned.split(".");
  const whole = wholeRaw === "" ? 0n : BigInt(wholeRaw);
  const fracPadded = `${fracRaw}0000000`.slice(0, STROOPS_DECIMALS);
  const frac = fracPadded === "" ? 0n : BigInt(fracPadded);
  const total = whole * STROOPS_PER_UNIT + frac;
  return negative ? -total : total;
}
