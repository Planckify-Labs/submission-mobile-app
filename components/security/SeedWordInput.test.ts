/**
 * Source-level assertion that the SeedWordInput default prop set
 * matches the TWV-2026-005 spec list exactly. Node's experimental TS
 * stripper does not accept `.tsx`, so we grep the file rather than
 * import it; the full React-hosted behavioural check lives in the
 * manual-regression list.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     components/security/SeedWordInput.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const src = readFileSync(
  new URL("./SeedWordInput.tsx", import.meta.url),
  "utf-8",
);

describe("SeedWordInput — frozen default prop set (TWV-2026-005)", () => {
  it("disables autoCorrect", () => {
    assert.match(src, /autoCorrect:\s*false/);
  });
  it("disables spellCheck", () => {
    assert.match(src, /spellCheck:\s*false/);
  });
  it("disables autoCapitalize", () => {
    assert.match(src, /autoCapitalize:\s*"none"/);
  });
  it("disables autoComplete", () => {
    assert.match(src, /autoComplete:\s*"off"/);
  });
  it("textContentType is 'none'", () => {
    assert.match(src, /textContentType:\s*"none"/);
  });
  it("importantForAutofill is 'no'", () => {
    assert.match(src, /importantForAutofill:\s*"no"/);
  });
  it("Android keyboardType is 'visible-password'", () => {
    assert.match(src, /keyboardType[\s\S]*?"visible-password"/);
  });
  it("passwordRules is empty string", () => {
    assert.match(src, /passwordRules:\s*""/);
  });
  it("contextMenuHidden is true", () => {
    assert.match(src, /contextMenuHidden:\s*true/);
  });
  it("defaults are spread LAST so callers cannot override security props", () => {
    assert.match(
      src,
      /<TextInput\s*\{\.\.\.props\}\s*\{\.\.\.SEED_WORD_INPUT_DEFAULTS\}/,
    );
  });
});
