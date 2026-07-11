import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TWallet } from "@/constants/types/walletTypes";
import { googleWalletPrefix, tagWalletsAsGoogle } from "./googleWallets";

const wallet = (over: Partial<TWallet> = {}): TWallet =>
  ({
    name: "Main Wallet · ETH",
    address: "0xabc",
    balance: "0",
    source: "Created",
    type: "SeedPhrase",
    namespace: "eip155",
    account: {},
    seedPhrase: "word ".repeat(12).trim(),
    ...over,
  }) as TWallet;

describe("googleWalletPrefix", () => {
  it("prefers the account's first name", () => {
    assert.equal(
      googleWalletPrefix({ name: "Arinda Tuganis", email: "a@b.com" }),
      "Arinda",
    );
  });

  it("falls back to the email local-part when there's no name", () => {
    assert.equal(
      googleWalletPrefix({ email: "budi.santoso@gmail.com" }),
      "budi.santoso",
    );
  });

  it("falls back to 'Google' when neither is present", () => {
    assert.equal(googleWalletPrefix({}), "Google");
    assert.equal(googleWalletPrefix({ name: "   " }), "Google");
  });
});

describe("tagWalletsAsGoogle", () => {
  const owner = { email: "ada@example.com", name: "Ada Lovelace" };

  it("marks source Social and records the account, without touching type", () => {
    const [tagged] = tagWalletsAsGoogle([wallet()], owner);
    assert.equal(tagged.source, "Social");
    // Keeps type SeedPhrase so seed-reveal / signing UI still treats it as a
    // real, user-recoverable wallet (not a custodial "Social" wallet).
    assert.equal(tagged.type, "SeedPhrase");
    assert.deepEqual(tagged.socialAccount, {
      provider: "google",
      email: "ada@example.com",
      name: "Ada Lovelace",
    });
  });

  it("preserves the seed and key-bearing fields verbatim", () => {
    const src = wallet({ seedPhrase: "alpha beta gamma", address: "0xDEF" });
    const [tagged] = tagWalletsAsGoogle([src], owner);
    assert.equal(tagged.seedPhrase, "alpha beta gamma");
    assert.equal(tagged.address, "0xDEF");
  });

  it("tags every wallet in the set (one mnemonic → many chains)", () => {
    const set = [
      wallet({ namespace: "eip155" }),
      wallet({ namespace: "solana", address: "sol1" }),
      wallet({ namespace: "sui", address: "0xsui" }),
    ];
    const tagged = tagWalletsAsGoogle(set, owner);
    assert.equal(tagged.length, 3);
    assert.ok(tagged.every((w) => w.source === "Social"));
    assert.ok(tagged.every((w) => w.socialAccount?.provider === "google"));
  });

  it("tolerates a missing email/name on the owner", () => {
    const [tagged] = tagWalletsAsGoogle([wallet()], {});
    assert.deepEqual(tagged.socialAccount, {
      provider: "google",
      email: "",
      name: "",
    });
  });
});
