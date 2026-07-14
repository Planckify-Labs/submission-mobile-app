/**
 * Allowlist of dapp IDs that live on Stellar, sourced from the seed IDs
 * in `api/src/scripts/prisma/dapps-data.ts` (the `DAPP_SEED` entries
 * whose description names Stellar / Soroban). The `/dapps` API has no
 * per-dapp chain field to filter on server-side, and this is an
 * app-only restriction (per the Stellar-only product decision — see
 * `services/walletKit/chainSupport.ts`), so the allowlist is
 * hard-coded here rather than derived from the API response.
 *
 * `dapp.id` round-trips the seed's `id` verbatim (`seed.ts` upserts on
 * `{ id: d.id }`), so these strings match `TDapp.id` from every
 * `dappApi` endpoint.
 *
 * Keep in sync with `dapps-data.ts` if Stellar dapps are added/removed
 * there — there's no automated link between the two repos.
 */
export const STELLAR_DAPP_IDS: ReadonlySet<string> = new Set([
  // DEX
  "lumenswap-dapp",
  "stellarterm-dapp",
  "soroswap-dapp",
  "phoenix-dapp",
  // DeFi
  "aquarius-dapp",
  "blend-dapp",
  "defindex-dapp",
  "orbit-cdp-dapp",
  // NFT
  "litemint-dapp",
  "stellarnft-dapp",
  // Tools
  "stellarexpert-dapp",
  "allbridge-dapp",
  "stellarbeat-dapp",
  "stellar-lab-dapp",
  "stellarchain-dapp",
]);

export function isStellarDapp(dappId: string): boolean {
  return STELLAR_DAPP_IDS.has(dappId);
}
