/**
 * Freighter-protocol lint suite — executes the actual generated script
 * (via `node:vm`, no RN/WebView shims needed since the script has zero
 * module dependencies by design, §5.1) against a minimal fake `window`
 * that emulates same-window `postMessage` + the native
 * `bridge_request`/`bridge_response` round trip.
 *
 * Spec reference: `docs/stellar-dapp-bridge-spec.md` §5.6.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types services/chains/stellar/injectedScript.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import vm from "node:vm";

import { getStellarInjectedScript } from "./injectedScript.ts";

interface FakeWindow {
  location: { href: string; origin: string };
  top: FakeWindow;
  window: FakeWindow;
  addEventListener: (type: string, fn: (e: unknown) => void) => void;
  postMessage: (data: unknown, targetOrigin?: string) => void;
  ReactNativeWebView: { postMessage: (json: string) => void };
  __takumi_stellar_installed?: number;
  __takumi_stellar_nonce?: string;
  freighter?: boolean;
  freighterApi?: Record<string, unknown>;
  _handleEthereumResponse?: (x: unknown) => void;
}

interface Sandbox {
  windowObj: FakeWindow;
  posted: Array<{
    type: string;
    id: string;
    namespace: string;
    method: string;
    params: unknown;
    __takumi_nonce?: string;
  }>;
  /** `takumi_diagnostic`-tagged messages, kept separate from `posted` so
   *  every existing bridge_request-count assertion below stays valid
   *  regardless of how many diagnostic pings fire per inject. */
  diagnostics: Array<{
    type: string;
    tag: string;
    at: number;
    alreadyInstalled: boolean;
    location: string;
  }>;
  /** Dispatch a "message" event with an explicit `source`, bypassing the
   *  fake `postMessage`'s automatic same-window source stamping — used
   *  to simulate a cross-frame message the real listener must ignore. */
  dispatchRaw: (event: { source: unknown; data: unknown }) => void;
}

function createSandbox(sessionNonce?: string): Sandbox {
  const listeners: Record<string, Array<(e: unknown) => void>> = {};
  const posted: Sandbox["posted"] = [];
  const diagnostics: Sandbox["diagnostics"] = [];

  const windowObj = {} as FakeWindow;
  Object.assign(windowObj, {
    location: { href: "https://example.dapp", origin: "https://example.dapp" },
    addEventListener(type: string, fn: (e: unknown) => void) {
      (listeners[type] ??= []).push(fn);
    },
    postMessage(data: unknown) {
      const event = { source: windowObj, data };
      for (const fn of listeners.message ?? []) fn(event);
    },
    ReactNativeWebView: {
      postMessage(json: string) {
        const parsed = JSON.parse(json);
        if (parsed.type === "takumi_diagnostic") diagnostics.push(parsed);
        else posted.push(parsed);
      },
    },
  });
  windowObj.top = windowObj;
  windowObj.window = windowObj;

  const context = vm.createContext({ window: windowObj });
  vm.runInContext(getStellarInjectedScript({ sessionNonce }), context);

  const dispatchRaw = (event: { source: unknown; data: unknown }) => {
    for (const fn of listeners.message ?? []) fn(event);
  };

  return { windowObj, posted, diagnostics, dispatchRaw };
}

/** Wait for a `FREIGHTER_EXTERNAL_MSG_RESPONSE` matching `messagedId`. */
function waitForReply(
  win: FakeWindow,
  messagedId: number,
): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    win.addEventListener("message", (e) => {
      const data = (e as { data?: Record<string, unknown> }).data;
      if (
        data &&
        data.source === "FREIGHTER_EXTERNAL_MSG_RESPONSE" &&
        data.messagedId === messagedId
      ) {
        resolve(data);
      }
    });
  });
}

