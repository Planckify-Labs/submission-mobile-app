/**
 * Unit tests for the agent session dispatcher + event router.
 *
 * The mobile-app repo does not ship a test framework, so these tests
 * use Node's built-in `node:test` runner with type stripping — the
 * same pattern as `services/permissionGrantStore.test.ts`. Run from
 * the mobile-app root with:
 *
 *     node --test --experimental-strip-types services/agentSession/agentSession.test.ts
 *
 * We mock the fetch primitive the dispatcher uses for `rejectTool` /
 * `postRespond` by replacing `globalThis.fetch` before each test.
 * We do NOT exercise the SSE client (`sseClient.ts`) here — it pulls
 * in `expo/fetch`, which isn't importable in plain Node. Integration
 * coverage of the transport will come via an e2e pass once the chat
 * screen is wired up.
 */

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  type GrantStorageAdapter,
  PermissionGrantStore,
} from "../permissionGrantStore.ts";
import {
  type ConnectedWallet,
  HOT_WALLET_POLICY,
  WATCH_ONLY_POLICY,
} from "../resolveUxTreatment.ts";
import {
  __testing,
  type AgentSession,
  createAgentSession,
} from "./agentSession.ts";
import { handleToolPending } from "./dispatcher.ts";
import type {
  AgentEvent,
  ToolPendingPayload,
  WalletContext,
} from "./protocol.ts";

// --- Test scaffolding -------------------------------------------------------

const WALLET_ADDRESS = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

function makeInMemoryAdapter(): GrantStorageAdapter {
  const map = new Map<string, string>();
  return {
    getItem: async (key) => map.get(key) ?? null,
    setItem: async (key, value) => {
      map.set(key, value);
    },
    deleteItem: async (key) => {
      map.delete(key);
    },
  };
}

function makeHotWallet(): ConnectedWallet {
  return {
    address: WALLET_ADDRESS,
    approvalPolicy: HOT_WALLET_POLICY,
    grantStore: PermissionGrantStore.conservative(
      WALLET_ADDRESS,
      makeInMemoryAdapter(),
    ),
  };
}

function makeWatchOnlyWallet(): ConnectedWallet {
  return {
    address: WALLET_ADDRESS,
    approvalPolicy: WATCH_ONLY_POLICY,
    grantStore: PermissionGrantStore.conservative(
      WALLET_ADDRESS,
      makeInMemoryAdapter(),
    ),
  };
}

function makeWalletContext(): WalletContext {
  return {
    address: WALLET_ADDRESS,
    chain_id: 1,
    chain_name: "Ethereum",
    chain_symbol: "ETH",
  };
}

interface CapturedFetchCall {
  url: string;
  body: unknown;
}

/**
 * Replaces `globalThis.fetch` with a stub that records each call and
 * always resolves to `{ ok: true }`. Returns the captured-calls array
 * so tests can assert on body shape.
 */
function installFetchStub(): CapturedFetchCall[] {
  const captured: CapturedFetchCall[] = [];
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    url: string,
    init?: RequestInit,
  ) => {
    let body: unknown = null;
    if (init?.body && typeof init.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    captured.push({ url, body });
    return {
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({}),
    };
  };
  return captured;
}

function makeSession(
  wallet: ConnectedWallet,
  overrides: Partial<AgentSession> = {},
): AgentSession {
  // Build via the factory so we exercise the real shape, then allow
  // targeted overrides (e.g. replace `start` with a no-op so we
  // never touch the SSE transport).
  const session = createAgentSession({
    session_id: "test-session",
    wallet_context: makeWalletContext(),
    messages: [],
    executorContext: {} as unknown as AgentSession["executorContext"],
    connectedWallet: wallet,
    ui: {
      appendText: () => {},
      showStatus: () => {},
      showPreviewCard: () => {},
      showApprovalSheet: () => {},
      showError: () => {},
      done: () => {},
    },
  });
  return Object.assign(session, overrides);
}

function makeToolPending(
  toolCallId: string,
  name = "send_native_token",
): ToolPendingPayload {
  return {
    session_id: "test-session",
    tool_call_id: toolCallId,
    name,
    input: { chain_id: 1, to: WALLET_ADDRESS, amount_wei: "1" },
    meta: {
      executor: "mobile",
      capability: "write",
      category: "blockchain_write",
      human_summary: `Call ${name}`,
    },
  };
}

