// TWV-2026-052 — IDN-homograph detection. Cyrillic / Greek / mixed-script
// hosts are visually indistinguishable from legitimate dApps and have
// been used repeatedly in Permit2 / setApprovalForAll drainer waves
// (ScamSniffer 2023–2025). The URL bar and signer-UI origin display
// must render the ASCII (punycode) form for any flagged host AND
// surface a "this URL may impersonate another site" banner.

export type HomographWarning = "ok" | "multi-script" | "confusable";

export interface UrlRenderVerdict {
  /** What to show prominently. ASCII form for any flagged host. */
  display: string;
  /** Always ASCII (punycode if needed). */
  ascii: string;
  /** "ok" → render unicode; otherwise render punycode + warning. */
  warning: HomographWarning;
}

// Tiny script classification: Latin / Greek / Cyrillic / Han. We don't
// pull in a 1MB ICU table — these four buckets cover every public
// homograph attack documented to date.
function classifyChar(c: string): "latin" | "greek" | "cyrillic" | "han" | "ascii" | "other" {
  const cp = c.codePointAt(0) ?? 0;
  if (cp <= 0x7f) return "ascii";
  if (cp >= 0x0370 && cp <= 0x03ff) return "greek";
  if (cp >= 0x0400 && cp <= 0x04ff) return "cyrillic";
  if (cp >= 0x4e00 && cp <= 0x9fff) return "han";
  if (
    (cp >= 0x00c0 && cp <= 0x024f) || // Latin Extended
    (cp >= 0x1e00 && cp <= 0x1eff)
  )
    return "latin";
  return "other";
}

const ASCII_CONFUSABLE_LATIN = /[a-z]/i;

function isAscii(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 0x7f) return false;
  }
  return true;
}

/**
 * Convert a host to ASCII via the URL constructor (RFC 3490 IDNA2008
 * via the platform). Returns null if the input is not a parseable URL
 * fragment.
 */
function toAscii(host: string): string | null {
  try {
    const u = new URL(`https://${host}/`);
    return u.hostname;
  } catch {
    return null;
  }
}

/**
 * Extract the raw host string (pre-IDNA normalisation) from a URL.
 * Returns null if the input isn't URL-shaped. We need this because
 * `new URL(...).hostname` punycode-normalises non-ASCII hosts before
 * we can inspect them — destroying the data we need to detect the
 * homograph in the first place.
 */
function extractRawHost(rawUrl: string): string | null {
  const m = rawUrl.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i);
  if (!m) return null;
  // Strip `user:pass@` and `:port`.
  const after = m[1].split("@").pop() ?? "";
  return after.split(":")[0] ?? null;
}

/**
 * Inspect a URL's host. Returns the verdict the URL bar should render.
 *
 * Rules:
 *   - All-ASCII host → ok.
 *   - Host with non-ASCII chars from a single non-Latin script that
 *     is NOT mixed with Latin → "ok" (legit IDN, e.g. Chinese-only).
 *   - Host with chars from > 1 non-ASCII script → "multi-script".
 *   - Host that mixes Latin with a single confusable script
 *     (Cyrillic, Greek) → "confusable" (the homograph case).
 */
export function inspectUrl(rawUrl: string): UrlRenderVerdict {
  const host = extractRawHost(rawUrl);
  if (host == null) {
    return { display: rawUrl, ascii: rawUrl, warning: "ok" };
  }
  if (isAscii(host)) {
    return { display: host, ascii: host, warning: "ok" };
  }
  const ascii = toAscii(host) ?? host;
  const scripts = new Set<string>();
  let hasLatinAscii = false;
  for (const ch of host) {
    const cls = classifyChar(ch);
    if (cls === "ascii") {
      if (ASCII_CONFUSABLE_LATIN.test(ch)) hasLatinAscii = true;
    } else if (cls !== "other") {
      scripts.add(cls);
    }
  }
  if (scripts.size > 1) {
    return { display: ascii, ascii, warning: "multi-script" };
  }
  // Single non-Latin script + Latin-ASCII chars in the same host →
  // confusable. Cyrillic-only domains (no Latin) are legitimate.
  const sole = Array.from(scripts)[0];
  if (
    hasLatinAscii &&
    (sole === "cyrillic" || sole === "greek" || sole === "latin")
  ) {
    return { display: ascii, ascii, warning: "confusable" };
  }
  return { display: host, ascii, warning: "ok" };
}
