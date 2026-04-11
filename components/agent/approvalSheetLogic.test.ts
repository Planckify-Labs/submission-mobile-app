/**
 * Unit tests for the pure logic exported by `approvalSheetLogic.ts`.
 *
 * Matches the convention established by `services/permissionGrantStore.test.ts`:
 * uses Node's built-in `node:test` runner with type stripping, no RN runtime.
 *
 * Run from the mobile-app root with:
 *     node --test --experimental-strip-types \
 *          components/agent/approvalSheetLogic.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PermissionGrant } from "../../services/permissionGrantStore.ts";
import {
  buildApprovalSheetHandlers,
  buildGrantOptions,
  DEFAULT_DURATION_PRESET_ID,
  DURATION_PRESETS,
  type GrantChoice,
  specialWarning,
  type ToolPendingPayload,
} from "./approvalSheetLogic.ts";

const SESSION_ID = "session-123";
const TOOL_NAME = "send_native_token";

const samplePayload: ToolPendingPayload = {
  tool_call_id: "call-1",
  name: TOOL_NAME,
  meta: {
    human_summary: "Send 0.5 ETH to 0x1234",
    capability: "write",
  },
};

describe("buildGrantOptions", () => {
  it("returns exactly 5 options in the spec-defined order", () => {
    const options = buildGrantOptions(SESSION_ID, TOOL_NAME);
    assert.equal(options.length, 5);
    assert.deepEqual(
      options.map((o) => o.id),
      ["once", "session", "timed_relative", "timed_until", "permanent"],
    );
  });

  it("labels match the spec sketch", () => {
    const [once, session, timedRel, timedUntil, always] = buildGrantOptions(
      SESSION_ID,
      TOOL_NAME,
    );
    assert.equal(once!.label, "Just this once");
    assert.equal(session!.label, "For this session");
    assert.equal(timedRel!.label, "For the next");
    assert.equal(timedUntil!.label, "Until");
    assert.equal(always!.label, "Always (manage in Settings)");
  });

  it("first option ('Just this once') is the conservative default", () => {
    // Contract: the component selects index 0 by default, and index 0 must be
    // the most conservative `{ type: "once" }` option.
    const options = buildGrantOptions(SESSION_ID, TOOL_NAME);
    assert.equal(options[0]!.id, "once");
    assert.equal(options[0]!.lifetime.type, "once");
  });

  it("session option embeds the given sessionId", () => {
    const options = buildGrantOptions(SESSION_ID, TOOL_NAME);
    const session = options.find((o) => o.id === "session")!;
    assert.equal(session.lifetime.type, "session");
    if (session.lifetime.type === "session") {
      assert.equal(session.lifetime.session_id, SESSION_ID);
    }
  });

  it("all options default to tool-level scope for the given tool name", () => {
    const options = buildGrantOptions(SESSION_ID, TOOL_NAME);
    for (const opt of options) {
      assert.deepEqual(opt.scope, { kind: "tool", key: TOOL_NAME });
    }
  });

  it("timed_relative defaults to `now + 1 hour`", () => {
    const now = 1_000_000_000_000;
    const options = buildGrantOptions(SESSION_ID, TOOL_NAME, now);
    const timedRel = options.find((o) => o.id === "timed_relative")!;
    assert.equal(timedRel.lifetime.type, "timed");
    if (timedRel.lifetime.type === "timed") {
      assert.equal(timedRel.lifetime.expires_at, now + 60 * 60 * 1000);
    }
  });

  it("timed_until uses `expires_at: 0` sentinel until user picks a date", () => {
    const options = buildGrantOptions(SESSION_ID, TOOL_NAME);
    const timedUntil = options.find((o) => o.id === "timed_until")!;
    assert.equal(timedUntil.lifetime.type, "timed");
    if (timedUntil.lifetime.type === "timed") {
      assert.equal(timedUntil.lifetime.expires_at, 0);
    }
  });

  it("permanent option is `{ type: 'permanent' }`", () => {
    const options = buildGrantOptions(SESSION_ID, TOOL_NAME);
    const perm = options.find((o) => o.id === "permanent")!;
    assert.deepEqual(perm.lifetime, { type: "permanent" });
  });
});

describe("DURATION_PRESETS", () => {
  it("offers exactly the four spec presets in order", () => {
    assert.deepEqual(
      DURATION_PRESETS.map((p) => p.id),
      ["15m", "1h", "4h", "24h"],
    );
  });

  it("default preset is 1 hour", () => {
    assert.equal(DEFAULT_DURATION_PRESET_ID, "1h");
  });

  it("preset ms values match their human labels", () => {
    const byId = Object.fromEntries(DURATION_PRESETS.map((p) => [p.id, p.ms]));
    assert.equal(byId["15m"], 15 * 60 * 1000);
    assert.equal(byId["1h"], 60 * 60 * 1000);
    assert.equal(byId["4h"], 4 * 60 * 60 * 1000);
    assert.equal(byId["24h"], 24 * 60 * 60 * 1000);
  });
});

describe("specialWarning", () => {
  it("returns the ERC-20 approval warning for `approve_erc20`", () => {
    const w = specialWarning("approve_erc20");
    assert.ok(w);
    assert.match(w!, /permission to spend your tokens/);
  });

  it("returns the cancellation warning for `cancel_booking`", () => {
    const w = specialWarning("cancel_booking");
    assert.ok(w);
    assert.match(w!, /irreversible/);
  });

  it("returns undefined for an unknown tool", () => {
    assert.equal(specialWarning("unknown_tool"), undefined);
  });

  it("returns undefined for an empty string", () => {
    assert.equal(specialWarning(""), undefined);
  });
});

describe("buildApprovalSheetHandlers.onApprove", () => {
  function makeHarness() {
    let executed = 0;
    let rejectedWith: string | null = null;
    const persisted: PermissionGrant[] = [];
    const handlers = buildApprovalSheetHandlers({
      payload: samplePayload,
      sessionId: SESSION_ID,
      onExecute: () => {
        executed += 1;
      },
      onReject: (reason) => {
        rejectedWith = reason;
      },
      onPersistGrant: (grant) => {
        persisted.push(grant);
      },
    });
    return {
      handlers,
      get executed() {
        return executed;
      },
      get rejectedWith() {
        return rejectedWith;
      },
      persisted,
    };
  }

  it("`once` choice does NOT persist a grant but DOES execute", () => {
    const h = makeHarness();
    const choice: GrantChoice = {
      scope: { kind: "tool", key: TOOL_NAME },
      lifetime: { type: "once" },
    };
    h.handlers.onApprove(choice);
    assert.equal(h.persisted.length, 0);
    assert.equal(h.executed, 1);
  });

  it("`permanent` choice persists a grant with the correct shape and executes", () => {
    const h = makeHarness();
    const choice: GrantChoice = {
      scope: { kind: "tool", key: TOOL_NAME },
      lifetime: { type: "permanent" },
    };
    const before = Date.now();
    h.handlers.onApprove(choice);
    const after = Date.now();

    assert.equal(h.persisted.length, 1);
    const grant = h.persisted[0]!;
    assert.deepEqual(grant.scope, { kind: "tool", key: TOOL_NAME });
    assert.deepEqual(grant.lifetime, { type: "permanent" });
    // Task 09 will thread the real wallet address; today it's the 0x0
    // placeholder documented on the factory.
    assert.equal(grant.wallet_address, "0x0");
    assert.ok(grant.granted_at >= before && grant.granted_at <= after);
    assert.equal(h.executed, 1);
  });

  it("`timed` choice persists the exact lifetime we were given", () => {
    const h = makeHarness();
    const expiresAt = Date.now() + 3_600_000;
    const choice: GrantChoice = {
      scope: { kind: "tool", key: TOOL_NAME },
      lifetime: { type: "timed", expires_at: expiresAt },
    };
    h.handlers.onApprove(choice);
    assert.equal(h.persisted.length, 1);
    assert.deepEqual(h.persisted[0]!.lifetime, {
      type: "timed",
      expires_at: expiresAt,
    });
    assert.equal(h.executed, 1);
  });

  it("`session` choice persists the session lifetime verbatim", () => {
    const h = makeHarness();
    const choice: GrantChoice = {
      scope: { kind: "tool", key: TOOL_NAME },
      lifetime: { type: "session", session_id: SESSION_ID },
    };
    h.handlers.onApprove(choice);
    assert.equal(h.persisted.length, 1);
    assert.deepEqual(h.persisted[0]!.lifetime, {
      type: "session",
      session_id: SESSION_ID,
    });
  });
});

describe("buildApprovalSheetHandlers.onReject", () => {
  it("always reports reason `user_declined`", () => {
    let reason: string | null = null;
    const { onReject } = buildApprovalSheetHandlers({
      payload: samplePayload,
      sessionId: SESSION_ID,
      onExecute: () => {
        throw new Error("onExecute should not be called on reject");
      },
      onReject: (r) => {
        reason = r;
      },
      onPersistGrant: () => {
        throw new Error("onPersistGrant should not be called on reject");
      },
    });
    onReject();
    assert.equal(reason, "user_declined");
  });
});
