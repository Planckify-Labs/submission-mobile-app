/**
 * Unit tests for `ImportSeedPhraseSheet.helpers` (spec §14.6, Task 24).
 *
 * Matches the Node test runner style used by
 * `CreateWalletSheet.helpers.test.ts` /
 * `ImportPrivateKeySheet.helpers.test.ts`.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     components/wallet/create/ImportSeedPhraseSheet.helpers.test.ts
 *
 * Node-only — no react / react-native / viem imports. The helpers are
 * pure so there's no registry / kit mocking required (unlike the
 * private-key sibling which routes through the kit registry).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TWallet } from "../../../constants/types/walletTypes.ts";
import {
  filterDuplicates,
  normalizeMnemonic,
  validateMnemonicState,
} from "./ImportSeedPhraseSheet.helpers.ts";

// Canonical Phantom/MetaMask BIP-39 vector — matches the fixtures in
// `services/walletKit/deriveAll.test.ts` and
// `services/walletKit/solana/SolanaWalletKit.test.ts`. Keep these in
// lockstep if the fixture ever changes.
const CANONICAL_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

describe("normalizeMnemonic", () => {
  it("trims leading and trailing whitespace", () => {
    assert.equal(normalizeMnemonic("  abandon about  "), "abandon about");
  });

  it("collapses internal whitespace runs to single spaces", () => {
    assert.equal(
      normalizeMnemonic("  ABANDON   ABANDON \n ABOUT  "),
      "abandon abandon about",
    );
  });

  it("collapses tabs and newlines too", () => {
    assert.equal(
      normalizeMnemonic("abandon\tabandon\n\nabout"),
      "abandon abandon about",
    );
  });

  it("lowercases uppercase input", () => {
    assert.equal(normalizeMnemonic("ABANDON ABOUT"), "abandon about");
  });

  it("returns an empty string for whitespace-only input", () => {
    assert.equal(normalizeMnemonic("   \n\t  "), "");
  });

  it("leaves an already-normalised phrase untouched", () => {
    assert.equal(normalizeMnemonic(CANONICAL_MNEMONIC), CANONICAL_MNEMONIC);
  });
});

describe("validateMnemonicState", () => {
  it("returns 'empty' for an empty string", () => {
    assert.equal(validateMnemonicState(""), "empty");
  });

  it("returns 'empty' for whitespace-only input", () => {
    assert.equal(validateMnemonicState("   \n\t  "), "empty");
  });

  it("returns 'invalid' for gibberish", () => {
    assert.equal(
      validateMnemonicState("not a real mnemonic at all"),
      "invalid",
    );
  });

  it("returns 'invalid' for an 11-word truncation of a valid phrase", () => {
    const truncated = CANONICAL_MNEMONIC.split(" ").slice(0, 11).join(" ");
    assert.equal(validateMnemonicState(truncated), "invalid");
  });

  it("returns 'invalid' for a 12-word list with a bad checksum", () => {
    // Swap the last word — same wordlist tokens, different checksum.
    const badChecksum =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon";
    assert.equal(validateMnemonicState(badChecksum), "invalid");
  });

  it("returns 'valid' for the Task 07 canonical 12-word mnemonic", () => {
    assert.equal(validateMnemonicState(CANONICAL_MNEMONIC), "valid");
  });

  it("accepts the canonical mnemonic in uppercase with extra whitespace", () => {
    const messy = `  ${CANONICAL_MNEMONIC.toUpperCase().replace(/ /g, "   ")}  `;
    assert.equal(validateMnemonicState(messy), "valid");
  });
});

// ── filterDuplicates fixtures ─────────────────────────────────────────
// We only care about the fields the helper reads (`namespace` +
// `address`); every other field is filled with a sentinel so a stray
// dereference would crash loudly in test. Typed as `TWallet` via a
// narrowing helper so TypeScript checks the required shape.

function wallet(namespace: TWallet["namespace"], address: string): TWallet {
  return {
    name: `Test · ${namespace}`,
    address,
    balance: "0",
    source: "Imported",
    type: "SeedPhrase",
    namespace,
    account: null,
  };
}

const EVM_ADDRESS = "0x9858EfFD232B4033E47d90003D41EC34EcaEda94";
const EVM_ADDRESS_LOWER = EVM_ADDRESS.toLowerCase();
const SOLANA_ADDRESS = "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk";

describe("filterDuplicates", () => {
  it("returns all wallets when nothing exists yet", () => {
    const derived = [
      wallet("eip155", EVM_ADDRESS),
      wallet("solana", SOLANA_ADDRESS),
    ];
    const { toAdd, skipped } = filterDuplicates(derived, []);
    assert.equal(toAdd.length, 2);
    assert.deepEqual(skipped, []);
  });

  it("flags both namespaces when both are already in the bundle", () => {
    const derived = [
      wallet("eip155", EVM_ADDRESS),
      wallet("solana", SOLANA_ADDRESS),
    ];
    const existing = [
      wallet("eip155", EVM_ADDRESS),
      wallet("solana", SOLANA_ADDRESS),
    ];
    const { toAdd, skipped } = filterDuplicates(derived, existing);
    assert.deepEqual(toAdd, []);
    assert.deepEqual(skipped, ["eip155", "solana"]);
  });

  it("only flags eip155 when the EVM wallet is duplicated but Solana is new", () => {
    const derived = [
      wallet("eip155", EVM_ADDRESS),
      wallet("solana", SOLANA_ADDRESS),
    ];
    const existing = [wallet("eip155", EVM_ADDRESS)];
    const { toAdd, skipped } = filterDuplicates(derived, existing);
    assert.deepEqual(skipped, ["eip155"]);
    assert.equal(toAdd.length, 1);
    assert.equal(toAdd[0].namespace, "solana");
    assert.equal(toAdd[0].address, SOLANA_ADDRESS);
  });

  it("treats EVM address comparisons as case-insensitive", () => {
    // Existing stored in lowercase, derived in checksum-case — same wallet.
    const derived = [wallet("eip155", EVM_ADDRESS)];
    const existing = [wallet("eip155", EVM_ADDRESS_LOWER)];
    const { toAdd, skipped } = filterDuplicates(derived, existing);
    assert.deepEqual(toAdd, []);
    assert.deepEqual(skipped, ["eip155"]);
  });

  it("treats Solana base58 comparisons as case-sensitive", () => {
    // Re-casing a base58 Solana address yields a DIFFERENT key on the
    // curve — so it must NOT be collapsed into the same dedup bucket.
    const derived = [wallet("solana", SOLANA_ADDRESS)];
    const existing = [wallet("solana", SOLANA_ADDRESS.toLowerCase())];
    const { toAdd, skipped } = filterDuplicates(derived, existing);
    assert.equal(toAdd.length, 1);
    assert.deepEqual(skipped, []);
  });

  it("preserves derived order in the skipped list", () => {
    const derived = [
      wallet("solana", SOLANA_ADDRESS),
      wallet("eip155", EVM_ADDRESS),
    ];
    const existing = [
      wallet("eip155", EVM_ADDRESS),
      wallet("solana", SOLANA_ADDRESS),
    ];
    const { skipped } = filterDuplicates(derived, existing);
    assert.deepEqual(skipped, ["solana", "eip155"]);
  });

  it("does not mutate either input array", () => {
    const derived = [wallet("eip155", EVM_ADDRESS)];
    const existing = [wallet("eip155", EVM_ADDRESS)];
    const derivedSnapshot = [...derived];
    const existingSnapshot = [...existing];
    filterDuplicates(derived, existing);
    assert.deepEqual(derived, derivedSnapshot);
    assert.deepEqual(existing, existingSnapshot);
  });
});
