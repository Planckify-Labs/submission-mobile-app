/**
 * Biometric-gated approval helper for in-app wallet actions.
 *
 * Wraps the sheet's approve callback so that tapping "Approve" first
 * prompts the OS biometric (Face ID / Touch ID / fingerprint) with a
 * device-passcode fallback. If the user cancels, the sheet stays open
 * — we do NOT auto-reject, the user just sees the inline error.
 *
 * Uses `authenticateUser` from `utils/authUtils.ts` (passcode fallback
 * enabled). For "biometric only" flows, callers should use
 * `appLock.authenticateBiometric` directly.
 */

import { useCallback, useState } from "react";
import { authenticateUser } from "@/utils/authUtils";

export interface UseBiometricApprovalResult {
  gatedApprove: () => Promise<void>;
  /** True while the OS prompt is visible. Disable the button. */
  pending: boolean;
  /** Populated when biometric fails / user cancels. */
  error: string | null;
  clearError: () => void;
}

export function useBiometricApproval(
  reason: string,
  onAuthenticated: () => void,
): UseBiometricApprovalResult {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gatedApprove = useCallback(async () => {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const ok = await authenticateUser(reason);
      if (!ok) {
        setError("Authentication failed. Try again.");
        return;
      }
      onAuthenticated();
    } catch (err) {
      if (__DEV__) {
        console.warn("[useBiometricApproval] authenticate threw", err);
      }
      setError("Authentication unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }, [pending, reason, onAuthenticated]);

  const clearError = useCallback(() => setError(null), []);

  return { gatedApprove, pending, error, clearError };
}
