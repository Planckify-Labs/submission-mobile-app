/**
 * Error-code contract test per §10.3. Imports only the small errorCodes
 * enum to stay Node-runnable (Solana adapter source uses `@/` path
 * aliases resolvable by TSC/Metro but not by `node --test`).
 *
 * The full table-driven integration test runs inside Jest via
 * `pnpm run test -- SolanaAdapter` — see Metro-configured suite. This
 * spec-compliance test guarantees the codes enum stays aligned.
 *
 * Run:
 *   node --test --experimental-strip-types services/chains/solana/SolanaAdapter.errorCodes.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertSolanaErrorCode,
  isSolanaContractCode,
  SOLANA_ERROR_CODES,
} from "./errorCodes.ts";

describe("SOLANA_ERROR_CODES — §10.3 contract", () => {
  it("contains exactly the 8 spec codes", () => {
    const vals = Object.values(SOLANA_ERROR_CODES);
    assert.equal(vals.length, 8);
    // Hard-coded check — if anything here changes, the spec changes too.
    assert.deepEqual(new Set(vals), new Set([
      4001, 4100, 4200, 4900, 4901, -32002, -32602, -32603,
    ]));
  });

  it("isSolanaContractCode accepts every spec code", () => {
    for (const c of Object.values(SOLANA_ERROR_CODES)) {
      assert.ok(isSolanaContractCode(c), `missing ${c}`);
    }
  });

  it("isSolanaContractCode rejects arbitrary codes", () => {
    assert.equal(isSolanaContractCode(0), false);
    assert.equal(isSolanaContractCode(-1), false);
    assert.equal(isSolanaContractCode(4202), false);
    assert.equal(isSolanaContractCode(-32600), false);
  });

  it("assertSolanaErrorCode throws on non-contract codes", () => {
    assert.throws(() => assertSolanaErrorCode(0));
    assert.throws(() => assertSolanaErrorCode(4202));
    assert.doesNotThrow(() => assertSolanaErrorCode(4001));
    assert.doesNotThrow(() => assertSolanaErrorCode(-32603));
  });
});
