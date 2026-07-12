import { describe, expect, it } from "vitest";
import {
  ARGON2_PARAMS,
  CorruptBackupError,
  decryptMnemonic,
  encryptMnemonic,
  isSeedBackupBlobV1,
  WrongPassphraseError,
} from "./seedBackupCrypto";
import type { Argon2Params, SeedBackupBlobV1 } from "./types";

// Cheap KDF so the suite runs in milliseconds. The AAD binding, GCM tag check
// and schema validation under test do not depend on cost.
const FAST: Argon2Params = { m: 256, t: 1, p: 1, dkLen: 32 };

const MNEMONIC =
  "legal winner thank year wave sausage worth useful legal winner thank yellow";
const PASSPHRASE = "correct horse battery staple";

const clone = (b: SeedBackupBlobV1): SeedBackupBlobV1 =>
  JSON.parse(JSON.stringify(b));

describe("seed backup envelope", () => {
  it("round-trips a mnemonic", async () => {
    const blob = await encryptMnemonic(MNEMONIC, PASSPHRASE, FAST);
    const out = await decryptMnemonic(blob, PASSPHRASE, FAST);
    expect(out).toBe(MNEMONIC);
  });

  it("never stores the mnemonic or the passphrase in the blob", async () => {
    const blob = await encryptMnemonic(MNEMONIC, PASSPHRASE, FAST);
    const raw = JSON.stringify(blob);
    expect(raw).not.toContain(PASSPHRASE);
    expect(raw).not.toContain("legal");
    expect(raw).not.toContain("sausage");
  });

  it("produces a fresh salt and iv on every call", async () => {
    const a = await encryptMnemonic(MNEMONIC, PASSPHRASE, FAST);
    const b = await encryptMnemonic(MNEMONIC, PASSPHRASE, FAST);
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.cipher.iv).not.toBe(b.cipher.iv);
    // Same plaintext + same passphrase must not yield the same ciphertext.
    expect(a.cipher.ct).not.toBe(b.cipher.ct);
  });

  it("rejects a wrong passphrase", async () => {
    const blob = await encryptMnemonic(MNEMONIC, PASSPHRASE, FAST);
    await expect(
      decryptMnemonic(blob, "wrong passphrase", FAST),
    ).rejects.toThrow(WrongPassphraseError);
  });

  it("rejects a tampered ciphertext", async () => {
    const blob = await encryptMnemonic(MNEMONIC, PASSPHRASE, FAST);
    const tampered = clone(blob);
    // Flip one base64 char in the ciphertext.
    const ct = tampered.cipher.ct;
    tampered.cipher.ct = (ct[0] === "A" ? "B" : "A") + ct.slice(1);

    await expect(decryptMnemonic(tampered, PASSPHRASE, FAST)).rejects.toThrow(
      WrongPassphraseError,
    );
  });

  it("rejects a tampered auth tag", async () => {
    const blob = await encryptMnemonic(MNEMONIC, PASSPHRASE, FAST);
    const tampered = clone(blob);
    const tag = tampered.cipher.tag;
    tampered.cipher.tag = (tag[0] === "A" ? "B" : "A") + tag.slice(1);

    await expect(decryptMnemonic(tampered, PASSPHRASE, FAST)).rejects.toThrow(
      WrongPassphraseError,
    );
  });

  /**
   * The attack the AAD exists to stop: an attacker with write access to the
   * user's Drive rewrites the KDF cost down so they can brute-force the
   * passphrase cheaply, leaving the ciphertext untouched.
   */
  it("refuses a blob whose KDF parameters were downgraded", async () => {
    const blob = await encryptMnemonic(MNEMONIC, PASSPHRASE, FAST);
    const downgraded = clone(blob);
    downgraded.kdf.m = 8;
    downgraded.kdf.t = 1;

    // Caught by the floor check before we even spend time deriving.
    await expect(decryptMnemonic(downgraded, PASSPHRASE, FAST)).rejects.toThrow(
      CorruptBackupError,
    );
  });

  it("refuses a KDF downgrade even when it clears the floor — AAD binds it", async () => {
    // Encrypt at a cost above the floor, then rewrite it to exactly the floor.
    // The floor check passes, so the tag check is what has to catch this.
    const strong: Argon2Params = { m: 512, t: 2, p: 1, dkLen: 32 };
    const blob = await encryptMnemonic(MNEMONIC, PASSPHRASE, strong);

    const downgraded = clone(blob);
    downgraded.kdf.m = FAST.m;
    downgraded.kdf.t = FAST.t;

    await expect(decryptMnemonic(downgraded, PASSPHRASE, FAST)).rejects.toThrow(
      WrongPassphraseError,
    );
  });

  it("refuses a blob whose createdAt was rewritten — AAD binds it too", async () => {
    const blob = await encryptMnemonic(MNEMONIC, PASSPHRASE, FAST);
    const tampered = clone(blob);
    tampered.createdAt = blob.createdAt + 1;

    await expect(decryptMnemonic(tampered, PASSPHRASE, FAST)).rejects.toThrow(
      WrongPassphraseError,
    );
  });

  it("refuses structurally invalid blobs", async () => {
    for (const bad of [
      null,
      undefined,
      42,
      {},
      { v: 2 },
      { v: 1, createdAt: 1, kdf: { alg: "scrypt" } },
    ]) {
      await expect(decryptMnemonic(bad, PASSPHRASE, FAST)).rejects.toThrow(
        CorruptBackupError,
      );
    }
  });

  it("validates blob shape", async () => {
    const blob = await encryptMnemonic(MNEMONIC, PASSPHRASE, FAST);
    expect(isSeedBackupBlobV1(blob)).toBe(true);
    expect(isSeedBackupBlobV1({ ...blob, v: 2 })).toBe(false);
    expect(isSeedBackupBlobV1({ ...blob, cipher: undefined })).toBe(false);
  });
});

describe("production KDF policy", () => {
  it("meets or exceeds the OWASP Argon2id floor", () => {
    // OWASP minimum: m = 19456 KiB (19 MiB), t = 2, p = 1.
    expect(ARGON2_PARAMS.m).toBeGreaterThanOrEqual(19456);
    expect(ARGON2_PARAMS.t).toBeGreaterThanOrEqual(2);
    expect(ARGON2_PARAMS.p).toBeGreaterThanOrEqual(1);
  });

  it("derives a 256-bit key for AES-256", () => {
    expect(ARGON2_PARAMS.dkLen).toBe(32);
  });
});
