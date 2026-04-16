// TWV-2026-003 — Logger/Sentry scrubber.
//
// Three detector predicates guard against the Slope Wallet pattern
// (Sentry SDK with no `beforeSend` scrubber → ≥9.2k wallets drained,
// ~$4.1M). Every future observability sink MUST route payloads through
// `scrubLoggerPayload` before emission. The placeholder string is fixed
// and greppable.

export const REDACTED_SEED_PLACEHOLDER = "[REDACTED_SEED]";

// 12–24 whitespace-separated run where EVERY token is lowercase alpha
// 3–8 chars — tight enough to survive typical log noise (mixed case,
// digits, punctuation) while covering the full BIP-39 word-length
// distribution. `looksLikeBip39Run` is kept as an additional gate in
// case the regex engine ever offers a wider match.
const BIP39_RUN = /\b(?:[a-z]{3,8}\s+){11,23}[a-z]{3,8}\b/g;

// 0x-prefixed private-key shape (exactly 64 hex chars after `0x`).
const HEX_PRIVATE_KEY = /\b0x[a-fA-F0-9]{64}\b/g;

// Solana-shape 32-byte base58 private key. Base58 alphabet (no 0,O,I,l).
// Length of a 32-byte base58 is 43–44 chars; we accept 43–45 to be
// conservative without over-matching normal words.
const BASE58_32_BYTE = /\b[1-9A-HJ-NP-Za-km-z]{43,45}\b/g;

function looksLikeBip39Run(candidate: string): boolean {
  const parts = candidate.trim().split(/\s+/);
  if (parts.length < 12 || parts.length > 24) return false;
  // Every token must be lowercase alpha 3–8 chars (BIP-39 lists are
  // bounded to this range). Guards against matching long log lines.
  return parts.every((w) => /^[a-z]{3,8}$/.test(w));
}

function redactString(s: string): string {
  let out = s;
  out = out.replace(BIP39_RUN, (match) =>
    looksLikeBip39Run(match) ? REDACTED_SEED_PLACEHOLDER : match,
  );
  out = out.replace(HEX_PRIVATE_KEY, REDACTED_SEED_PLACEHOLDER);
  out = out.replace(BASE58_32_BYTE, REDACTED_SEED_PLACEHOLDER);
  return out;
}

const KEY_DENY = /^(mnemonic|seed|seedPhrase|privateKey|pk|recoveryPhrase)$/i;

/**
 * Walk an arbitrary payload and redact any seed-shaped substring /
 * key material. Preserves object/array shape; strings are replaced,
 * numbers/booleans/nulls pass through. Cycles tolerated via a Set.
 */
export function scrubLoggerPayload(
  input: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (input == null) return input;
  if (typeof input === "string") return redactString(input);
  if (typeof input !== "object") return input;
  if (seen.has(input as object)) return "[CYCLE]";
  seen.add(input as object);
  if (Array.isArray(input))
    return input.map((v) => scrubLoggerPayload(v, seen));
  if (input instanceof Error) {
    return {
      name: input.name,
      message: redactString(input.message ?? ""),
      stack: typeof input.stack === "string" ? redactString(input.stack) : "",
    };
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (KEY_DENY.test(k)) {
      out[k] = REDACTED_SEED_PLACEHOLDER;
      continue;
    }
    out[k] = scrubLoggerPayload(v, seen);
  }
  return out;
}

/**
 * Drop-in `beforeSend` / `beforeBreadcrumb` hook. A future Sentry /
 * PostHog integration MUST wire this in. Example:
 *
 *   Sentry.init({
 *     dsn: ...,
 *     beforeSend: scrubSentryEvent,
 *     beforeBreadcrumb: scrubSentryBreadcrumb,
 *   });
 */
export function scrubSentryEvent(event: unknown): unknown {
  return scrubLoggerPayload(event);
}

export function scrubSentryBreadcrumb(breadcrumb: unknown): unknown {
  return scrubLoggerPayload(breadcrumb);
}

function simpleHashHex(input: string): string {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hi = (h2 >>> 0).toString(16).padStart(8, "0");
  const lo = (h1 >>> 0).toString(16).padStart(8, "0");
  return `${hi}${lo}`;
}

function redactMessage(value: unknown): {
  length: number;
  sha256Prefix: string;
} {
  const str = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return { length: str.length, sha256Prefix: simpleHashHex(str).slice(0, 16) };
}

export function redactParams(method: string, params: unknown): unknown {
  if (!params) return params;
  const paramsArr = Array.isArray(params) ? params : [params];

  if (method === "personal_sign") {
    const [message, address] = paramsArr;
    return [redactMessage(message), address];
  }
  if (method === "eth_sign") {
    const [address, message] = paramsArr;
    return [address, redactMessage(message)];
  }
  if (
    method === "eth_signTypedData" ||
    method === "eth_signTypedData_v1" ||
    method === "eth_signTypedData_v3" ||
    method === "eth_signTypedData_v4"
  ) {
    const [address, typedData] = paramsArr;
    return [address, redactMessage(typedData)];
  }
  if (method === "eth_sendTransaction" || method === "eth_signTransaction") {
    const [tx] = paramsArr;
    if (!tx || typeof tx !== "object") return params;
    const t = tx as Record<string, unknown>;
    const data = typeof t.data === "string" ? t.data : undefined;
    const dataPreview =
      data && data.length > 10
        ? `${data.slice(0, 10)}…(${data.length - 10})`
        : data;
    return [
      {
        to: t.to,
        from: t.from,
        value: t.value,
        chainId: t.chainId,
        dataLength: data ? data.length : 0,
        dataSelector: dataPreview,
      },
    ];
  }
  if (method === "solana:signMessage") {
    const [msg] = paramsArr;
    return [redactMessage(msg)];
  }
  return params;
}
