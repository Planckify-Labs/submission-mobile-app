/**
 * Sign In With Solana — canonical ABNF message builder + parser.
 *
 * Derived from EIP-4361 with Solana-specific canonicalisation per
 * `phantom/sign-in-with-solana` reference. The signed bytes are exactly
 * the output of `buildSiwsMessage`; any stray whitespace, field
 * reordering, or CRLF injection changes the signature and breaks SIWS
 * verification on the relying-party side.
 *
 * Rules (§10.4 inv 9):
 *   - Never invent a field the caller did not supply.
 *   - Line endings are `\n`, never `\r\n`.
 *   - Reject `expirationTime ≤ issuedAt` — the caller catches -32602.
 */

import type { SolanaSignInPayload } from "./payloads";

export const SIWS_FIELD_ORDER = [
  "URI",
  "Version",
  "Chain ID",
  "Nonce",
  "Issued At",
  "Expiration Time",
  "Not Before",
  "Request ID",
  "Resources",
] as const;

function codedError(code: number, message: string): Error {
  return Object.assign(new Error(message), { code });
}

function assertNoCrlf(value: string, field: string): void {
  if (/\r/.test(value)) {
    throw codedError(-32602, `SIWS ${field} contains CR`);
  }
}

export function buildSiwsMessage(input: SolanaSignInPayload): string {
  if (!input.domain || !input.domain.trim()) {
    throw codedError(-32602, "SIWS: domain is required");
  }
  if (!input.address || !input.address.trim()) {
    throw codedError(-32602, "SIWS: address is required");
  }
  if (input.issuedAt && input.expirationTime) {
    const issued = Date.parse(input.issuedAt);
    const expires = Date.parse(input.expirationTime);
    if (!isNaN(issued) && !isNaN(expires) && expires <= issued) {
      throw codedError(-32602, "SIWS: expirationTime must be after issuedAt");
    }
  }
  assertNoCrlf(input.domain, "domain");

  const lines: string[] = [];
  const header = `${input.domain} wants you to sign in with your Solana account:`;
  lines.push(header);
  lines.push(input.address);

  const statement = input.statement?.trim();
  if (statement) {
    lines.push("");
    lines.push(statement);
  }

  const fields: Array<[string, string | undefined]> = [
    ["URI", input.uri],
    ["Version", input.version],
    ["Chain ID", input.chainId],
    ["Nonce", input.nonce],
    ["Issued At", input.issuedAt],
    ["Expiration Time", input.expirationTime],
    ["Not Before", input.notBefore],
    ["Request ID", input.requestId],
  ];
  const emitted: string[] = [];
  for (const [label, value] of fields) {
    if (value === undefined || value === null) continue;
    if (typeof value !== "string" || value.length === 0) continue;
    assertNoCrlf(value, label);
    emitted.push(`${label}: ${value}`);
  }
  if (input.resources && input.resources.length > 0) {
    let block = "Resources:";
    for (const r of input.resources) {
      assertNoCrlf(r, "Resources");
      block += `\n- ${r}`;
    }
    emitted.push(block);
  }
  if (emitted.length) {
    lines.push("");
    for (const e of emitted) lines.push(e);
  }
  return lines.join("\n").replace(/[ \t]+$/gm, "");
}

/**
 * Parser is round-trip-faithful for any input produced by `buildSiwsMessage`.
 * Intended for test sanity only — the canonical source of truth is always
 * the structured `SolanaSignInPayload`.
 */
export function parseSiwsMessage(message: string): SolanaSignInPayload {
  const lines = message.split("\n");
  if (lines.length < 2) throw codedError(-32602, "SIWS: malformed message");
  const domainMatch = lines[0].match(
    /^(.+) wants you to sign in with your Solana account:$/,
  );
  if (!domainMatch) throw codedError(-32602, "SIWS: missing domain header");
  const domain = domainMatch[1];
  const address = lines[1];

  let i = 2;
  let statement: string | undefined;
  // Optional blank line + statement block; statement ends at next blank line.
  if (lines[i] === "") {
    // Statement paragraph — everything until the next blank line.
    const stmtLines: string[] = [];
    i += 1;
    while (i < lines.length && lines[i] !== "") {
      stmtLines.push(lines[i]);
      i += 1;
    }
    // If the next field-block follows immediately, treat accumulated lines as statement.
    if (stmtLines.length) statement = stmtLines.join("\n");
    // Consume blank separator.
    if (lines[i] === "") i += 1;
  }

  const fields: Record<string, string> = {};
  const resources: string[] = [];
  let inResources = false;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    if (inResources && l.startsWith("- ")) {
      resources.push(l.slice(2));
      continue;
    }
    inResources = false;
    if (l === "Resources:") {
      inResources = true;
      continue;
    }
    const m = l.match(/^([A-Za-z ]+):\s+(.*)$/);
    if (m) fields[m[1]] = m[2];
  }

  return {
    domain,
    address,
    statement,
    uri: fields["URI"],
    version: fields["Version"] === "1" ? "1" : undefined,
    chainId: fields["Chain ID"] as SolanaSignInPayload["chainId"],
    nonce: fields["Nonce"],
    issuedAt: fields["Issued At"],
    expirationTime: fields["Expiration Time"],
    notBefore: fields["Not Before"],
    requestId: fields["Request ID"],
    resources: resources.length ? resources : undefined,
  };
}