// --- Test setup -------------------------------------------------------------

beforeEach(() => {
  process.env.EXPO_PUBLIC_AI_API_URL = "https://agent.test.local";
  process.env.EXPO_PUBLIC_SECRET_AI_KEY = "test-key";
});

// --- Tests ------------------------------------------------------------------

describe("agentSession — event router", () => {
  it("unknown event type warns and does not crash", async () => {
    const session = makeSession(makeHotWallet());
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => warnings.push(String(msg));
    try {
      await __testing.routeEvent(
        { event: "nope", data: {} } as unknown as AgentEvent,
        session,
      );
    } finally {
      console.warn = origWarn;
    }
    assert.ok(warnings.length > 0, "should have logged a warning");
    assert.match(warnings[0]!, /unknown SSE event type/);
  });

  it("done event closes SSE and empties pending_approvals", async () => {
    const session = makeSession(makeHotWallet());
    session.pending_approvals.set("tool-1", makeToolPending("tool-1"));
    assert.equal(session.pending_approvals.size, 1);

    let stopped = false;
    const origStop = session.stop;
    session.stop = () => {
      stopped = true;
      origStop.call(session);
    };

    const event: AgentEvent = {
      event: "done",
      data: {
        session_id: "test-session",
        usage: { prompt_tokens: 0, completion_tokens: 0 },
      },
    };
    await __testing.routeEvent(event, session);

    assert.equal(session.pending_approvals.size, 0);
    assert.equal(stopped, true);
  });

  it("error retryable=false stops the session", async () => {
    const session = makeSession(makeHotWallet());
    let stopped = false;
    const origStop = session.stop;
    session.stop = () => {
      stopped = true;
      origStop.call(session);
    };

    const event: AgentEvent = {
      event: "error",
      data: { code: "overloaded", message: "nope", retryable: false },
    };
    await __testing.routeEvent(event, session);
    assert.equal(stopped, true);
  });

  it("adopts server-assigned session_id from tool_pending payload", async () => {
    const session = makeSession(makeHotWallet());
    assert.equal(session.session_id, "test-session");

    const event: AgentEvent = {
      event: "tool_pending",
      data: {
        session_id: "server-minted-uuid",
        tool_call_id: "tool-sync-1",
        name: "send_native_token",
        input: { chain_id: 1, to: WALLET_ADDRESS, amount_wei: "1" },
        meta: {
          executor: "mobile",
          capability: "write",
          category: "blockchain_write",
          human_summary: "Call send_native_token",
        },
      },
    };
    // Route via __testing so we don't actually dispatch the tool.
    await __testing.routeEvent(event, session);
    assert.equal(session.session_id, "server-minted-uuid");
  });

  it("adopts server-assigned session_id from done payload", async () => {
    const session = makeSession(makeHotWallet());
    const event: AgentEvent = {
      event: "done",
      data: {
        session_id: "server-minted-done",
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      },
    };
    await __testing.routeEvent(event, session);
    assert.equal(session.session_id, "server-minted-done");
  });

  it("session_id adoption is idempotent — same id is a noop", async () => {
    const session = makeSession(makeHotWallet());
    session.session_id = "already-synced";

    // Wrap the setter to count writes.
    let writes = 0;
    let backing = session.session_id;
    Object.defineProperty(session, "session_id", {
      get: () => backing,
      set: (v: string) => {
        writes += 1;
        backing = v;
      },
      configurable: true,
    });

    const event: AgentEvent = {
      event: "done",
      data: {
        session_id: "already-synced",
        usage: { prompt_tokens: 0, completion_tokens: 0 },
      },
    };
    await __testing.routeEvent(event, session);
    assert.equal(writes, 0, "no write when id already matches");
    assert.equal(backing, "already-synced");
  });

  it("error retryable=true does NOT stop the session", async () => {
    const session = makeSession(makeHotWallet());
    let stopped = false;
    const origStop = session.stop;
    session.stop = () => {
      stopped = true;
      origStop.call(session);
    };

    const event: AgentEvent = {
      event: "error",
      data: { code: "rate_limited", message: "slow down", retryable: true },
    };
    await __testing.routeEvent(event, session);
    assert.equal(stopped, false);
  });
});

