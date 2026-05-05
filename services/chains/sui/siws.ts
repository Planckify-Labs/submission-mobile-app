/**
 * SIWS (Sign-In-With-Sui) canonical message builder.
 *
 * Spec reference: `docs/sui-dapp-bridge-spec.md` §8.3. EIP-4361-shaped,
 * adapted to "Sui account" wording.
 *
 * The canonical message is the bytes the signer actually signs — the
 * SIWS inspector patches it onto the intent payload so the sheet, the
 * signer, and the agent context all read from a single source of truth.
 */

import type { SuiSignInPayload } from "./payloads";

export class InvalidSiwsInputError extends Error {
  override name = "InvalidSiwsInputError";
}

export function buildSiwsMessage(p: SuiSignInPayload): string {
  if (!p.domain) throw new InvalidSiwsInputError("missing domain");
  if (!p.address) throw new InvalidSiwsInputError("missing address");

  const lines: string[] = [];
  lines.push(`${p.domain} wants you to sign in with your Sui account:`);
  lines.push(p.address);
  lines.push("");
  if (p.statement && p.statement.length > 0) {
    lines.push(p.statement);
    lines.push("");
  }
  if (p.uri) lines.push(`URI: ${p.uri}`);
  lines.push(`Version: ${p.version ?? "1"}`);
  if (p.chainId) lines.push(`Chain: sui:${p.chainId}`);
  if (p.nonce) lines.push(`Nonce: ${p.nonce}`);
  if (p.issuedAt) lines.push(`Issued At: ${p.issuedAt}`);
  if (p.expirationTime) lines.push(`Expiration Time: ${p.expirationTime}`);
  if (p.notBefore) lines.push(`Not Before: ${p.notBefore}`);
  if (p.requestId) lines.push(`Request ID: ${p.requestId}`);
  if (p.resources && p.resources.length > 0) {
    lines.push("Resources:");
    for (const r of p.resources) lines.push(`- ${r}`);
  }
  return lines.join("\n");
}
