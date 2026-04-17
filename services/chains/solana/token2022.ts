/**
 * Token-2022 mint extension inspector per §10.4 inv 8.
 *
 * Parses the `Mint` account's extension TLV block and emits the list of
 * extensions with severity tags so the sheet can annotate transfers /
 * watchToken / ATA-create flows with accurate risk labels.
 */

export type Token2022ExtensionKind =
  | "TransferFeeConfig"
  | "PermanentDelegate"
  | "ConfidentialTransferMint"
  | "NonTransferable"
  | "InterestBearingConfig"
  | "MintCloseAuthority"
  | "DefaultAccountState"
  | "ImmutableOwner"
  | "MemoTransfer"
  | "CpiGuard"
  | "TransferHook"
  | "MetadataPointer"
  | "TokenMetadata"
  | "GroupPointer"
  | "GroupMemberPointer";

export interface Token2022Extension {
  kind: Token2022ExtensionKind | string;
  /** Raw type discriminant from the TLV header. */
  code: number;
  severity: "info" | "warn" | "danger";
  detail?: string;
  data?: Record<string, unknown>;
}

// Extension-type discriminants per SPL Token-2022 spec. The first few
// are the ones worth calling out for user-visible risk; anything else
// surfaces as `info` so the user sees it but isn't alarmed.
const EXTENSION_META: Record<
  number,
  {
    kind: Token2022ExtensionKind;
    severity: Token2022Extension["severity"];
    detail: string;
  }
> = {
  1: {
    kind: "TransferFeeConfig",
    severity: "warn",
    detail: "Mint charges a transfer fee on every movement.",
  },
  3: {
    kind: "ConfidentialTransferMint",
    severity: "warn",
    detail:
      "Mint supports confidential transfers (pending balances may be hidden).",
  },
  7: {
    kind: "PermanentDelegate",
    severity: "danger",
    detail:
      "Mint designates a permanent delegate that can move tokens from any account.",
  },
  9: {
    kind: "NonTransferable",
    severity: "warn",
    detail: "Mint is marked non-transferable after issuance.",
  },
  13: {
    kind: "InterestBearingConfig",
    severity: "info",
    detail: "Mint accrues interest; displayed balances may drift over time.",
  },
  5: {
    kind: "MintCloseAuthority",
    severity: "info",
    detail: "Mint may be closed by its close authority.",
  },
  14: {
    kind: "MemoTransfer",
    severity: "info",
    detail: "Recipient requires a memo on every transfer.",
  },
  16: {
    kind: "CpiGuard",
    severity: "info",
    detail:
      "CPI guard enabled — constrains what other programs can do with the account.",
  },
  17: {
    kind: "TransferHook",
    severity: "warn",
    detail:
      "Mint registers a transfer-hook program — custom logic runs on every transfer.",
  },
  19: {
    kind: "MetadataPointer",
    severity: "info",
    detail: "Metadata pointer extension present.",
  },
  21: {
    kind: "TokenMetadata",
    severity: "info",
    detail: "Inline token metadata present.",
  },
};

/**
 * Parse the extension TLV block starting at offset 165 (post-mint base).
 * The input is the raw mint account data; bytes before 165 are the
 * standard mint fields (mintAuthority, supply, decimals, isInitialized,
 * freezeAuthority) that every SPL token shares.
 */
export function parseToken2022Extensions(
  data: Uint8Array,
): Token2022Extension[] {
  const extensions: Token2022Extension[] = [];
  let i = 165;
  while (i + 4 <= data.length) {
    const code = (data[i] ?? 0) | ((data[i + 1] ?? 0) << 8);
    const length = (data[i + 2] ?? 0) | ((data[i + 3] ?? 0) << 8);
    i += 4;
    if (length <= 0) break;
    if (i + length > data.length) break;
    const meta = EXTENSION_META[code];
    if (meta) {
      extensions.push({
        kind: meta.kind,
        code,
        severity: meta.severity,
        detail: meta.detail,
      });
    } else {
      extensions.push({
        kind: `unknown:${code}`,
        code,
        severity: "info",
      });
    }
    i += length;
  }
  return extensions;
}

export function summariseToken2022(extensions: Token2022Extension[]): {
  maxSeverity: Token2022Extension["severity"];
  names: string[];
} {
  const rank: Record<Token2022Extension["severity"], number> = {
    info: 0,
    warn: 1,
    danger: 2,
  };
  let max: Token2022Extension["severity"] = "info";
  for (const e of extensions) {
    if (rank[e.severity] > rank[max]) max = e.severity;
  }
  return { maxSeverity: max, names: extensions.map((e) => String(e.kind)) };
}
