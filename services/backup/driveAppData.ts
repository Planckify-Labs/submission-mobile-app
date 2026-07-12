/**
 * Minimal Google Drive `appDataFolder` client.
 *
 * `appDataFolder` is a per-app hidden space in the *user's own* Drive. Other
 * apps can't see it and it doesn't clutter their file list. Per Google's Drive
 * API guide the scope is **non-sensitive**, so it needs only basic OAuth app
 * verification — no security assessment.
 *
 * Caveat that shapes the product: the user can still delete this data, and
 * Google deletes it when they disconnect the app from Drive. A backup here is
 * therefore a convenience, never the system of record. The seed phrase remains
 * the root backup — see `docs/encrypted-seed-backup-spec.md` §7.
 */
import {
  GoogleSignin,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin";
import { BackupError, devWarn } from "./errors";

export const DRIVE_APPDATA_SCOPE =
  "https://www.googleapis.com/auth/drive.appdata";

const BACKUP_FILENAME = "takumi-seed-backup.v1.json";
const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

interface DriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
}

/**
 * Whether the Drive `appdata` scope is currently granted. The scope is
 * *optional* at sign-in (Google's granular-consent checkbox), so a signed-in
 * user may not have it. Synchronous and prompt-free — safe to call anywhere,
 * including the login decision, to decide whether Drive backup is even possible
 * without nagging a user who opted out.
 */
export function hasDriveScope(): boolean {
  try {
    const user = GoogleSignin.getCurrentUser();
    return user?.scopes?.includes(DRIVE_APPDATA_SCOPE) ?? false;
  } catch (error) {
    devWarn("drive: getCurrentUser failed", error);
    return false;
  }
}

/** Email of the Google account currently signed into the SDK, or null. */
function currentGoogleEmail(): string | null {
  try {
    return GoogleSignin.getCurrentUser()?.user?.email ?? null;
  } catch (error) {
    devWarn("drive: getCurrentUser failed", error);
    return null;
  }
}

/**
 * Prompts for the Drive scope. **Always** calls `addScopes` — never gated on
 * `getCurrentUser().scopes`, because on Android that list reflects the scopes
 * requested in `configure()` (drive.appdata is requested at sign-in) rather
 * than the ones actually *granted*. Gating there false-positives, so the
 * consent dialog gets skipped and the user "gets a permission warning but is
 * never asked" — the exact bug this fixes. `addScopes` is a no-op when the
 * scope is truly granted and shows the incremental-consent dialog when it
 * isn't; the real success verdict is left to the Drive call itself (a 403 maps
 * to `drive_permission_denied`).
 */
export async function ensureDriveAccess(): Promise<void> {
  try {
    await GoogleSignin.addScopes({ scopes: [DRIVE_APPDATA_SCOPE] });
  } catch (error) {
    devWarn("drive: addScopes failed", error);
  }
}

/**
 * Makes sure the SDK is signed into `expectedEmail` before we touch Drive.
 *
 * Each wallet's encrypted seed belongs in *its own* Google account's Drive, but
 * the SDK holds only one session — the last account logged in. When they differ
 * we switch (forcing the picker via `signOut`), so a multi-account user backing
 * up wallet A never writes it into account B's Drive. Throws
 * `wrong_google_account` if the user cancels or picks the wrong one. A no-op
 * when no owner is recorded (non-Google wallets) or already correct.
 */
async function ensureSignedInAs(expectedEmail?: string): Promise<void> {
  if (!expectedEmail) return;
  const want = expectedEmail.toLowerCase();
  if (currentGoogleEmail()?.toLowerCase() === want) return;

  try {
    await GoogleSignin.signOut();
    const res = await GoogleSignin.signIn();
    if (isSuccessResponse(res) && res.data.user.email.toLowerCase() === want) {
      return;
    }
  } catch (error) {
    devWarn("drive: account switch failed", error);
  }
  throw new BackupError("wrong_google_account");
}

/**
 * Returns a Drive bearer token. When `interactive`, first switches to the
 * wallet's owning Google account (`expectedEmail`) and prompts for the Drive
 * scope; non-interactive callers (login-time backup detection) do neither, so
 * they never nag a user who opted out.
 */
async function getAccessToken(
  interactive: boolean,
  expectedEmail?: string,
): Promise<string> {
  if (interactive) {
    await ensureSignedInAs(expectedEmail);
    await ensureDriveAccess();
  }
  try {
    let { accessToken } = await GoogleSignin.getTokens();
    // A scope just granted via `addScopes` is NOT reflected in an access token
    // that was minted before the grant — `getTokens` caches, so that stale
    // token still lacks Drive and the API 403s *even though the user consented*
    // (the "I granted it but it still fails" case). On interactive paths, drop
    // the cached token and re-mint so the fresh one carries the Drive scope.
    if (interactive && accessToken) {
      try {
        await GoogleSignin.clearCachedAccessToken(accessToken);
        accessToken = (await GoogleSignin.getTokens()).accessToken;
      } catch (error) {
        devWarn("drive: refreshing access token failed", error);
      }
    }
    if (!accessToken) throw new Error("no access token");
    return accessToken;
  } catch (error) {
    if (error instanceof BackupError) throw error;
    devWarn("drive: could not obtain access token", error);
    throw new BackupError("backup_unavailable");
  }
}

