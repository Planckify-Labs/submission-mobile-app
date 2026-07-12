import {
  GoogleSignin,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { useMutation } from "@tanstack/react-query";
import { Platform } from "react-native";
import { publicApi } from "@/constants/configs/ky";
import { DRIVE_APPDATA_SCOPE } from "@/services/backup/driveAppData";

/**
 * Sign-in is two-step. `POST /auth/google` proves the Google ID token and
 * emails a six-digit code, but issues **no session** — the challenge below is
 * an opaque handle, not a credential. Tokens are minted only by
 * `POST /auth/google/verify-otp` once the code is submitted.
 */
export interface TGoogleChallenge {
  challengeId: string;
  /** Redacted by the server, for display only — e.g. `a***i@gmail.com`. */
  emailMasked: string;
  expiresInSeconds: number;
}

export interface TGoogleAuthResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email?: string;
    name?: string;
    role: string;
  };
  /**
   * Whether this Google account has previously linked a wallet on any device.
   * Drives the new-device recovery prompt — see `app/login.tsx`.
   */
  hasWallet?: boolean;
}

/**
 * Records the active wallet against the signed-in Google account so a future
 * new-device login can offer recovery. Best-effort and non-fatal: a failure
 * only means the next device falls back to the generic "set up" chooser.
 *
 * Uses a raw `fetch` with the Google access token rather than `publicApi` on
 * purpose — `publicApi`'s response hook treats any 401 as session death and
 * wipes tokens, and this call carries the Google JWT (whose `sub` is the
 * account id the server links against), not the wallet session.
 */
