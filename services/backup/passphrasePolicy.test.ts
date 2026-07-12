import { describe, expect, it } from "vitest";
import { checkPassphrase, MIN_PASSPHRASE_LENGTH } from "./passphrasePolicy";

describe("checkPassphrase", () => {
  it("rejects anything shorter than the minimum", () => {
    const short = "a".repeat(MIN_PASSPHRASE_LENGTH - 1);
    const result = checkPassphrase(short);
    expect(result.ok).toBe(false);
    expect(result.strength).toBe("weak");
    expect(result.problem).toContain(String(MIN_PASSPHRASE_LENGTH));
  });

  it("rejects a 6-digit PIN — the exact reuse this policy exists to prevent", () => {
    expect(checkPassphrase("483920").ok).toBe(false);
  });

  it("rejects blocklisted passphrases regardless of case or padding", () => {
    expect(checkPassphrase("Password123456").ok).toBe(false);
    expect(checkPassphrase("myTakumiPayKey").ok).toBe(false);
    expect(checkPassphrase("1234567890").ok).toBe(false);
  });

  it("rejects a passphrase containing the account's email local-part", () => {
    const result = checkPassphrase(
      "arindatuganis2026",
      "arindatuganis@gmail.com",
    );
    expect(result.ok).toBe(false);
    expect(result.problem).toContain("email");
  });

  it("does not reject on a trivially short email local-part", () => {
    // A 2-char local-part would otherwise blocklist half the alphabet.
    expect(checkPassphrase("purple monkey dishwasher", "ab@x.com").ok).toBe(
      true,
    );
  });

  it("rejects a single repeated character", () => {
    expect(checkPassphrase("aaaaaaaaaaaa").ok).toBe(false);
  });

  it("accepts a long passphrase and rates length highly", () => {
    const result = checkPassphrase("correct horse battery staple");
    expect(result.ok).toBe(true);
    expect(result.strength).toBe("strong");
  });

  it("rates a short-but-legal passphrase as fair, not strong", () => {
    const result = checkPassphrase("umbrella1x");
    expect(result.ok).toBe(true);
    expect(result.strength).toBe("fair");
  });

  it("rates a mixed-class 12-char passphrase as strong", () => {
    expect(checkPassphrase("Rt7#kelpDune").strength).toBe("strong");
  });

  it("ignores surrounding whitespace when measuring length", () => {
    expect(checkPassphrase(`   ${"a1B".repeat(2)}   `).ok).toBe(false);
  });
});
