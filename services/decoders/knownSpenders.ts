// TWV-2026-008 — curated known-safe spender allowlist. A `Permit` /
// `Permit2` approval for an address NOT on this list is a red-banner
// warning in the signer UI. The wallet does NOT block the signature
// (§7 signable-tx parity) — the user can proceed, but only after an
// explicit acknowledgement.
//
// Addresses are lowercased at runtime; lookup is case-insensitive.
// Every entry should name the contract + chain so a reviewer can verify
// the deployment source. When extending this list, require a second
// reviewer per the spec §9 "Signatures" row.

export interface KnownSpender {
  address: `0x${string}`;
  name: string;
  chainIds: number[];
}

export const KNOWN_SPENDERS: ReadonlyArray<KnownSpender> = [
  // Uniswap Universal Router v2 (widely deployed; per-chain deployments).
  {
    address: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD",
    name: "Uniswap Universal Router",
    chainIds: [1],
  },
  {
    address: "0x5E325eDA8064b456f4781070C0738d849c824258",
    name: "Uniswap Universal Router",
    chainIds: [10],
  },
  {
    address: "0x643770E279d5D0733F21d6DC03A8efbABf3255B4",
    name: "Uniswap Universal Router",
    chainIds: [137],
  },
  {
    address: "0x6fF5693b99212Da76ad316178A184AB56D299b43",
    name: "Uniswap Universal Router",
    chainIds: [8453],
  },
  {
    address: "0xb555edF5dcF85f42cEeF1f3630a52A108E55A654",
    name: "Uniswap Universal Router",
    chainIds: [42161],
  },

  // Permit2 itself is canonical across chains.
  {
    address: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    name: "Permit2",
    chainIds: [1, 10, 137, 8453, 42161],
  },

  // 1inch v6 router.
  {
    address: "0x111111125421cA6dc452d289314280a0f8842A65",
    name: "1inch v6 Router",
    chainIds: [1, 10, 137, 8453, 42161],
  },

  // CoW Protocol GPv2VaultRelayer.
  {
    address: "0xC92E8bdf79f0507f65a392b0ab4667716BFE0110",
    name: "CoW VaultRelayer",
    chainIds: [1],
  },
];

const ALLOW = new Set(
  KNOWN_SPENDERS.map(
    (s) => `${s.chainIds.join(",")}:${s.address.toLowerCase()}`,
  ),
);

const ADDR_ONLY = new Set(KNOWN_SPENDERS.map((s) => s.address.toLowerCase()));

export function isKnownSpender(
  address: string,
  chainId?: number,
): KnownSpender | null {
  const a = address.toLowerCase();
  if (chainId !== undefined) {
    // Exact match on (chainId, address) first.
    for (const s of KNOWN_SPENDERS) {
      if (s.address.toLowerCase() === a && s.chainIds.includes(chainId)) {
        return s;
      }
    }
    return null;
  }
  // Fallback when chainId unknown — match on address only.
  if (!ADDR_ONLY.has(a)) return null;
  return KNOWN_SPENDERS.find((s) => s.address.toLowerCase() === a) ?? null;
}