const authedFetch = (url: string, init: RequestInit, token: string) =>
  fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });

async function driveFetch(
  url: string,
  init: RequestInit,
  token: string,
): Promise<Response> {
  let response = await authedFetch(url, init, token);

  // A 403 right after the user granted consent almost always means the token
  // was minted before the grant and doesn't carry the Drive scope (getTokens
  // caches aggressively). Force a brand-new token and retry once — this is what
  // turns "I allowed it but it still fails" into a successful backup.
  if (response.status === 403) {
    try {
      await GoogleSignin.clearCachedAccessToken(token);
      const fresh = (await GoogleSignin.getTokens()).accessToken;
      if (fresh && fresh !== token) {
        response = await authedFetch(url, init, fresh);
      }
    } catch (error) {
      devWarn("drive: token refresh on 403 failed", error);
    }
  }

  if (!response.ok) {
    // Status AND body go to the dev log only (never the user) — the body is
    // what distinguishes an insufficient-scope 403 from a "Drive API is not
    // enabled for this project" 403, which no amount of consent can fix.
    let detail = "";
    if (__DEV__) {
      try {
        detail = await response.clone().text();
      } catch {
        // ignore — best-effort diagnostics
      }
    }
    devWarn(
      `drive: ${init.method ?? "GET"} ${url} -> ${response.status} ${detail}`,
      null,
    );
    // A 403 that survives the refresh means the grant genuinely isn't there
    // (box unchecked, or revoked in Google account settings) — surface it as a
    // permission problem so the user is asked to re-grant, not told the network
    // failed.
    if (response.status === 403) {
      throw new BackupError("drive_permission_denied");
    }
    throw new BackupError("backup_unavailable");
  }

  return response;
}

/**
 * Returns the backup file's metadata, or null when this account has none.
 * Non-interactive by default (login-time detection): pass `interactive` for the
 * user-driven restore/backup paths so the scope/account prompts can run.
 */
export async function findBackupFile(
  interactive = false,
  expectedEmail?: string,
): Promise<DriveFile | null> {
  const token = await getAccessToken(interactive, expectedEmail);

  const query = new URLSearchParams({
    spaces: "appDataFolder",
    q: `name = '${BACKUP_FILENAME}' and trashed = false`,
    fields: "files(id,name,modifiedTime)",
    pageSize: "10",
  });

  const response = await driveFetch(
    `${DRIVE_FILES}?${query}`,
    { method: "GET" },
    token,
  );

  const body = (await response.json()) as { files?: DriveFile[] };
  const files = body.files ?? [];
  if (files.length === 0) return null;

  // Defensive: if a past bug ever wrote duplicates, take the newest.
  return files.sort((a, b) =>
    (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""),
  )[0];
}

export async function downloadBackup(fileId: string): Promise<unknown> {
  // Non-interactive: callers reach here only after `findBackupFile(true, …)`
  // has already switched account + granted scope in the same flow.
  const token = await getAccessToken(false);
  const response = await driveFetch(
    `${DRIVE_FILES}/${fileId}?alt=media`,
    { method: "GET" },
    token,
  );

  try {
    return await response.json();
  } catch (error) {
    devWarn("drive: backup blob is not valid JSON", error);
    throw new BackupError("backup_corrupt");
  }
}

/**
 * Writes the blob, replacing any existing backup for this account.
 *
 * Updating in place (PATCH on the known id) rather than creating a second file
 * keeps `findBackupFile` unambiguous and means a re-backup can't leave the old
 * ciphertext — encrypted under the *old* passphrase — lying around.
 */
export async function uploadBackup(
  blob: object,
  expectedEmail?: string,
): Promise<void> {
  // Interactive: switch to the wallet's owning account + grant Drive up front.
  const token = await getAccessToken(true, expectedEmail);
  // Scope + account already ensured above, so this lookup stays non-interactive.
  const existing = await findBackupFile(false);
  const content = JSON.stringify(blob);

  if (existing) {
    await driveFetch(
      `${DRIVE_UPLOAD}/${existing.id}?uploadType=media`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: content,
      },
      token,
    );
    return;
  }

  // Multipart create: metadata part, then the file body.
  const boundary = `takumi${Math.random().toString(36).slice(2)}`;
  const metadata = JSON.stringify({
    name: BACKUP_FILENAME,
    parents: ["appDataFolder"],
    mimeType: "application/json",
  });

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  await driveFetch(
    `${DRIVE_UPLOAD}?uploadType=multipart`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
    token,
  );
}

export async function deleteBackup(fileId: string): Promise<void> {
  // Non-interactive: `removeBackup` locates the file with `findBackupFile(true,
  // …)` first, so account + scope are already ensured here.
  const token = await getAccessToken(false);
  await driveFetch(`${DRIVE_FILES}/${fileId}`, { method: "DELETE" }, token);
}
