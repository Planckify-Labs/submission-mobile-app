/**
 * Tests for the pure 1Shot relayer JSON-RPC client.
 *
 * Wire format tracks the live 1Shot API (skill `references/schemas.md` +
 * `examples.md`): `send`/`estimate` take a single params object with
 * `transactions:[{permissionContext, executions}]`, `chainId` as a decimal
 * string, executions keyed by `target`; `getStatus` takes `{id, logs}` and
 * returns numeric status codes.
 *
 * No network: every call injects a mock `fetch` that captures the outbound
 * request and returns a canned response.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DelegationStruct, RelayerBundleEntry } from "../types.ts";
import {
  assertFeeWithinSafetyBound,
  getRelayerEndpoint,
  getRelayerErrorCode,
  parsePaymentTokenAtoms,
  parseRelayerBigInt,
  RELAYER_ERROR,
  RELAYER_FEE_SAFETY_MAX_USDC_ATOMS,
  RELAYER_MAINNET_URL,
  RELAYER_TESTNET_URL,
  relayerEstimate7710Transaction,
  relayerGetCapabilities,
  relayerGetFeeData,
  relayerGetStatus,
  relayerSend7710Transaction,
} from "./relayer.ts";

const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const FEE_COLLECTOR = "0xE936e8FAf4A5655469182A49a505055B71C17604";
const TARGET = "0x4e44e22ee6da76c2ad19baaaffb52f676230fa06";
const DELEGATOR = "0x1111111111111111111111111111111111111111";
const ZERO32 = `0x${"0".repeat(64)}`;
const BASE_SEPOLIA = 84532;
const BASE_MAINNET = 8453;

const signedDelegation: DelegationStruct = {
  delegate: TARGET as `0x${string}`,
  delegator: DELEGATOR as `0x${string}`,
  authority: ZERO32 as `0x${string}`,
  caveats: [
    {
      enforcer: "0xenf" as `0x${string}`,
      terms: "0xterms" as `0x${string}`,
      args: "0x",
    },
  ],
  salt: "0xsalt" as `0x${string}`,
  signature: "0xsig" as `0x${string}`,
};

function bundle(value = 0n): RelayerBundleEntry {
  return {
    permissionContext: [signedDelegation],
    executions: [{ target: USDC, value, data: "0xa9059cbb" }],
  };
}

interface CapturedRequest {
  url: string;
  body: { jsonrpc: string; id: number; method: string; params: unknown };
}

function mockFetch(
  responseBody: unknown,
  opts: { status?: number; captured?: CapturedRequest[] } = {},
) {
  const status = opts.status ?? 200;
  return (async (url: string, init: { body: string }) => {
    opts.captured?.push({ url, body: JSON.parse(init.body) });
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : "Error",
      json: async () => responseBody,
    } as Response;
  }) as unknown as typeof fetch;
}

describe("getRelayerEndpoint", () => {
  it("routes Base Sepolia / Sepolia to the testnet host", () => {
    assert.equal(getRelayerEndpoint(BASE_SEPOLIA), RELAYER_TESTNET_URL);
    assert.equal(getRelayerEndpoint(11155111), RELAYER_TESTNET_URL);
  });

  it("routes mainnets to the production host", () => {
    assert.equal(getRelayerEndpoint(BASE_MAINNET), RELAYER_MAINNET_URL);
    assert.equal(getRelayerEndpoint(1), RELAYER_MAINNET_URL);
  });
});

describe("assertFeeWithinSafetyBound (SI-1)", () => {
  it("accepts a fee at or below the $5 USDC bound", () => {
    assert.doesNotThrow(() =>
      assertFeeWithinSafetyBound(RELAYER_FEE_SAFETY_MAX_USDC_ATOMS),
    );
  });

  it("rejects a fee above the bound with a typed error", () => {
    assert.throws(
      () => assertFeeWithinSafetyBound(RELAYER_FEE_SAFETY_MAX_USDC_ATOMS + 1n),
      (err: Error) => err.name === "RelayerFeeOverchargeError",
    );
  });
});

describe("relayerGetCapabilities", () => {
  it("builds the request and decimal-parses tokens", async () => {
    const captured: CapturedRequest[] = [];
    const fetchImpl = mockFetch(
      {
        result: {
          [String(BASE_SEPOLIA)]: {
            feeCollector: FEE_COLLECTOR,
            targetAddress: TARGET,
            tokens: [{ address: USDC, symbol: "USDC", decimals: "6" }],
          },
        },
      },
      { captured },
    );

    const caps = await relayerGetCapabilities({
      chainId: BASE_SEPOLIA,
      fetchImpl,
    });

    assert.equal(captured[0].url, RELAYER_TESTNET_URL);
    assert.equal(captured[0].body.method, "relayer_getCapabilities");
    assert.deepEqual(captured[0].body.params, [String(BASE_SEPOLIA)]);

    assert.equal(caps[BASE_SEPOLIA].targetAddress, TARGET);
    assert.equal(caps[BASE_SEPOLIA].feeCollector, FEE_COLLECTOR);
    assert.equal(caps[BASE_SEPOLIA].tokens[0].decimals, 6);
  });

  it("returns an empty map when the chain is absent from the result", async () => {
    const fetchImpl = mockFetch({ result: {} });
    const caps = await relayerGetCapabilities({
      chainId: BASE_SEPOLIA,
      fetchImpl,
    });
    assert.deepEqual(caps, {});
  });
});

describe("relayerGetFeeData", () => {
  it("maps hex / string fields to bigint + number", async () => {
    const captured: CapturedRequest[] = [];
    const fetchImpl = mockFetch(
      {
        result: {
          gasPrice: "0x6ddd00",
          rate: 1.0,
          minFee: "100000",
          expiry: 1782345678,
          context: "0xabcdef",
        },
      },
      { captured },
    );

    const fee = await relayerGetFeeData({
      chainId: BASE_SEPOLIA,
      token: USDC,
      fetchImpl,
    });

    assert.deepEqual(captured[0].body.params, {
      chainId: String(BASE_SEPOLIA),
      token: USDC,
    });
    assert.equal(fee.gasPrice, BigInt("0x6ddd00"));
    assert.equal(fee.minFee, 100000n);
    assert.equal(fee.tokenDecimals, 6);
    assert.equal(fee.context, "0xabcdef");
  });

  it("tolerates looser wire shapes (bare hex, numbers, fractional)", async () => {
    const fetchImpl = mockFetch({
      result: {
        gasPrice: "6ddd00", // bare hex, no 0x prefix
        rate: 1.0,
        minFee: 100000, // JSON number, not string
        expiry: 1782345678,
      },
    });

    const fee = await relayerGetFeeData({
      chainId: BASE_SEPOLIA,
      token: USDC,
      fetchImpl,
    });

    assert.equal(fee.gasPrice, BigInt("0x6ddd00"));
    assert.equal(fee.minFee, 100000n);
    assert.equal(fee.context, "");
  });

  it("parses the live shape: decimal gasPrice, decimal minFee, rate, token.decimals", async () => {
    // Exact shape observed from relayer.1shotapi.dev for Base Sepolia.
    const fetchImpl = mockFetch({
      result: {
        chainId: "84532",
        gasPrice: "7199999", // decimal wei
        minFee: "0.01", // decimal token amount (0.01 USDC), NOT atoms
        rate: 2000,
        expiry: 1780355565,
        feeCollector: FEE_COLLECTOR,
        targetAddress: TARGET,
        token: { address: USDC, decimals: 6, symbol: "USDC", name: "USDC" },
        context: "{signed}",
      },
    });

    const fee = await relayerGetFeeData({
      chainId: BASE_SEPOLIA,
      token: USDC,
      fetchImpl,
    });

    assert.equal(fee.gasPrice, 7199999n);
    assert.equal(fee.rate, 2000);
    assert.equal(fee.tokenDecimals, 6);
    // "0.01" USDC @ 6dp → 10_000 atoms (NOT 0n / NOT 0.01n).
    assert.equal(fee.minFee, 10_000n);
  });
});

describe("parsePaymentTokenAtoms", () => {
  const M = "relayer_getFeeData";
  it("scales a decimal token amount to atoms", () => {
    assert.equal(parsePaymentTokenAtoms(M, "minFee", "0.01", 6), 10_000n);
    assert.equal(parsePaymentTokenAtoms(M, "minFee", "1.5", 6), 1_500_000n);
    assert.equal(parsePaymentTokenAtoms(M, "minFee", "0.000001", 6), 1n);
  });
  it("truncates fractions finer than the token's decimals", () => {
    assert.equal(parsePaymentTokenAtoms(M, "minFee", "0.0000009", 6), 0n);
  });
  it("treats a bare integer string/number as atoms already", () => {
    assert.equal(parsePaymentTokenAtoms(M, "minFee", "100000", 6), 100_000n);
    assert.equal(parsePaymentTokenAtoms(M, "minFee", 100000, 6), 100_000n);
  });
});

describe("parseRelayerBigInt", () => {
  const M = "relayer_getFeeData";
  it("parses 0x-hex strings", () => {
    assert.equal(parseRelayerBigInt(M, "f", "0x6ddd00"), BigInt("0x6ddd00"));
  });
  it("parses decimal-integer strings", () => {
    assert.equal(parseRelayerBigInt(M, "f", "100000"), 100000n);
  });
  it("parses bare hex (letters, no 0x prefix) as hex", () => {
    assert.equal(parseRelayerBigInt(M, "f", "6ddd00"), BigInt("0x6ddd00"));
  });
  it("parses JSON numbers", () => {
    assert.equal(parseRelayerBigInt(M, "f", 250000), 250000n);
  });
  it("truncates a fractional string toward zero", () => {
    assert.equal(parseRelayerBigInt(M, "f", "100000.75"), 100000n);
    assert.equal(parseRelayerBigInt(M, "f", "0.01"), 0n);
  });
  it("passes through a bigint unchanged", () => {
    assert.equal(parseRelayerBigInt(M, "f", 42n), 42n);
  });
  it("throws a fixed-label error on an unparseable value", () => {
    assert.throws(
      () => parseRelayerBigInt(M, "f", "not-a-number!"),
      (err: Error) => err.message === `${M} request failed`,
    );
    assert.throws(() => parseRelayerBigInt(M, "f", undefined));
    assert.throws(() => parseRelayerBigInt(M, "f", Number.NaN));
  });
});

describe("relayerEstimate7710Transaction", () => {
  it("builds the structured bundle params and returns the locked context", async () => {
    const captured: CapturedRequest[] = [];
    const fetchImpl = mockFetch(
      {
        result: {
          success: true,
          requiredPaymentAmount: "150000",
          paymentTokenAddress: USDC,
          gasUsed: { [String(BASE_SEPOLIA)]: "75000" },
          context: "0xlockedquote",
        },
      },
      { captured },
    );

    const res = await relayerEstimate7710Transaction({
      chainId: BASE_SEPOLIA,
      transactions: [bundle(255n)],
      fetchImpl,
    });

    const params = captured[0].body.params as {
      chainId: string;
      context?: string;
      transactions: Array<{
        permissionContext: unknown[];
        executions: Array<{ target: string; value: string; data: string }>;
      }>;
    };
    assert.equal(captured[0].body.method, "relayer_estimate7710Transaction");
    // chainId is a decimal STRING, not a number.
    assert.equal(params.chainId, String(BASE_SEPOLIA));
    // estimate omits context.
    assert.equal(params.context, undefined);
    // structured bundle: permissionContext + executions(target/value-hex).
    assert.equal(params.transactions[0].permissionContext.length, 1);
    assert.equal(params.transactions[0].executions[0].target, USDC);
    assert.equal(params.transactions[0].executions[0].value, "0xff"); // 255

    assert.equal(res.success, true);
    assert.equal(res.requiredPaymentAmount, 150000n);
    assert.equal(res.paymentTokenAddress, USDC);
    assert.equal(res.context, "0xlockedquote");
  });

  it("returns success:false with the relayer error on simulation failure", async () => {
    const fetchImpl = mockFetch({
      result: { success: false, error: "InsufficientPayment" },
    });
    const res = await relayerEstimate7710Transaction({
      chainId: BASE_SEPOLIA,
      transactions: [bundle()],
      fetchImpl,
    });
    assert.equal(res.success, false);
    assert.equal(res.error, "InsufficientPayment");
  });

  it("fails the estimate when the fee exceeds the SI-1 bound", async () => {
    const fetchImpl = mockFetch({
      result: {
        success: true,
        requiredPaymentAmount: String(RELAYER_FEE_SAFETY_MAX_USDC_ATOMS + 1n),
        context: "0xquote",
      },
    });
    const res = await relayerEstimate7710Transaction({
      chainId: BASE_SEPOLIA,
      transactions: [bundle()],
      fetchImpl,
    });
    assert.equal(res.success, false);
    assert.match(res.error ?? "", /safety bound/);
  });

  it("soft-fails (no throw) on a 5xx transport error", async () => {
    const fetchImpl = mockFetch({}, { status: 503 });
    const res = await relayerEstimate7710Transaction({
      chainId: BASE_SEPOLIA,
      transactions: [bundle()],
      fetchImpl,
    });
    assert.equal(res.success, false);
  });
});

describe("relayerSend7710Transaction", () => {
  it("submits the object params with context and returns the taskId", async () => {
    const captured: CapturedRequest[] = [];
    // The relayer returns the task id directly as the JSON-RPC result.
    const fetchImpl = mockFetch({ result: "0xtaskhash1234" }, { captured });

    const res = await relayerSend7710Transaction({
      chainId: BASE_SEPOLIA,
      transactions: [bundle()],
      context: "0xlockedquote",
      memo: "order-1234",
      destinationUrl: "https://webhook.takumipay.com/tx-updates",
      fetchImpl,
    });

    const params = captured[0].body.params as Record<string, unknown>;
    assert.equal(captured[0].body.method, "relayer_send7710Transaction");
    assert.equal(params.chainId, String(BASE_SEPOLIA));
    assert.equal(params.context, "0xlockedquote");
    assert.equal(params.memo, "order-1234");
    assert.equal(
      params.destinationUrl,
      "https://webhook.takumipay.com/tx-updates",
    );
    // No authorizationList key when none supplied.
    assert.equal("authorizationList" in params, false);

    assert.equal(res.taskId, "0xtaskhash1234");
  });

  it("includes authorizationList when supplied", async () => {
    const captured: CapturedRequest[] = [];
    const fetchImpl = mockFetch({ result: "0xtask" }, { captured });
    await relayerSend7710Transaction({
      chainId: BASE_SEPOLIA,
      transactions: [bundle()],
      context: "0xq",
      authorizationList: [
        {
          address: TARGET,
          chainId: BASE_SEPOLIA,
          nonce: 0,
          r: "0xr",
          s: "0xs",
          yParity: 0,
        },
      ],
      fetchImpl,
    });
    const params = captured[0].body.params as Record<string, unknown>;
    assert.equal(Array.isArray(params.authorizationList), true);
  });

  it("throws a fixed label (no server body) on a JSON-RPC error", async () => {
    const fetchImpl = mockFetch({
      error: { code: 4200, message: "Insufficient Payment" },
    });
    await assert.rejects(
      () =>
        relayerSend7710Transaction({
          chainId: BASE_SEPOLIA,
          transactions: [bundle()],
          context: "0xq",
          fetchImpl,
        }),
      (err: Error) => {
        assert.equal(err.message, "relayer_send7710Transaction request failed");
        assert.doesNotMatch(err.message, /Insufficient Payment/);
        // Numeric code is captured for internal control flow (not in message).
        assert.equal(
          getRelayerErrorCode(err),
          RELAYER_ERROR.INSUFFICIENT_PAYMENT,
        );
        return true;
      },
    );
  });

  it("captures the QUOTE_EXPIRED code (4204) for retry decisions", async () => {
    const fetchImpl = mockFetch({
      error: { code: RELAYER_ERROR.QUOTE_EXPIRED, message: "Quote Expired" },
    });
    await assert.rejects(
      () =>
        relayerSend7710Transaction({
          chainId: BASE_SEPOLIA,
          transactions: [bundle()],
          context: "0xstale",
          fetchImpl,
        }),
      (err: Error) => getRelayerErrorCode(err) === 4204,
    );
  });

  it("getRelayerErrorCode returns undefined for non-relayer errors", () => {
    assert.equal(getRelayerErrorCode(new Error("nope")), undefined);
    assert.equal(getRelayerErrorCode("string"), undefined);
  });
});

describe("relayerGetStatus", () => {
  it("maps numeric status codes and uses {id, logs} params", async () => {
    const captured: CapturedRequest[] = [];
    const fetchImpl = mockFetch(
      {
        result: {
          status: 200,
          receipt: { transactionHash: "0xabc123" },
          memo: "order-1234",
        },
      },
      { captured },
    );

    const status = await relayerGetStatus({
      chainId: BASE_SEPOLIA,
      taskId: "0xtaskhash1234",
      fetchImpl,
    });

    assert.deepEqual(captured[0].body.params, {
      id: "0xtaskhash1234",
      logs: false,
    });
    assert.equal(status.status, "success");
    assert.equal(status.statusCode, 200);
    assert.equal(status.transactionHash, "0xabc123");
    assert.equal(status.memo, "order-1234");
  });

  it("maps 110 → submitted (with hash) and 500 → failed and 100 → pending", async () => {
    const submitted = await relayerGetStatus({
      chainId: BASE_SEPOLIA,
      taskId: "0x1",
      fetchImpl: mockFetch({ result: { status: 110, hash: "0xsubmit" } }),
    });
    assert.equal(submitted.status, "submitted");
    assert.equal(submitted.transactionHash, "0xsubmit");

    const reverted = await relayerGetStatus({
      chainId: BASE_SEPOLIA,
      taskId: "0x2",
      fetchImpl: mockFetch({ result: { status: 500, data: "0xrevert" } }),
    });
    assert.equal(reverted.status, "failed");

    const pending = await relayerGetStatus({
      chainId: BASE_SEPOLIA,
      taskId: "0x3",
      fetchImpl: mockFetch({ result: { status: 100 } }),
    });
    assert.equal(pending.status, "pending");
  });
});
