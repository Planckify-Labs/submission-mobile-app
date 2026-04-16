/**
 * TWV-2026-063 — Sensitive-paste detection helpers.
 *
 * BIP-39 detection runs client-side against the in-bundle wordlist. Any
 * import/export/send screen that reads the clipboard for sensitive input
 * MUST:
 *   1. Call {@link looksLikeBip39} on the pasted value.
 *   2. If true, show a warning modal before accepting the paste and offer
 *      a "Type instead" action (no auto-dismiss).
 *   3. After the value is accepted, clear the clipboard so
 *      clipboard-sniffing malware and other apps cannot re-read the
 *      seed phrase (`Clipboard.setStringAsync("")` from expo-clipboard).
 *
 * This file is deliberately free of native imports so it stays importable
 * under `node --test`. Consumers do the clipboard clear themselves with
 * the `expo-clipboard` instance they already hold.
 *
 * Policy doc: `docs/clipboard-policy.md`. PRs that touch the clipboard
 * APIs must cite it.
 */

import { wordlist as englishWordlist } from "@scure/bip39/wordlists/english";

const VALID_BIP39_LENGTHS = new Set<number>([12, 15, 18, 21, 24]);

const wordlistSet: Set<string> = new Set(englishWordlist);

/**
 * Tokenise pasted text the same way a seed-import form would: trim and
 * split on any whitespace run. Returns lowercased tokens so wordlist
 * lookup is deterministic. Exported for tests.
 */
export function tokenizeMnemonicCandidate(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  return trimmed.split(/\s+/).map((w) => w.toLowerCase());
}

/**
 * True when the pasted value looks like a BIP-39 mnemonic: the word
 * count is in {12, 15, 18, 21, 24} AND every token matches the English
 * wordlist. Deliberately conservative heuristic. Runs offline; no
 * network call.
 */
export function looksLikeBip39(raw: string): boolean {
  const words = tokenizeMnemonicCandidate(raw);
  if (!VALID_BIP39_LENGTHS.has(words.length)) return false;
  for (const word of words) {
    if (!wordlistSet.has(word)) return false;
  }
  return true;
}
