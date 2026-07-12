/**
 * Passphrase rules for the encrypted seed backup.
 *
 * This passphrase is the only thing standing between "attacker took over the
 * user's Google account" and "attacker drained the wallet". They hold the
 * ciphertext, so they guess **offline**, with no server to rate-limit them.
 * That is why the app PIN is not reused here: 6 digits is a 10^6 keyspace,
 * which even a 64 MiB Argon2id makes only inconveniently, not prohibitively,
 * expensive to exhaust.
 */

export const MIN_PASSPHRASE_LENGTH = 10;

/** Obvious guesses an attacker tries first. Compared case-insensitively. */
const BLOCKLIST = [
  "password",
  "passphrase",
  "takumipay",
  "takumi",
  "12345678",
  "1234567890",
  "qwertyuiop",
  "seedphrase",
  "letmein",
];

export type TPassphraseStrength = "weak" | "fair" | "strong";

export interface PassphraseCheck {
  ok: boolean;
  strength: TPassphraseStrength;
  /** Fixed, user-facing copy. Null when the passphrase is acceptable. */
  problem: string | null;
}

/**
 * @param email the signed-in account, so we can reject a passphrase built from
 * the address an attacker already knows.
 */
export function checkPassphrase(
  passphrase: string,
  email?: string,
): PassphraseCheck {
  const trimmed = passphrase.trim();
  const lower = trimmed.toLowerCase();

  if (trimmed.length < MIN_PASSPHRASE_LENGTH) {
    return {
      ok: false,
      strength: "weak",
      problem: `Use at least ${MIN_PASSPHRASE_LENGTH} characters.`,
    };
  }

  if (BLOCKLIST.some((entry) => lower.includes(entry))) {
    return {
      ok: false,
      strength: "weak",
      problem: "That passphrase is too easy to guess. Try something else.",
    };
  }

  const localPart = email?.split("@")[0]?.toLowerCase();
  if (localPart && localPart.length >= 3 && lower.includes(localPart)) {
    return {
      ok: false,
      strength: "weak",
      problem: "Don't use your email address in your passphrase.",
    };
  }

  if (/^(.)\1+$/.test(trimmed)) {
    return {
      ok: false,
      strength: "weak",
      problem: "That passphrase is too easy to guess. Try something else.",
    };
  }

  // Length dominates guess-resistance far more than character-class rules do,
  // so the meter rewards it rather than demanding a symbol.
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((re) =>
    re.test(trimmed),
  ).length;

  const strength: TPassphraseStrength =
    trimmed.length >= 16 || (trimmed.length >= 12 && classes >= 3)
      ? "strong"
      : "fair";

  return { ok: true, strength, problem: null };
}
