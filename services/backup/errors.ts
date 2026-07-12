/**
 * Curated failure codes for the seed-backup surfaces. UI switches on `code`
 * and renders its own fixed copy; no Drive response body, HTTP status, or SDK
 * error string ever reaches a user (CLAUDE.md, user-facing errors).
 */
export type TBackupErrorCode =
  /** Drive unreachable or the access token expired. */
  | "backup_unavailable"
  /**
   * The Drive `appdata` scope isn't granted — the user unchecked the optional
   * permission at sign-in, or dismissed the re-consent prompt. Distinct from
   * `backup_unavailable` so the UI can ask for access rather than blame the
   * network, and so login can treat it as "no Drive backup" instead of failing.
   */
  | "drive_permission_denied"
  /**
   * The wallet belongs to a different Google account than the one signed in,
   * and the user didn't switch to it — its backup must live in its *own*
   * account's Drive, not whichever account happens to be active.
   */
  | "wrong_google_account"
  /** GCM tag mismatch — wrong passphrase, or the blob was tampered with. */
  | "passphrase_rejected"
  /** No blob in appDataFolder for this Google account. */
  | "backup_missing"
  /** Blob present but fails schema, base64, or the KDF floor. */
  | "backup_corrupt"
  /** Wallet has no mnemonic to back up (e.g. imported from a private key). */
  | "no_mnemonic"
  | "unknown";

export class BackupError extends Error {
  readonly code: TBackupErrorCode;
  constructor(code: TBackupErrorCode) {
    super(code);
    this.name = "BackupError";
    this.code = code;
  }
}

/** Fixed, hand-written copy. Never interpolates anything from a response. */
export const BACKUP_ERROR_COPY: Record<TBackupErrorCode, string> = {
  backup_unavailable:
    "We couldn't reach your Google Drive. Check your connection and try again.",
  drive_permission_denied:
    "TakumiPay needs permission to use Google Drive for your backup. Please allow Drive access and try again.",
  wrong_google_account:
    "This wallet belongs to a different Google account. Sign in with that account to back it up.",
  passphrase_rejected: "That passphrase didn't work. Please try again.",
  backup_missing: "No backup was found for this Google account.",
  backup_corrupt:
    "This backup couldn't be read. Restore with your seed phrase instead.",
  no_mnemonic:
    "This wallet was imported from a private key, so it has no seed phrase to back up.",
  unknown: "Something went wrong. Please try again.",
};

export const devWarn = (label: string, error: unknown) => {
  if (__DEV__) console.warn(label, error);
};
