/**
 * Address poisoning detection.
 * Compares first 4 and last 4 hex characters of addresses.
 * No network calls — runs against local contacts and history.
 */

export interface PoisoningContext {
  contacts: Array<{ address: string; label?: string }>;
  recentCounterparties: Array<{ address: string; label?: string }>;
}

export interface PoisoningResult {
  isPoisoning: boolean;
  similarTo?: { address: string; label?: string };
}

export function checkPoisoning(
  address: string,
  context: PoisoningContext,
): PoisoningResult {
  const lower = address.toLowerCase();
  const first4 = lower.slice(2, 6);
  const last4 = lower.slice(-4);

  const allKnown = [...context.contacts, ...context.recentCounterparties];

  for (const known of allKnown) {
    const knownLower = known.address.toLowerCase();

    // Skip exact matches
    if (knownLower === lower) continue;

    const knownFirst4 = knownLower.slice(2, 6);
    const knownLast4 = knownLower.slice(-4);

    // Both first 4 AND last 4 must match for a flag
    if (first4 === knownFirst4 && last4 === knownLast4) {
      return {
        isPoisoning: true,
        similarTo: { address: known.address, label: known.label },
      };
    }
  }

  return { isPoisoning: false };
}

/**
 * TWV-2026-022 — clipboard-swap detection. Laplas-style clippers swap
 * the copied address for an attacker-owned lookalike that shares the
 * prefix and suffix the user normally eyeballs. We extend the existing
 * checker with a Hamming-distance probe over the middle 32 hex chars:
 * a low distance combined with matching prefix + suffix is the
 * characteristic signature.
 *
 * Threshold is 1 ≤ distance ≤ 4 — anything below 1 is the address
 * itself, anything above 4 is too far to plausibly be a lookalike.
 */
export interface ClipboardSwapResult {
  isSwap: boolean;
  similarTo?: { address: string; label?: string };
  /** Hamming distance over the middle 32 hex chars. */
  distance?: number;
}

const CLIPPER_DISTANCE_THRESHOLD = 4;

function middleHex(addressLower: string): string {
  const body = addressLower.slice(2);
  return body.slice(4, body.length - 4);
}

function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Math.max(a.length, b.length);
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    if (a.charCodeAt(i) !== b.charCodeAt(i)) d++;
  }
  return d;
}

export function detectClipboardSwap(
  pastedAddress: string,
  context: PoisoningContext,
): ClipboardSwapResult {
  if (
    typeof pastedAddress !== "string" ||
    !/^0x[0-9a-f]{40}$/i.test(pastedAddress)
  ) {
    return { isSwap: false };
  }
  const lower = pastedAddress.toLowerCase();
  const pastedMiddle = middleHex(lower);
  const pastedFirst4 = lower.slice(2, 6);
  const pastedLast4 = lower.slice(-4);
  const allKnown = [...context.contacts, ...context.recentCounterparties];

  for (const known of allKnown) {
    const knownLower = known.address.toLowerCase();
    if (knownLower === lower) continue;
    if (!/^0x[0-9a-f]{40}$/i.test(knownLower)) continue;
    if (
      knownLower.slice(2, 6) !== pastedFirst4 ||
      knownLower.slice(-4) !== pastedLast4
    ) {
      continue;
    }
    const d = hammingDistance(pastedMiddle, middleHex(knownLower));
    if (d > 0 && d <= CLIPPER_DISTANCE_THRESHOLD) {
      return {
        isSwap: true,
        similarTo: { address: known.address, label: known.label },
        distance: d,
      };
    }
  }
  return { isSwap: false };
}

/**
 * TWV-2026-022 — render an address as `0x1234·5678…abcd·9012` — first
 * 4, an inner 4-char window the user can eyeball, then the conventional
 * suffix. Attacker vanity generators that match prefix + suffix only
 * cannot also hit the inner window cheaply.
 */
export function formatAddressMiddleWindow(address: string): string {
  if (!/^0x[0-9a-f]{40}$/i.test(address)) return address;
  const lower = address.toLowerCase();
  const first4 = lower.slice(2, 6);
  const mid4 = lower.slice(6, 10);
  const tailMid4 = lower.slice(-12, -8);
  const last4 = lower.slice(-4);
  return `0x${first4}·${mid4}…${tailMid4}·${last4}`;
}

export function getPoisoningExplanation(result: PoisoningResult): string {
  if (!result.isPoisoning || !result.similarTo) return "";

  const label = result.similarTo.label ?? "a known address";
  return (
    `This address looks similar to ${label} but is a different address. ` +
    "Scammers sometimes create lookalike addresses to trick you into " +
    "sending funds to the wrong place. Please verify the full address carefully."
  );
}
