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

export function getPoisoningExplanation(result: PoisoningResult): string {
  if (!result.isPoisoning || !result.similarTo) return "";

  const label = result.similarTo.label ?? "a known address";
  return (
    `This address looks similar to ${label} but is a different address. ` +
    "Scammers sometimes create lookalike addresses to trick you into " +
    "sending funds to the wrong place. Please verify the full address carefully."
  );
}
