/**
 * Delegate (redeemer) address the AI agent / relayer uses to redeem
 * ERC-7710 delegations on the user's behalf (spec Phase 2 §4 "Delegate /
 * Redeemer"; Phase 3 wires the 1Shot relayer that actually broadcasts).
 *
 * OTA-rotatable via `EXPO_PUBLIC_AGENT_DELEGATE_ADDRESS` — same channel
 * as `EXPO_PUBLIC_EIP7702_ALLOWLIST`. Falls back to the public 1Shot
 * relayer delegate documented in `docs/hackathon-research-notes.md`
 * §3.3 so a fresh build still produces a redeemable delegation.
 */

const FALLBACK_DELEGATE =
  "0x4e44e22ee6da76c2ad19baaaffb52f676230fa06" as `0x${string}`;

function normalize(raw: string | undefined): `0x${string}` {
  if (typeof raw !== "string") return FALLBACK_DELEGATE;
  const trimmed = raw.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return trimmed as `0x${string}`;
  return FALLBACK_DELEGATE;
}

export const AGENT_DELEGATE_ADDRESS: `0x${string}` = normalize(
  process.env.EXPO_PUBLIC_AGENT_DELEGATE_ADDRESS,
);
