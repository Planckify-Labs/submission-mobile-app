/**
 * `parseX402Erc7710Challenge` — reads a `402 Payment Required` response
 * into the normalised `X402Erc7710Challenge` shape for the delegation
 * settlement rail (spec Phase 5 §5.4).
 *
 * Provider-neutral and SDK-free (Node-unit-testable). It reuses the same
 * `accepts[]` parsing conventions and tolerance as the user-facing
 * EIP-3009 flow in `services/nanopay/pathCRawX402.ts` — JSON body primary,
 * header fallback, first understood entry wins — but discriminates on
 * `extra.assetTransferMethod === "erc7710"` so the two stay in lockstep
 * while picking different settlement paths (§4.4).
 *
 * Never throws raw response bodies: a malformed / unrecognised challenge
 * resolves to `null` and the caller maps it to friendly copy (SI-6).
 */

import type { X402Erc7710Challenge } from "../walletKit/types.ts";

/**
 * Parse a 402 response into an `X402Erc7710Challenge`, or `null` when the
 * response carries no recognisable ERC-7710 "exact" challenge. The caller
 * (`agentX402Client`) decides the friendly failure copy.
 */
export async function parseX402Erc7710Challenge(
  response: Response,
  resourceUrl: string,
): Promise<X402Erc7710Challenge | null> {
  // Primary: x402 v1 JSON body with `accepts[]` (CDP / a16p / MetaMask
  // seller middleware). First entry whose scheme + transfer method we
  // understand wins — the x402 preference-order convention.
  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    body = null;
  }

  if (body && typeof body === "object") {
    const accepts = (body as Record<string, unknown>).accepts;
    if (Array.isArray(accepts)) {
      for (const entry of accepts) {
        const parsed = tryParseAcceptEntry(entry, resourceUrl);
        if (parsed) return parsed;
      }
    }
  }

  // Fallback: header-only compact form (older / minimal sellers).
  const headerBlob =
    response.headers.get("payment-required") ??
    response.headers.get("x-payment-requirements") ??
    response.headers.get("x402-payment-required");
  if (headerBlob) {
    try {
      const parsed = tryParseAcceptEntry(JSON.parse(headerBlob), resourceUrl);
      if (parsed) return parsed;
    } catch {
      // fall through to null
    }
  }

  return null;
}

/**
 * Validate + normalise a single `accepts[]` entry. Returns `null` (never
 * throws) unless it is a complete `scheme: "exact"` /
 * `assetTransferMethod: "erc7710"` entry.
 */
export function tryParseAcceptEntry(
  entry: unknown,
  resourceUrl: string,
): X402Erc7710Challenge | null {
  if (!entry || typeof entry !== "object") return null;
  const e = entry as Record<string, unknown>;

  if (e.scheme !== "exact") return null;

  // `assetTransferMethod` may sit on `extra` (seller config) or at the
  // top level (some middlewares hoist it). Accept either.
  const extraRaw = e.extra && typeof e.extra === "object" ? e.extra : null;
  const extra = extraRaw as Record<string, unknown> | null;
  const transferMethod =
    extra && typeof extra.assetTransferMethod === "string"
      ? extra.assetTransferMethod
      : typeof e.assetTransferMethod === "string"
        ? e.assetTransferMethod
        : null;
  if (transferMethod !== "erc7710") return null;

  const network = typeof e.network === "string" ? e.network : null;
  const payTo = typeof e.payTo === "string" ? e.payTo : null;
  const asset = typeof e.asset === "string" ? e.asset : null;
  const maxAmountRequired =
    typeof e.maxAmountRequired === "string"
      ? e.maxAmountRequired
      : typeof e.maxAmountRequired === "number"
        ? String(e.maxAmountRequired)
        : null;

  if (
    !network ||
    !payTo ||
    !payTo.startsWith("0x") ||
    !asset ||
    !asset.startsWith("0x") ||
    !maxAmountRequired
  ) {
    return null;
  }

  // `facilitator` may be a top-level field or inside `extra`.
  const facilitator =
    typeof e.facilitator === "string"
      ? e.facilitator
      : extra && typeof extra.facilitator === "string"
        ? extra.facilitator
        : null;
  const maxTimeoutSeconds =
    typeof e.maxTimeoutSeconds === "number" ? e.maxTimeoutSeconds : undefined;
  const resource =
    typeof e.resource === "string" && e.resource.length > 0
      ? e.resource
      : resourceUrl;

  return {
    scheme: "exact",
    network,
    maxAmountRequired,
    payTo: payTo as `0x${string}`,
    asset: asset as `0x${string}`,
    resource,
    facilitator,
    assetTransferMethod: "erc7710",
    maxTimeoutSeconds,
  };
}
