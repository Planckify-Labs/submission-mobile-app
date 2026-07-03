import type { Namespace } from "@/services/chains/types";
import type {
  DefiProtocolAdapter,
  DepositTarget,
  DepositTargetKind,
} from "./types";

const adapters = new Map<string, DefiProtocolAdapter>();

export function registerDefiAdapter(a: DefiProtocolAdapter): void {
  adapters.set(a.slug, a);
}

export function getDefiAdapter(slug: string): DefiProtocolAdapter | null {
  const direct = adapters.get(slug);
  if (direct) return direct;
  // Fall back to a case-insensitive match on the canonical slug or any
  // `externalSlugs` alias (e.g. the DeFiLlama project slug a discovered
  // opportunity carries). Keeps the mapping co-located with each adapter
  // instead of a central per-protocol switch.
  const needle = slug.toLowerCase();
  for (const a of adapters.values()) {
    if (a.slug.toLowerCase() === needle) return a;
    if ((a.externalSlugs ?? []).some((s) => s.toLowerCase() === needle)) {
      return a;
    }
  }
  return null;
}

export function listDefiAdapters(): DefiProtocolAdapter[] {
  return [...adapters.values()];
}

/**
 * Resolve the adapter for a `DepositTarget.kind` (pool-level deposits §7).
 * This is the standard-family dispatch: one resolved target routes to exactly
 * one adapter by its `kind`, so a single `Erc4626Adapter` serves every
 * Morpho/Yearn/Euler vault the resolver returns. Adding a `kind` is a new
 * adapter that declares `targetKinds` — never a branch in shared code.
 */
export function getDefiAdapterForKind(
  kind: DepositTargetKind,
): DefiProtocolAdapter | null {
  for (const a of adapters.values()) {
    if ((a.targetKinds ?? []).includes(kind)) return a;
  }
  return null;
}

/**
 * Pick the adapter for a resolved deposit: prefer the `kind`-based
 * standard-family lookup (so all sibling vaults route to the generic family
 * adapter), and fall back to the per-slug lookup for bespoke venues that have
 * no `depositTarget` kind (single-market adapters, non-standard logic).
 */
export function getDefiAdapterForTarget(
  slug: string,
  target?: DepositTarget | null,
): DefiProtocolAdapter | null {
  if (target) {
    const byKind = getDefiAdapterForKind(target.kind);
    if (byKind) return byKind;
  }
  return getDefiAdapter(slug);
}

export function listDefiAdaptersForChain(
  namespace: Namespace,
  chainId: number | string,
): DefiProtocolAdapter[] {
  return [...adapters.values()].filter(
    (a) => a.namespace === namespace && a.chainId === chainId,
  );
}

/**
 * Pick a lending/yield venue from a pre-narrowed candidate set (e.g. the
 * output of `listDefiAdaptersForChain("sui", network)`).
 *
 * `venue` may be the adapter's canonical slug, any of its `externalSlugs`
 * (the catalog/DeFiLlama project slug), or a substring of its display name —
 * all matched case-insensitively. When `venue` is omitted, the sole
 * registered candidate is returned (the unambiguous single-venue
 * convenience); with zero or several candidates and no `venue`, returns
 * null so the caller can ask the user to disambiguate. This is the
 * protocol-agnostic resolver the Sui Intent compiler uses instead of a
 * hardcoded slug — adding a venue is a registration, never a new branch.
 */
export function pickVenueAdapter(
  candidates: DefiProtocolAdapter[],
  venue?: string,
): DefiProtocolAdapter | null {
  if (!venue) return candidates.length === 1 ? candidates[0] : null;
  const needle = venue.toLowerCase();
  return (
    candidates.find((a) => a.slug.toLowerCase() === needle) ??
    candidates.find((a) =>
      (a.externalSlugs ?? []).some((s) => s.toLowerCase() === needle),
    ) ??
    // Last-resort fuzzy match in BOTH directions so a catalog slug like
    // "scallop-lend" still resolves to the "Scallop" adapter even if its
    // externalSlugs list drifts from DeFiLlama's naming.
    candidates.find((a) => {
      const name = a.displayName.toLowerCase();
      return name.includes(needle) || needle.includes(name);
    }) ??
    null
  );
}
