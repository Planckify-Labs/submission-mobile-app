// TWV-2026-024 — Universal/App Link gate. Custom URL schemes
// (`takumiwallet://`) are NOT exclusively registrable; only verified
// HTTPS App Links / Universal Links are. Sensitive deeplinks (send,
// sign, WalletConnect pair, chain add) MUST resolve via HTTPS;
// custom-scheme deeplinks for these targets fall through to a
// preview screen with an explicit warning, never auto-execute.

export const VERIFIED_HOST = "takumipay.xyz";

const SENSITIVE_PATHS = new Set<string>([
  "/send",
  "/sign",
  "/wc",
  "/add-chain",
]);

const FRAGMENT_DENY = /(seed|mnemonic|privatekey|pk|signature)/i;

export type DeeplinkVerdict =
  | { ok: true; preview: true; route: string; reason?: string }
  | {
      ok: false;
      code: "non_https" | "wrong_host" | "fragment_blocked" | "malformed";
      reason: string;
    };

/**
 * Inspect an incoming deeplink. Returns a verdict the deeplink
 * router uses to either route to a preview screen (preview: true) or
 * reject outright. NEVER returns an "auto-execute" verdict — the
 * preview is mandatory for sensitive paths.
 */
export function inspectDeeplink(rawUrl: string): DeeplinkVerdict {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, code: "malformed", reason: "URL parse failed" };
  }
  // Fragment denylist — refuse anything that smells like seed material
  // in the URL fragment / query string.
  if (FRAGMENT_DENY.test(parsed.hash) || FRAGMENT_DENY.test(parsed.search)) {
    return {
      ok: false,
      code: "fragment_blocked",
      reason: "URL fragment contains seed-shaped material",
    };
  }
  // Custom-scheme deeplinks for sensitive paths are NEVER auto-executed.
  // They route to the preview screen with a warning that this is not
  // an exclusively-verified entry point.
  if (parsed.protocol !== "https:") {
    if (SENSITIVE_PATHS.has(parsed.pathname)) {
      return {
        ok: true,
        preview: true,
        route: parsed.pathname + parsed.search,
        reason:
          "Sensitive route opened via non-verified scheme — preview required.",
      };
    }
    return {
      ok: true,
      preview: true,
      route: parsed.pathname,
    };
  }
  // HTTPS — verify the host matches our App-Links-verified host.
  if (parsed.hostname.toLowerCase() !== VERIFIED_HOST) {
    return {
      ok: false,
      code: "wrong_host",
      reason: `host ${parsed.hostname} is not the App-Links-verified host`,
    };
  }
  return {
    ok: true,
    preview: true,
    route: parsed.pathname + parsed.search,
  };
}
