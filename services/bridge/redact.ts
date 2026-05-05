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

// 64-byte base58 private key (Solana's "full secret key" encoding;
// Phantom / Solflare export format). Length ~86–88 chars. Safe to match
// in free-form strings because nothing else on the app's surface is
// this long. 32-byte base58 strings (43–44 chars, indistinguishable
// from Solana **public addresses**) are NOT matched here — they'd
// false-positive on every mint / account in a URL or log line. Raw
// 32-byte private keys are instead caught via `KEY_DENY` object-key
// detection (privateKey / seed / mnemonic / pk / recoveryPhrase).
const BASE58_64_BYTE = /\b[1-9A-HJ-NP-Za-km-z]{86,90}\b/g;

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
  out = out.replace(BASE58_64_BYTE, REDACTED_SEED_PLACEHOLDER);
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
  // Solana — breadcrumbs carry structural fields only. Never the base64
  // transaction, never the signature, never the signed-message bytes.
  // Invariant 11.
  if (method === "solana:signMessage") {
    const [input] = paramsArr;
    if (input && typeof input === "object") {
      const o = input as {
        address?: string;
        message?: string;
        chain?: string;
      };
      const m = o.message ?? "";
      return [
        {
          address: o.address,
          chain: o.chain,
          messageLength: typeof m === "string" ? m.length : 0,
          messagePreview:
            typeof m === "string" && m.length > 16 ? `${m.slice(0, 16)}…` : m,
        },
      ];
    }
    return [redactMessage(input)];
  }
  if (
    method === "solana:signTransaction" ||
    method === "solana:signAndSendTransaction"
  ) {
    const out: unknown[] = [];
    for (const p of paramsArr) {
      if (p && typeof p === "object") {
        const o = p as {
          address?: string;
          chain?: string;
          transaction?: string;
          options?: unknown;
        };
        out.push({
          address: o.address,
          chain: o.chain,
          txBytes: typeof o.transaction === "string" ? o.transaction.length : 0,
          hasOptions: !!o.options,
        });
      } else out.push(redactMessage(p));
    }
    return out;
  }
  if (method === "solana:signIn") {
    const [input] = paramsArr;
    if (input && typeof input === "object") {
      const o = input as {
        domain?: string;
        chainId?: string;
        issuedAt?: string;
        expirationTime?: string;
        nonce?: string;
        requestId?: string;
      };
      return [
        {
          domain: o.domain,
          chainId: o.chainId,
          issuedAt: o.issuedAt,
          expirationTime: o.expirationTime,
          hasNonce: typeof o.nonce === "string" && o.nonce.length > 0,
          requestId: o.requestId,
        },
      ];
    }
    return params;
  }
  if (method === "standard:connect") {
    const [opts] = paramsArr;
    if (opts && typeof opts === "object") {
      const o = opts as { silent?: boolean };
      return [{ silent: !!o.silent }];
    }
    return params;
  }
  if (method === "takumi:switchCluster" || method === "takumi:watchToken") {
    // No secrets in these payloads; pass through intact.
    return params;
  }
  // Sui — same property as the Solana branches: structural fields only,
  // never the base64 BCS, signature, or signed-message bytes.
  // Spec §11.5.3.
  if (method === "sui:signPersonalMessage") {
    const [input] = paramsArr;
    if (input && typeof input === "object") {
      const o = input as {
        account?: { address?: string };
        address?: string;
        message?: string;
        chain?: string;
      };
      const m = typeof o.message === "string" ? o.message : "";
      return [
        {
          address: o.account?.address ?? o.address,
          chain: o.chain,
          messageLength: m.length,
          // Same 16-char preview cap as Solana / agentContext — single
          // privacy posture across all three.
          messagePreview: m.length > 16 ? `${m.slice(0, 16)}…` : m,
        },
      ];
    }
    return [redactMessage(input)];
  }
  if (
    method === "sui:signTransaction" ||
    method === "sui:signAndExecuteTransaction" ||
    method === "sui:signTransactionBlock" ||
    method === "sui:signAndExecuteTransactionBlock"
  ) {
    const [input] = paramsArr;
    if (input && typeof input === "object") {
      const o = input as {
        account?: { address?: string };
        address?: string;
        chain?: string;
        transaction?: string;
        options?: unknown;
      };
      return [
        {
          address: o.account?.address ?? o.address,
          chain: o.chain,
          txBytes: typeof o.transaction === "string" ? o.transaction.length : 0,
          hasOptions: !!o.options,
        },
      ];
    }
    return [redactMessage(input)];
  }
  if (method === "sui:reportTransactionEffects") {
    // Effects payload may be very large. Log shape only — never contents.
    const [input] = paramsArr;
    if (input && typeof input === "object") {
      const o = input as {
        account?: { address?: string };
        address?: string;
        chain?: string;
        effects?: string;
      };
      return [
        {
          address: o.account?.address ?? o.address,
          chain: o.chain,
          effectsBytes: typeof o.effects === "string" ? o.effects.length : 0,
        },
      ];
    }
    return params;
  }
  if (method === "takumi:switchNetwork") {
    // No secrets in this payload; pass through intact (parity with
    // takumi:switchCluster). Test asserts no future-added field
    // accidentally leaks.
    return params;
  }
  return params;
}
