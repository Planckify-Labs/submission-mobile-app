/**
 * SNS (`.sol`) domain resolver — advisory layer for §10.4 inv 22.
 *
 * Resolution is *advisory*: the decoded transaction always signs
 * against a resolved base58 address. Nothing here constructs a tx
 * from a domain string; the sheet just shows the domain label
 * alongside the canonical address so the user can verify intent.
 *
 * P1c ships the predicate + homograph detection; on-chain lookup via
 * Bonfida's registry account is a follow-up once `@solana-program/name-service`
 * is vetted for React Native bundle size. Until then, `resolveSnsDomain`
 * returns `null` and the sheet shows raw base58 only.
 */

import type { Rpc, SolanaRpcApi } from "@solana/kit";

const SNS_RE = /^[a-z0-9][a-z0-9-]{0,61}\.sol$/i;

export function isSnsDomain(value: string): boolean {
  return SNS_RE.test(value);
}

/**
 * Detect homograph / mixed-script labels. Returns true if the
 * domain contains characters outside basic ASCII — those are
 * renderable but visually ambiguous (Cyrillic lookalikes,
 * combining marks, etc.). Caller surfaces a `warn` annotation.
 */
export function hasMixedScript(value: string): boolean {
  // Any code unit outside the printable ASCII range is suspect
  // for a `.sol` label intended as a-z / 0-9 / '-'.
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c > 0x7f) return true;
  }
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function resolveSnsDomain(
  name: string,
  _rpc: Rpc<SolanaRpcApi>,
): Promise<string | null> {
  if (!isSnsDomain(name)) return null;
  // TODO(solana-adapter-spec §10.4 inv 22): wire Bonfida on-chain lookup
  // once `@solana-program/name-service` is vetted for the RN bundle.
  // Sheet renders `null` as "unresolved" — never invents an address.
  return null;
}

export interface SnsAnnotation {
  code: "sns.mixed-script" | "sns.unresolved";
  severity: "warn" | "info";
  title: string;
  detail: string;
  source: "local";
}

export function buildSnsAnnotations(domain: string): SnsAnnotation[] {
  const out: SnsAnnotation[] = [];
  if (hasMixedScript(domain)) {
    out.push({
      code: "sns.mixed-script",
      severity: "warn",
      title: "Domain contains non-ASCII characters",
      detail: `Verify the destination address — ${domain} may be a homograph.`,
      source: "local",
    });
  }
  return out;
}