describe("Stellar injected script — freighter protocol (§5.6)", () => {
  it("window.freighter === true synchronously after injection, before any await", () => {
    const { windowObj } = createSandbox();
    assert.equal(windowObj.freighter, true);
  });

  it("a REQUEST_PUBLIC_KEY request yields exactly one response, forwarding the native result verbatim", async () => {
    const { windowObj, posted } = createSandbox();
    const replyPromise = waitForReply(windowObj, 1);

    windowObj.postMessage({
      source: "FREIGHTER_EXTERNAL_MSG_REQUEST",
      messageId: 1,
      type: 1, // REQUEST_PUBLIC_KEY ordinal
    });

    assert.equal(posted.length, 1);
    assert.equal(posted[0].namespace, "stellar");
    assert.equal(posted[0].method, "REQUEST_PUBLIC_KEY");

    windowObj._handleEthereumResponse?.({
      type: "bridge_response",
      id: posted[0].id,
      result: { publicKey: "" },
      error: null,
    });

    const reply = await replyPromise;
    assert.deepEqual(reply.publicKey, "");
    assert.equal(reply.apiError, undefined);
  });

  it("maps a native error into the SEP-0043 apiError shape even when the internal dispatch throws", async () => {
    const { windowObj, posted } = createSandbox();
    const replyPromise = waitForReply(windowObj, 2);

    windowObj.postMessage({
      source: "FREIGHTER_EXTERNAL_MSG_REQUEST",
      messageId: 2,
      type: 0, // REQUEST_ACCESS ordinal
    });

    windowObj._handleEthereumResponse?.({
      type: "bridge_response",
      id: posted[0].id,
      result: null,
      error: { code: 4001, message: "User rejected the request" },
    });

    const reply = await replyPromise;
    const apiError = reply.apiError as { code: number; message: string };
    assert.equal(apiError.code, -4); // SEP-0043 user-rejected
    assert.equal(apiError.message, "User rejected the request");
  });

  it("still responds when the transport itself throws (no ReactNativeWebView bridge)", async () => {
    const { windowObj } = createSandbox();
    // Simulate a broken transport by deleting the native bridge.
    (
      windowObj as unknown as { ReactNativeWebView?: unknown }
    ).ReactNativeWebView = undefined;
    const replyPromise = waitForReply(windowObj, 3);

    windowObj.postMessage({
      source: "FREIGHTER_EXTERNAL_MSG_REQUEST",
      messageId: 3,
      type: 8, // REQUEST_CONNECTION_STATUS ordinal
    });

    const reply = await replyPromise;
    const apiError = reply.apiError as { code: number; message: string };
    assert.equal(apiError.code, -1);
    assert.match(apiError.message, /bridge transport failed/i);
  });

  it("forwards request fields (e.g. networkPassphrase, submit) unchanged as bridge_request params", () => {
    const { windowObj, posted } = createSandbox();
    windowObj.postMessage({
      source: "FREIGHTER_EXTERNAL_MSG_REQUEST",
      messageId: 4,
      type: 3, // SUBMIT_TRANSACTION ordinal
      transactionXdr: "AAAA...",
      networkPassphrase: "Test SDF Network ; September 2015",
      submit: true,
    });
    assert.equal(posted.length, 1);
    const params = posted[0].params as Record<string, unknown>;
    assert.equal(params.transactionXdr, "AAAA...");
    assert.equal(params.networkPassphrase, "Test SDF Network ; September 2015");
    assert.equal(params.submit, true);
    // The envelope's own protocol fields must never leak into params.
    assert.equal("source" in params, false);
    assert.equal("messageId" in params, false);
    assert.equal("type" in params, false);
  });

  it("re-injecting (simulated navigation) does not double-register the message listener", async () => {
    const { windowObj, posted } = createSandbox();
    // Re-run the same script against the same window — mirrors a second
    // `injectedJavaScriptBeforeContentLoaded` pass.
    const context = vm.createContext({ window: windowObj });
    vm.runInContext(getStellarInjectedScript(), context);

    const replyPromise = waitForReply(windowObj, 5);
    windowObj.postMessage({
      source: "FREIGHTER_EXTERNAL_MSG_REQUEST",
      messageId: 5,
      type: 1,
    });
    assert.equal(posted.length, 1, "only one bridge_request should fire");

    windowObj._handleEthereumResponse?.({
      type: "bridge_response",
      id: posted[0].id,
      result: { publicKey: "GADDR" },
      error: null,
    });
    await replyPromise;
  });

  it("updates the session nonce on re-inject even though install is a no-op", () => {
    const { windowObj } = createSandbox("nonce-1");
    assert.equal(windowObj.__takumi_stellar_nonce, "nonce-1");
    const context = vm.createContext({ window: windowObj });
    vm.runInContext(
      getStellarInjectedScript({ sessionNonce: "nonce-2" }),
      context,
    );
    assert.equal(windowObj.__takumi_stellar_nonce, "nonce-2");
  });

  it("stamps the current nonce onto every outbound bridge_request", () => {
    const { windowObj, posted } = createSandbox("nonce-abc");
    windowObj.postMessage({
      source: "FREIGHTER_EXTERNAL_MSG_REQUEST",
      messageId: 6,
      type: 1,
    });
    assert.equal(posted[0].__takumi_nonce, "nonce-abc");
  });

  it("ignores a message whose source isn't FREIGHTER_EXTERNAL_MSG_REQUEST", () => {
    const { windowObj, posted } = createSandbox();
    windowObj.postMessage({ source: "SOME_OTHER_PROTOCOL", messageId: 7 });
    assert.equal(posted.length, 0);
  });

  it("ignores a message whose event.source !== window (cross-frame)", () => {
    const { posted, dispatchRaw } = createSandbox();
    dispatchRaw({
      source: {}, // a foreign frame's window, not our own
      data: {
        source: "FREIGHTER_EXTERNAL_MSG_REQUEST",
        messageId: 8,
        type: 1,
      },
    });
    assert.equal(posted.length, 0);
  });

  it("REQUEST_ACCESS ordinal maps to the wire method name REQUEST_ACCESS", () => {
    const { windowObj, posted } = createSandbox();
    windowObj.postMessage({
      source: "FREIGHTER_EXTERNAL_MSG_REQUEST",
      messageId: 9,
      type: 0,
    });
    assert.equal(posted[0].method, "REQUEST_ACCESS");
  });

  it("SUBMIT_BLOB ordinal maps to the wire method name SUBMIT_BLOB", () => {
    const { windowObj, posted } = createSandbox();
    windowObj.postMessage({
      source: "FREIGHTER_EXTERNAL_MSG_REQUEST",
      messageId: 10,
      type: 4,
      blob: "hello",
    });
    assert.equal(posted[0].method, "SUBMIT_BLOB");
  });

  it("posts a stellar_inject diagnostic on install, mirroring Solana/Sui's diagnostic ping", () => {
    const { diagnostics } = createSandbox();
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].tag, "stellar_inject");
    assert.equal(diagnostics[0].alreadyInstalled, false);
    assert.equal(diagnostics[0].location, "https://example.dapp");
  });

  it("posts a second stellar_inject diagnostic (alreadyInstalled: true) on re-inject", () => {
    const { windowObj, diagnostics } = createSandbox();
    const context = vm.createContext({ window: windowObj });
    vm.runInContext(getStellarInjectedScript(), context);
    assert.equal(diagnostics.length, 2);
    assert.equal(diagnostics[1].alreadyInstalled, true);
  });
});