describe("agentSession — dispatcher", () => {
  it("deduplicates tool_pending by tool_call_id", async () => {
    const captured = installFetchStub();
    const session = makeSession(makeHotWallet());
    let showApprovalCalls = 0;
    session.ui.showApprovalSheet = () => {
      showApprovalCalls += 1;
    };

    const payload = makeToolPending("tool-dedupe");
    await handleToolPending(payload, session);
    await handleToolPending(payload, session);

    assert.equal(showApprovalCalls, 1, "approval sheet shown exactly once");
    assert.equal(session.pending_approvals.size, 1);
    assert.equal(captured.length, 0, "no network calls on dedupe");
  });

  it("watch-only wallet (deny) posts tool_rejected with permission_denied", async () => {
    // Deny-layer §6.3: a watch-only wallet resolves to `deny` (reason
    // `watch_only`), which maps to the single wire token
    // `permission_denied` — the specific reason stays in __DEV__ logs.
    const captured = installFetchStub();
    const session = makeSession(makeWatchOnlyWallet());
    const payload = makeToolPending("tool-blocked");

    await handleToolPending(payload, session);

    assert.equal(captured.length, 1, "one reject call");
    const { url, body } = captured[0]!;
    assert.match(url, /\/chat\/respond/);
    const typedBody = body as {
      type: string;
      session_id: string;
      tool_call_id: string;
      reason: string;
    };
    assert.equal(typedBody.type, "tool_rejected");
    assert.equal(typedBody.reason, "permission_denied");
    assert.equal(typedBody.tool_call_id, "tool-blocked");
    assert.equal(session.pending_approvals.size, 0);
  });

  it("ask write opens the approval sheet and does NOT execute or auto-resolve", async () => {
    // A write with no grant under HOT policy → `ask`. The hard invariant
    // (INV-1/§4.1): nothing executes and nothing is posted to the server
    // on inaction — the call just waits on the user.
    const captured = installFetchStub();
    const session = makeSession(makeHotWallet());
    let approvalShown = 0;
    session.ui.showApprovalSheet = () => {
      approvalShown += 1;
    };
    const payload = makeToolPending("tool-ask");

    await handleToolPending(payload, session);

    assert.equal(
      approvalShown,
      1,
      "approval sheet shown once (no proposal host)",
    );
    assert.equal(captured.length, 0, "nothing posted — no execute, no reject");
    assert.equal(
      session.pending_approvals.size,
      1,
      "still pending on the user",
    );
  });

  it("headless ask write fails closed → permission_denied", async () => {
    // No human present (`interactive: false`) + a would-be `ask` write →
    // deny(approval_unavailable) → wire reason permission_denied.
    const captured = installFetchStub();
    const session = makeSession(makeHotWallet(), { interactive: false });
    const payload = makeToolPending("tool-headless");

    await handleToolPending(payload, session);

    assert.equal(captured.length, 1, "one reject call");
    const body = captured[0]!.body as { type: string; reason: string };
    assert.equal(body.type, "tool_rejected");
    assert.equal(body.reason, "permission_denied");
    assert.equal(session.pending_approvals.size, 0);
  });

  it("authorized write shows the run-down and does NOT auto-execute synchronously", async () => {
    // Full-auto (global permanent grant) → authorized write → run-down
    // veto card. The card owns the countdown; the dispatcher must not
    // execute or post anything synchronously.
    const captured = installFetchStub();
    const wallet = makeHotWallet();
    wallet.grantStore.add({
      scope: { kind: "global" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_ADDRESS,
      granted_at: Date.now(),
    });
    const session = makeSession(wallet);
    let previewShown = 0;
    session.ui.showPreviewCard = () => {
      previewShown += 1;
    };
    const payload = makeToolPending("tool-authorized");

    await handleToolPending(payload, session);

    assert.equal(previewShown, 1, "run-down card shown once");
    assert.equal(captured.length, 0, "no synchronous execute/post");
    assert.equal(
      session.pending_approvals.size,
      1,
      "pending until the veto window resolves",
    );
  });
});
