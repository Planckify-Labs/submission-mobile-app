// TWV-2026-032 — URL sanitiser + external-link confirmation gate.
//
// Every server-supplied string that the wallet renders (agent chat
// output, WalletConnect peer metadata, push notification body, RPC
// error strings) MUST route through this module. Direct calls to
// `Linking.openURL` from agent / push / WalletConnect code are
// forbidden by the §7 non-regression contract.
//
// Threat: Electrum 3.3.3 (~$937k, Dec 2018) rendered RPC error strings
// as rich HTML with clickable malware "update" links. The same shape
// applies to any wallet that auto-links model output / dApp metadata
// without a sanitisation gate.

export interface SanitisedUrl {
  /** The raw URL as supplied. Never feed back into HTML. */
  raw: string;
  /** The host extracted from the URL, lowercased. */
  host: string;
  /** Allowlisted? false → confirmation dialog must show a warning. */
  allowlisted: boolean;
}

/**
 * Domains the wallet trusts enough to render without a warning. Adding
 * a domain requires a PR review — see the §7 non-regression contract.
 *
 * NOTE: explorer hosts already live in
 * `services/chains/evm/explorerAllowlist.ts`. This list intentionally
 * does NOT mirror them — explorer URLs flow through the dApp-supplied
 * path and have their own provenance gate.
 */
export const URL_ALLOWLIST: ReadonlyArray<string> = [
  "takumipay.xyz",
  "docs.takumipay.xyz",
  "anthropic.com",
  "ethereum.org",
];

const FORBIDDEN_PROTOCOLS = new Set([
  "javascript:",
  "data:",
  "vbscript:",
  "file:",
  "about:",
]);

/**
 * Reject any non-http(s) URL outright. Returns null on rejection.
 * Caller must NOT proceed with a `Linking.openURL` if this returns null.
 */
export function sanitiseUrl(raw: string): SanitisedUrl | null {
  if (typeof raw !== "string") return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (FORBIDDEN_PROTOCOLS.has(parsed.protocol)) return null;
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  // Reject URLs whose host is empty (e.g. `https:///foo`).
  if (!parsed.hostname) return null;
  const host = parsed.hostname.toLowerCase();
  return {
    raw,
    host,
    allowlisted: URL_ALLOWLIST.some(
      (a) => host === a || host.endsWith(`.${a}`),
    ),
  };
}

/**
 * Pull URLs out of a free-text model / metadata string. Returns the
 * remaining text and the list of URLs found. The caller should render
 * the remaining text as plain `<Text>` and the URLs as sanitised
 * tokens that route through the confirmation gate on tap.
 */
const URL_RE = /\bhttps?:\/\/[^\s<>"'`]+/gi;

export interface ExtractedUrls {
  text: string;
  urls: SanitisedUrl[];
}

export function extractAndSanitiseUrls(input: string): ExtractedUrls {
  if (typeof input !== "string") return { text: "", urls: [] };
  const urls: SanitisedUrl[] = [];
  const text = input.replace(URL_RE, (match) => {
    const s = sanitiseUrl(match);
    if (s) {
      urls.push(s);
      return `[link:${urls.length - 1}]`;
    }
    return "[blocked-url]";
  });
  return { text, urls };
}