describe("Stellar injected script — window.freighterApi convenience object (§5.5)", () => {
  it("getAddress() resolves { address } from the wire's { publicKey } field", async () => {
    const { windowObj, posted } = createSandbox();
    const p = windowObj.freighterApi?.getAddress as () => Promise<{
      address: string;
    }>;
    const resultPromise = p();
    assert.equal(posted[0].method, "REQUEST_PUBLIC_KEY");
    windowObj._handleEthereumResponse?.({
      type: "bridge_response",
      id: posted[0].id,
      result: { publicKey: "GADDR123" },
      error: null,
    });
    const result = await resultPromise;
    assert.equal(result.address, "GADDR123");
  });

  it("signMessage() dispatches SUBMIT_BLOB and remaps the response to { signedMessage, signerAddress }", async () => {
    const { windowObj, posted } = createSandbox();
    const p = windowObj.freighterApi?.signMessage as (
      msg: string,
    ) => Promise<{ signedMessage: string; signerAddress: string }>;
    const resultPromise = p("hello world");
    assert.equal(posted[0].method, "SUBMIT_BLOB");
    assert.equal((posted[0].params as { blob: string }).blob, "hello world");
    windowObj._handleEthereumResponse?.({
      type: "bridge_response",
      id: posted[0].id,
      result: { signedBlob: "deadbeef", signerAddress: "GADDR123" },
      error: null,
    });
    const result = await resultPromise;
    assert.equal(result.signedMessage, "deadbeef");
    assert.equal(result.signerAddress, "GADDR123");
  });
});
