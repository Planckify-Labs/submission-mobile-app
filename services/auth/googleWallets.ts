import type { TWallet } from "@/constants/types/walletTypes";

/**
 * A Google login owns its own wallet. When a user signs in with a Google
 * account for the first time on a device, the app mints (or restores) a wallet
 * set and tags it as belonging to that account with the helpers here. Signing
 * in with a *different* Google account produces a *different* wallet set — one
 * account, one wallet, regardless of what else is already on the device.
 *
 * **These helpers move identity, never key material.** The mnemonic is still
 * generated on-device by `bootstrapFirstLoginWallets` and lives only in
 * SecureStore; `socialAccount` records who the wallet belongs to (for the badge
 * and the account-scoped login decision in `app/login.tsx`), nothing more. See
 * [[project-google-otp-two-step-auth]] and `googleAccountLink.ts`.
 */
export interface GoogleWalletOwner {
  email?: string;
  name?: string;
}

/**
 * Human label used as the wallet-name prefix, so a device holding several
 * Google accounts' wallets shows which account each belongs to ("Arinda · ETH"
 * vs "Budi · ETH"). Prefers the account's first name, then the email
 * local-part, then a generic "Google".
 */
export function googleWalletPrefix(owner: GoogleWalletOwner): string {
  const fromName = owner.name?.trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const local = owner.email?.split("@")[0]?.trim();
  if (local) return local;
  return "Google";
}

/**
 * Tags a freshly-minted / restored wallet set as belonging to a Google account.
 * Sets `source: "Social"` and records the account on `socialAccount` — the two
 * things the "Google" badge (`walletTypeLabel`) and the login decision tree key
 * off.
 *
 * `type` is deliberately left untouched (it stays `"SeedPhrase"`): these wallets
 * have a real, user-recoverable seed, so every seed-reveal / signing surface
 * that gates on `type === "Social"` (custodial/embedded wallets) must keep
 * treating them as ordinary seed wallets.
 */
export function tagWalletsAsGoogle(
  wallets: TWallet[],
  owner: GoogleWalletOwner,
): TWallet[] {
  return wallets.map((w) => ({
    ...w,
    source: "Social" as const,
    socialAccount: {
      provider: "google",
      email: owner.email ?? "",
      name: owner.name ?? "",
    },
  }));
}
