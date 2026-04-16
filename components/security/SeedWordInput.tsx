// TWV-2026-005 — The ONLY sanctioned TextInput type for seed-phrase
// entry, verification, and import. Plain `TextInput` on a seed screen is
// a regression: iOS QuickType and Android GBoard / Samsung Keyboard
// learn words typed into generic inputs and surface them as suggestions
// in other apps, and malicious third-party keyboards silently upload
// every keystroke.
//
// The prop set here is load-bearing — see
// `services/security/seedWordInputProps.test.ts`.

import type React from "react";
import {
  Platform,
  type StyleProp,
  TextInput,
  type TextInputProps,
  type TextStyle,
} from "react-native";

export const SEED_WORD_INPUT_DEFAULTS = {
  autoCorrect: false,
  spellCheck: false,
  autoCapitalize: "none" as const,
  autoComplete: "off" as const,
  textContentType: "none" as const,
  keyboardType:
    Platform.OS === "android"
      ? ("visible-password" as const)
      : ("default" as const),
  importantForAutofill: "no" as const,
  passwordRules: "",
  contextMenuHidden: true,
};

export interface SeedWordInputProps extends TextInputProps {
  style?: StyleProp<TextStyle>;
}

// Defaults are applied LAST so a caller cannot silently override a
// security-critical prop (e.g. `autoCorrect={true}`). If a future UX
// requires a relaxation, extend the defaults here with justification.
export function SeedWordInput(props: SeedWordInputProps): React.ReactElement {
  return <TextInput {...props} {...SEED_WORD_INPUT_DEFAULTS} />;
}
