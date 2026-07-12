/**
 * Orchestration for the encrypted seed backup: SecureStore -> Argon2id +
 * AES-GCM -> the user's Drive appDataFolder, and back.
 *
 * The passphrase is a parameter, never a field. It is not persisted anywhere —
 * not SecureStore, not MMKV — and the caller drops its reference as soon as
 * these functions return. See `docs/encrypted-seed-backup-spec.md`.
 */
import { storage } from "@/lib/storage/mmkv";
import {
  deleteBackup,
  downloadBackup,
  findBackupFile,
  uploadBackup,
} from "./driveAppData";
import { BackupError, devWarn } from "./errors";
import {
  CorruptBackupError,
  decryptMnemonic,
  encryptMnemonic,
  isSeedBackupBlobV1,
  WrongPassphraseError,
} from "./seedBackupCrypto";

/**
 * Timestamp of the last successful upload. A *hint* for the wallet screen, not
 * proof — the user can delete the Drive data without the app knowing. Anything
 * that must be certain calls `hasRemoteBackup()`.
 */
const BACKUP_AT_KEY = "seed_backup_at";

const backupAtKeyFor = (walletAddress: string) =>
  `${BACKUP_AT_KEY}_${walletAddress.toLowerCase()}`;

export function getLocalBackupTimestamp(walletAddress: string): number | null {
  const raw = storage.getString(backupAtKeyFor(walletAddress));
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function setLocalBackupTimestamp(walletAddress: string, at: number): void {
  storage.set(backupAtKeyFor(walletAddress), String(at));
}

function clearLocalBackupTimestamp(walletAddress: string): void {
  storage.remove(backupAtKeyFor(walletAddress));
}

/**
 * Record that `walletAddress` has a Drive backup as of `at` (epoch ms). The
 * mmkv hint is otherwise only written when a backup is *created on this device*,
 * so a fresh device that just *restored* from Drive would show "not backed up".
 * Restore calls this with the backup's real `createdAt` so the wallet screen
 * reflects the existing backup — its true date, and the "manage" (change /
 * remove) sheet — instead of offering to create one over the top of it.
 */
export function recordBackupTimestamp(walletAddress: string, at: number): void {
  if (walletAddress) setLocalBackupTimestamp(walletAddress, at);
}

/** Drop the local backup hint for `walletAddress` (e.g. after a removal). */
export function clearBackupTimestamp(walletAddress: string): void {
  if (walletAddress) clearLocalBackupTimestamp(walletAddress);
}

/**
 * Interactive backup check — requests Drive access (`findBackupFile(true)`) so
 * it can answer definitively even on a device that hasn't granted the scope
 * yet. Use this to confirm a backup exists *before* asking for a passphrase, so
 * the user never types one for a backup that isn't there. `ownerEmail` scopes
 * it to a specific account's Drive; omit for the currently signed-in one.
 */
export async function hasRemoteBackupInteractive(
  ownerEmail?: string,
): Promise<boolean> {
  try {
    return (await findBackupFile(true, ownerEmail)) !== null;
  } catch (error) {
    devWarn("seedBackup: hasRemoteBackupInteractive failed", error);
    throw error instanceof BackupError ? error : new BackupError("unknown");
  }
}

/**
 * True when the *currently signed-in* Google account has a backup blob in its
 * appDataFolder. Non-interactive on purpose — this runs at login to route new
 * devices, and must never pop a Drive-consent or account-switch prompt.
 */
export async function hasRemoteBackup(): Promise<boolean> {
  try {
    return (await findBackupFile(false)) !== null;
  } catch (error) {
    devWarn("seedBackup: hasRemoteBackup failed", error);
    // Don't claim "no backup" when we simply couldn't ask — a caller that
    // treats a network blip as "no backup" would offer to mint a fresh wallet
    // over the top of a perfectly good one.
    throw error instanceof BackupError ? error : new BackupError("unknown");
  }
}

/**
 * Encrypts `mnemonic` under `passphrase` and writes it to Drive, replacing any
 * previous backup for this wallet's Google account.
 *
 * `ownerEmail` is the Google account the wallet belongs to (from the local
 * account link). The upload switches to that account first, so a multi-account
 * user always backs each wallet up into its *own* Drive, never whichever
 * account happens to be signed in.
 */
export async function backupSeed(
  mnemonic: string,
  passphrase: string,
  walletAddress: string,
  ownerEmail?: string,
): Promise<void> {
  if (!mnemonic) throw new BackupError("no_mnemonic");

  try {
    const blob = await encryptMnemonic(mnemonic, passphrase);
    await uploadBackup(blob, ownerEmail);
    setLocalBackupTimestamp(walletAddress, blob.createdAt);
  } catch (error) {
    devWarn("seedBackup: backup failed", error);
    throw error instanceof BackupError ? error : new BackupError("unknown");
  }
}

/**
 * Fetches and decrypts this account's backup. Returns the mnemonic plus the
 * backup's `createdAt` (so the caller can cache the *existing* backup's real
 * date locally). The caller derives wallets from the mnemonic and must not
 * persist the plaintext anywhere else.
 */
export async function restoreSeed(
  passphrase: string,
  ownerEmail?: string,
): Promise<{ mnemonic: string; createdAt: number }> {
  let blob: unknown;

  try {
    // Interactive: at restore time we *want* to prompt for the Drive scope (and
    // switch to `ownerEmail` if the caller knows it) — the user asked to restore.
    const file = await findBackupFile(true, ownerEmail);
    if (!file) throw new BackupError("backup_missing");
    blob = await downloadBackup(file.id);
  } catch (error) {
    devWarn("seedBackup: restore fetch failed", error);
    throw error instanceof BackupError ? error : new BackupError("unknown");
  }

  try {
    const mnemonic = await decryptMnemonic(blob, passphrase);
    // decryptMnemonic has already validated the blob shape, so this read is a
    // formality — fall back to now only to keep the type honest.
    const createdAt = isSeedBackupBlobV1(blob) ? blob.createdAt : Date.now();
    return { mnemonic, createdAt };
  } catch (error) {
    if (error instanceof WrongPassphraseError) {
      throw new BackupError("passphrase_rejected");
    }
    if (error instanceof CorruptBackupError) {
      throw new BackupError("backup_corrupt");
    }
    devWarn("seedBackup: decrypt failed", error);
    throw new BackupError("unknown");
  }
}

/** Removes the backup from Drive. The on-device wallet is untouched. */
export async function removeBackup(
  walletAddress: string,
  ownerEmail?: string,
): Promise<void> {
  try {
    const file = await findBackupFile(true, ownerEmail);
    if (file) await deleteBackup(file.id);
    clearLocalBackupTimestamp(walletAddress);
  } catch (error) {
    devWarn("seedBackup: remove failed", error);
    throw error instanceof BackupError ? error : new BackupError("unknown");
  }
}