export async function registerGoogleWallet(
  accessToken: string,
  walletAddress: string,
): Promise<void> {
  const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!base) return;

  try {
    const response = await fetch(`${base}/auth/google/wallets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(process.env.EXPO_PUBLIC_API_KEY
          ? { "X-API-Key": process.env.EXPO_PUBLIC_API_KEY }
          : {}),
      },
      body: JSON.stringify({ walletAddress }),
    });
    if (!response.ok) devWarn("registerGoogleWallet non-OK:", response.status);
  } catch (error) {
    devWarn("registerGoogleWallet failed:", error);
  }
}

/**
 * Curated failure codes. The UI switches on these and supplies its own copy —
 * no server body, status line, or SDK error string ever reaches a user.
 */
export type TGoogleAuthErrorCode =
  | "cancelled"
  | "in_progress"
  | "play_services_unavailable"
  | "account_conflict"
  | "rate_limited"
  | "email_undeliverable"
  | "invalid_code"
  | "session_expired"
  | "unknown";

export class GoogleAuthError extends Error {
  readonly code: TGoogleAuthErrorCode;
  constructor(code: TGoogleAuthErrorCode) {
    super(code);
    this.name = "GoogleAuthError";
    this.code = code;
  }
}

export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
    // Encrypted seed backup lives in the user's own Drive appDataFolder.
    // `drive.appdata` is a non-sensitive scope (basic OAuth verification, no
    // security assessment). Requested up front so returning users don't hit a
    // second consent prompt mid-backup; `driveAppData.ts` still calls
    // `addScopes` for anyone who signed in before this shipped.
    scopes: [DRIVE_APPDATA_SCOPE],
  });
};

const devWarn = (label: string, error: unknown) => {
  if (__DEV__) console.warn(label, error);
};

/**
 * Server -> client error mapping. Only the structured `code` is read; the
 * accompanying `message` is never surfaced, per the user-facing-errors rule
 * in CLAUDE.md. Falls back to the status when a 400 carries no code (e.g. a
 * class-validator rejection).
 *
 * Note the Google endpoints never answer 401 — see `google-auth-errors.ts` on
 * the API. A 401 through `publicApi` would trip the global session-clearing
 * handler in `constants/configs/ky.ts`, so a mistyped digit must not produce
 * one.
 */
const SERVER_CODE_MAP: Record<string, TGoogleAuthErrorCode> = {
  INVALID_GOOGLE_TOKEN: "unknown",
  ACCOUNT_CONFLICT: "account_conflict",
  ACCOUNT_INACTIVE: "account_conflict",
  RATE_LIMITED: "rate_limited",
  EMAIL_UNDELIVERABLE: "email_undeliverable",
  INVALID_CODE: "invalid_code",
  CHALLENGE_EXPIRED: "session_expired",
};

const codeFromError = (error: unknown): TGoogleAuthErrorCode => {
  const response = (
    error as { response?: { status?: number; data?: { code?: string } } }
  )?.response;

  const serverCode = response?.data?.code;
  if (serverCode && serverCode in SERVER_CODE_MAP) {
    return SERVER_CODE_MAP[serverCode];
  }

  if (response?.status === 429) return "rate_limited";
  if (response?.status === 503) return "email_undeliverable";
  return "unknown";
};

/**
 * Step 1 — opens the Google account picker, then asks the server to email a
 * verification code. Resolves with the challenge to hand to the OTP sheet.
 */
export const useGoogleSignIn = () => {
  return useMutation<TGoogleChallenge, GoogleAuthError>({
    mutationFn: async () => {
      let idToken: string | null = null;

      try {
        await GoogleSignin.hasPlayServices();

        // Force the account chooser every time. `signIn()` silently reuses the
        // last-signed-in Google account once one is cached, which makes it
        // impossible to switch accounts (the exact bug users hit: tapping
        // "Continue with Google" just re-logs the existing account). Clearing
        // the cached session first makes the native picker appear. Non-fatal —
        // a no-op when nothing is cached, and never blocks the sign-in.
        try {
          await GoogleSignin.signOut();
        } catch (signOutError) {
          devWarn("pre-sign-in signOut failed (non-fatal):", signOutError);
        }

        const signInResult = await GoogleSignin.signIn();

        if (!isSuccessResponse(signInResult)) {
          throw new GoogleAuthError("cancelled");
        }
        idToken = signInResult.data.idToken;
      } catch (error) {
        if (error instanceof GoogleAuthError) throw error;
        devWarn("Google Sign-In failed:", error);

        const sdkCode = (error as { code?: string })?.code;
        if (sdkCode === statusCodes.SIGN_IN_CANCELLED) {
          throw new GoogleAuthError("cancelled");
        }
        if (sdkCode === statusCodes.IN_PROGRESS) {
          throw new GoogleAuthError("in_progress");
        }
        if (sdkCode === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          throw new GoogleAuthError("play_services_unavailable");
        }
        throw new GoogleAuthError("unknown");
      }

      if (!idToken) throw new GoogleAuthError("unknown");

      try {
        return await publicApi
          .post("auth/google", { json: { idToken, platform: Platform.OS } })
          .json<TGoogleChallenge>();
      } catch (error) {
        devWarn("auth/google failed:", error);
        throw new GoogleAuthError(codeFromError(error));
      }
    },
  });
};

/**
 * Step 2 — exchanges the challenge + emailed code for a session. A wrong,
 * expired, or exhausted code all surface as `invalid_code`; the server does
 * not distinguish them and neither should the UI.
 */
export const useVerifyGoogleOtp = () => {
  return useMutation<
    TGoogleAuthResponse,
    GoogleAuthError,
    { challengeId: string; code: string }
  >({
    mutationFn: async ({ challengeId, code }) => {
      try {
        return await publicApi
          .post("auth/google/verify-otp", { json: { challengeId, code } })
          .json<TGoogleAuthResponse>();
      } catch (error) {
        devWarn("auth/google/verify-otp failed:", error);
        throw new GoogleAuthError(codeFromError(error));
      }
    },
  });
};

/** Requests a fresh code. Never extends the original expiry window. */
export const useResendGoogleOtp = () => {
  return useMutation<
    TGoogleChallenge,
    GoogleAuthError,
    { challengeId: string }
  >({
    mutationFn: async ({ challengeId }) => {
      try {
        return await publicApi
          .post("auth/google/resend-otp", { json: { challengeId } })
          .json<TGoogleChallenge>();
      } catch (error) {
        devWarn("auth/google/resend-otp failed:", error);
        throw new GoogleAuthError(codeFromError(error));
      }
    },
  });
};

export const useGoogleSignOut = () => {
  return useMutation({
    mutationFn: async () => {
      try {
        await GoogleSignin.revokeAccess();
        await GoogleSignin.signOut();
      } catch (error) {
        // Not signed in is the common case here — nothing to surface.
        devWarn("Google sign out error:", error);
      }
    },
  });
};
