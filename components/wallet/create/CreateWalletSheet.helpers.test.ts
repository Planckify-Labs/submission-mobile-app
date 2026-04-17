/**
 * Unit tests for `CreateWalletSheet.helpers` — the pure UI-logic
 * surface extracted from `CreateWalletSheet.tsx` so we can cover it
 * without a React Native renderer.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     components/wallet/create/CreateWalletSheet.helpers.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeStep,
  namespaceSetsEqual,
  type StepState,
  shuffleWords,
  verifyWords,
} from "./CreateWalletSheet.helpers.ts";

/**
 * Deterministic RNG factory — `mulberry32` keyed by `seed`. Gives
 * identical pseudo-random streams across runs so `shuffleWords` output
 * is reproducible under test.
 */
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("shuffleWords", () => {
  it("returns an array of the same length", () => {
    const words = ["a", "b", "c", "d", "e"];
    const out = shuffleWords(words, seededRng(1));
    assert.equal(out.length, words.length);
  });

  it("contains exactly the same multiset of words", () => {
    const words = ["a", "b", "c", "d", "e", "f", "g"];
    const out = shuffleWords(words, seededRng(42));
    assert.deepEqual(out.slice().sort(), words.slice().sort());
  });

  it("does not mutate the input array", () => {
    const words = ["alpha", "beta", "gamma"];
    const before = words.slice();
    shuffleWords(words, seededRng(7));
    assert.deepEqual(words, before);
  });

  it("is deterministic when the same seeded rng is supplied", () => {
    const words = ["one", "two", "three", "four", "five", "six"];
    const a = shuffleWords(words, seededRng(123));
    const b = shuffleWords(words, seededRng(123));
    assert.deepEqual(a, b);
  });

  it("produces different orderings for different seeds on long inputs", () => {
    const words = [
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
      "ten",
      "eleven",
      "twelve",
    ];
    const a = shuffleWords(words, seededRng(1));
    const b = shuffleWords(words, seededRng(2));
    assert.notDeepEqual(a, b);
  });

  it("handles an empty array", () => {
    assert.deepEqual(shuffleWords([], seededRng(1)), []);
  });

  it("handles a single-element array", () => {
    assert.deepEqual(shuffleWords(["solo"], seededRng(1)), ["solo"]);
  });
});

describe("verifyWords", () => {
  const answer = ["abandon", "ability", "able", "about"];
  // Deterministic shuffled layout for the suite.
  const shuffled = ["able", "abandon", "about", "ability"];
  // Map "answer word" → index in `shuffled`.
  const idxOf = (w: string) => shuffled.indexOf(w);

  it("returns 'incomplete' when no picks have been made", () => {
    assert.equal(verifyWords(shuffled, [], answer), "incomplete");
  });

  it("returns 'incomplete' with fewer picks than answer words", () => {
    const picks = [idxOf("abandon"), idxOf("ability")];
    assert.equal(verifyWords(shuffled, picks, answer), "incomplete");
  });

  it("returns 'correct' when every pick matches the answer in order", () => {
    const picks = answer.map(idxOf);
    assert.equal(verifyWords(shuffled, picks, answer), "correct");
  });

  it("returns 'incorrect' when one pick is wrong", () => {
    // Swap the second and third picks.
    const picks = [
      idxOf("abandon"),
      idxOf("able"), // should be "ability"
      idxOf("ability"),
      idxOf("about"),
    ];
    assert.equal(verifyWords(shuffled, picks, answer), "incorrect");
  });

  it("returns 'incorrect' for an out-of-range index", () => {
    const picks = [idxOf("abandon"), 99, idxOf("able"), idxOf("about")];
    assert.equal(verifyWords(shuffled, picks, answer), "incorrect");
  });

  it("returns 'incorrect' for a negative index", () => {
    const picks = [-1, idxOf("ability"), idxOf("able"), idxOf("about")];
    assert.equal(verifyWords(shuffled, picks, answer), "incorrect");
  });
});

describe("computeStep", () => {
  const base: StepState = {
    mnemonicAcknowledged: false,
    verifyState: "incomplete",
    verifyConfirmed: false,
    namespacesConfirmed: false,
    isSaving: false,
    completed: false,
  };

  it("starts on step 1 with a fresh state", () => {
    assert.equal(computeStep(base), 1);
  });

  it("advances to step 2 once the mnemonic has been acknowledged", () => {
    assert.equal(computeStep({ ...base, mnemonicAcknowledged: true }), 2);
  });

  it("stays on step 2 while verify is incorrect", () => {
    assert.equal(
      computeStep({
        ...base,
        mnemonicAcknowledged: true,
        verifyState: "incorrect",
      }),
      2,
    );
  });

  it("stays on step 2 when verify is correct but not yet confirmed", () => {
    assert.equal(
      computeStep({
        ...base,
        mnemonicAcknowledged: true,
        verifyState: "correct",
      }),
      2,
    );
  });

  it("advances to step 3 once verify is confirmed", () => {
    assert.equal(
      computeStep({
        ...base,
        mnemonicAcknowledged: true,
        verifyState: "correct",
        verifyConfirmed: true,
      }),
      3,
    );
  });

  it("advances to step 4 once namespaces are confirmed", () => {
    assert.equal(
      computeStep({
        ...base,
        mnemonicAcknowledged: true,
        verifyState: "correct",
        verifyConfirmed: true,
        namespacesConfirmed: true,
      }),
      4,
    );
  });

  it("stays on step 4 while saving is in flight", () => {
    assert.equal(
      computeStep({
        ...base,
        mnemonicAcknowledged: true,
        verifyState: "correct",
        verifyConfirmed: true,
        namespacesConfirmed: true,
        isSaving: true,
      }),
      4,
    );
  });

  it("stays on step 4 after completion", () => {
    assert.equal(
      computeStep({
        ...base,
        mnemonicAcknowledged: true,
        verifyState: "correct",
        verifyConfirmed: true,
        namespacesConfirmed: true,
        completed: true,
      }),
      4,
    );
  });
});

describe("namespaceSetsEqual", () => {
  it("returns true for identical arrays", () => {
    assert.equal(
      namespaceSetsEqual(["eip155", "solana"], ["eip155", "solana"]),
      true,
    );
  });

  it("returns true regardless of ordering", () => {
    assert.equal(
      namespaceSetsEqual(["solana", "eip155"], ["eip155", "solana"]),
      true,
    );
  });

  it("returns false for different lengths", () => {
    assert.equal(namespaceSetsEqual(["eip155"], ["eip155", "solana"]), false);
  });

  it("returns false when sets differ", () => {
    assert.equal(namespaceSetsEqual(["eip155"], ["solana"]), false);
  });

  it("returns true for empty arrays", () => {
    assert.equal(namespaceSetsEqual([], []), true);
  });
});
