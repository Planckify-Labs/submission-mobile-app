import { storage } from "@/lib/storage/mmkv";

/**
 * Records which Google account a locally-held wallet was created under.
 *
 * **This stores identity, never key material.** The mnemonic is generated on
 * device by `bootstrapFirstLoginWallets` and lives only in SecureStore; it is
 * never written here, never sent to the API, and never uploaded anywhere.
 * TakumiPay cannot recover a user's wallet — losing the device and the
 * written-down seed phrase means losing the funds. Anything else would make
 * the wallet custodial, which `docs/wallet-security-vulnerabilities-spec.md`
 * (TWV-2026-003, Critical) rules out.
 *
 * The link exists so the app can label a wallet with the account that made it
 * and recognise a returning user on the same device. On a fresh device, the
 * user restores by entering the seed phrase they backed up themselves.
 */
export interface GoogleAccountLink {
  /** Server user id from the Google session. */
  userId: string;
  email?: string;
  name?: string;
  linkedAt: number;
}

const KEY_PREFIX = "google_account_link_";

const keyFor = (walletAddress: string) =>
  `${KEY_PREFIX}${walletAddress.toLowerCase()}`;

export function linkGoogleAccountToWallet(
  walletAddress: string,
  account: Omit<GoogleAccountLink, "linkedAt">,
): void {
  const link: GoogleAccountLink = { ...account, linkedAt: Date.now() };
  storage.set(keyFor(walletAddress), JSON.stringify(link));
}

export function getGoogleAccountForWallet(
  walletAddress: string,
): GoogleAccountLink | null {
  const raw = storage.getString(keyFor(walletAddress));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GoogleAccountLink;
  } catch {
    return null;
  }
}

export function unlinkGoogleAccountFromWallet(walletAddress: string): void {
  storage.remove(keyFor(walletAddress));
}
