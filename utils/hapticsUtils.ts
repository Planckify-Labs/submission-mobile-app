import * as Haptics from "expo-haptics";

/** Light tap for individual keypad / digit presses. */
export function tapFeedback(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/**
 * Double buzz to signal an error (wrong PIN, mismatched PINs, etc.).
 * Two spaced pulses give a distinct "vibrate twice" feel.
 */
export function errorFeedback(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  setTimeout(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, 120);
}
