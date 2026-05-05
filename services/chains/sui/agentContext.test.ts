/**
 * Agent-context builder tests — JSON-safe, secret-free, MoveCall summary
 * line. Parity with `services/chains/solana/agentContext.test.ts`.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types services/chains/sui/agentContext.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ApprovalIntent } from "../../bridge/approval.ts";
import { buildAgentContext } from "./agentContext.ts";
import type { SuiApprovalPayload } from "./payloads.ts";

const SUI_ADDR = "0x" + "ab".repeat(32);
const OTHER_ADDR = "0x" + "cd".repeat(32);

function makeIntent<P extends SuiApprovalPayload>(
  kind: ApprovalIntent["kind"],
  payload: P,
): ApprovalIntent<P> {
  return {
    id: "test-id",
    namespace: "sui",
    kind,
    origin: { url: "https://app.example", title: "Example dApp" },
    wallet: null,
    payload,
    annotations: [
      {
        code: "siws.domain-mismatch",
        severity: "danger",
        title: "Domain mismatch",
        source: "local",
      },
    ],
    createdAt: 1700000000000,
  };
}

describe("buildAgentContext — JSON-safe", () => {
  it("round-trips through JSON.stringify without throwing on bigints", () => {
    const ctx = buildAgentContext(
      makeIntent("signTransaction", {
        kind: "signTransaction",
        mode: "sign-only",
        address: SUI_ADDR,
        network: "mainnet",
        transaction: "AAA=",
        gasBudget: 10_000_000n,
        gasPrice: 1000n,
        sender: SUI_ADDR,
        gasOwner: SUI_ADDR,
      }),
    );
    // bigints are coerced — JSON.stringify on a bigint throws, so this
    // would fail if we left a stray bigint anywhere in the output.
    const json = JSON.stringify(ctx);
    assert.ok(typeof json === "string");
    assert.ok(json.includes(`"gasBudgetMist":"10000000"`));
    assert.ok(json.includes(`"gasPriceMist":"1000"`));
  });
});

describe("buildAgentContext — origin & annotations", () => {
  it("propagates origin host + annotations", () => {
    const ctx = buildAgentContext(
      makeIntent("connect", {
        kind: "connect",
        network: "mainnet",
        onlyIfTrusted: false,
      }),
    );
    assert.equal(ctx.origin.host, "app.example");
    assert.equal(ctx.origin.title, "Example dApp");
    assert.equal(ctx.annotations.length, 1);
    assert.equal(ctx.annotations[0].code, "siws.domain-mismatch");
  });
});

describe("buildAgentContext — connect", () => {
  it("connect carries network + onlyIfTrusted", () => {
    const ctx = buildAgentContext(
      makeIntent("connect", {
        kind: "connect",
        network: "testnet",
        onlyIfTrusted: true,
      }),
    );
    assert.equal(ctx.intent.kind, "connect");
    if (ctx.intent.kind === "connect") {
      assert.equal(ctx.intent.network, "testnet");
      assert.equal(ctx.intent.onlyIfTrusted, true);
    }
  });
});

describe("buildAgentContext — signMessage", () => {
  it("truncates messagePreview to 16 chars in utf8 mode", () => {
    const longMessage = "A".repeat(50);
    const ctx = buildAgentContext(
      makeIntent("signMessage", {
        kind: "signMessage",
        address: SUI_ADDR,
        message: longMessage,
        display: "utf8",
      }),
    );
    assert.equal(ctx.intent.kind, "signMessage");
    if (ctx.intent.kind === "signMessage") {
      assert.equal(ctx.intent.messagePreview?.length, 16);
      assert.equal(ctx.intent.messageLength, 50);
    }
  });

  it("messagePreview is undefined in base64 mode (no peek into opaque bytes)", () => {
    const ctx = buildAgentContext(
      makeIntent("signMessage", {
        kind: "signMessage",
        address: SUI_ADDR,
        message: "AAAA",
        display: "base64",
      }),
    );
    if (ctx.intent.kind === "signMessage") {
      assert.equal(ctx.intent.messagePreview, undefined);
    }
  });
});

describe("buildAgentContext — signTransaction sponsored detection", () => {
  it("sponsored=true when gasOwner !== sender", () => {
    const ctx = buildAgentContext(
      makeIntent("signTransaction", {
        kind: "signTransaction",
        mode: "sign-and-execute",
        address: SUI_ADDR,
        network: "mainnet",
        transaction: "AAA=",
        sender: SUI_ADDR,
        gasOwner: OTHER_ADDR,
      }),
    );
    if (ctx.intent.kind === "signTransaction") {
      assert.equal(ctx.intent.sponsored, true);
    }
  });

  it("sponsored=false when gasOwner === sender", () => {
    const ctx = buildAgentContext(
      makeIntent("signTransaction", {
        kind: "signTransaction",
        mode: "sign-only",
        address: SUI_ADDR,
        network: "mainnet",
        transaction: "AAA=",
        sender: SUI_ADDR,
        gasOwner: SUI_ADDR,
      }),
    );
    if (ctx.intent.kind === "signTransaction") {
      assert.equal(ctx.intent.sponsored, false);
    }
  });

  it("sponsored=false when sender unknown (sponsored is opt-in, not implied)", () => {
    const ctx = buildAgentContext(
      makeIntent("signTransaction", {
        kind: "signTransaction",
        mode: "sign-only",
        address: SUI_ADDR,
        network: "mainnet",
        transaction: "AAA=",
      }),
    );
    if (ctx.intent.kind === "signTransaction") {
      assert.equal(ctx.intent.sponsored, false);
    }
  });
});

describe("buildAgentContext — MoveCall summary line (highest-leverage signal)", () => {
  it("emits the 0x<package>::<module>::<function> argc=N typeArgs=M shape", () => {
    const ctx = buildAgentContext(
      makeIntent("signTransaction", {
        kind: "signTransaction",
        mode: "sign-only",
        address: SUI_ADDR,
        network: "mainnet",
        transaction: "AAA=",
        decoded: [
          {
            kind: "MoveCall",
            package: "0x2",
            module: "coin",
            function: "split",
            argumentCount: 2,
            typeArgumentCount: 1,
          },
        ],
      }),
    );
    if (ctx.intent.kind === "signTransaction") {
      assert.equal(ctx.intent.decoded.length, 1);
      assert.match(
        ctx.intent.decoded[0].summary ?? "",
        /MoveCall 0x2::coin::split argc=2 typeArgs=1/,
      );
    }
  });

  it("Upgrade and Publish are distinguishable in summary", () => {
    const ctx = buildAgentContext(
      makeIntent("signTransaction", {
        kind: "signTransaction",
        mode: "sign-only",
        address: SUI_ADDR,
        network: "mainnet",
        transaction: "AAA=",
        decoded: [
          { kind: "Publish", modules: 2, dependencies: 5 },
          { kind: "Upgrade", modules: 1, dependencies: 3 },
        ],
      }),
    );
    if (ctx.intent.kind === "signTransaction") {
      assert.match(ctx.intent.decoded[0].summary ?? "", /^Publish 2 modules/);
      assert.match(ctx.intent.decoded[1].summary ?? "", /^Upgrade 1 modules/);
    }
  });
});

describe("buildAgentContext — simulation summary fan-out", () => {
  it("collapses balance/object change arrays to counts and sums gasUsed", () => {
    const ctx = buildAgentContext(
      makeIntent("signTransaction", {
        kind: "signTransaction",
        mode: "sign-only",
        address: SUI_ADDR,
        network: "mainnet",
        transaction: "AAA=",
        simulation: {
          status: "success",
          gasUsed: {
            computation: 1_000_000n,
            storage: 500_000n,
            storageRebate: 100_000n,
            nonRefundableStorageFee: 0n,
          },
          balanceChanges: [
            { owner: SUI_ADDR, coinType: "0x2::sui::SUI", amount: -10n },
          ],
          objectChanges: [
            { kind: "deleted", objectId: "0xabc" },
            { kind: "transferred", recipient: OTHER_ADDR },
          ],
          warnings: [{ code: "object.delete", objectId: "0xabc" }],
        },
      }),
    );
    if (ctx.intent.kind === "signTransaction" && ctx.intent.simulation) {
      assert.equal(ctx.intent.simulation.status, "success");
      // 1_000_000 + 500_000 - 100_000 = 1_400_000
      assert.equal(ctx.intent.simulation.gasUsedTotalMist, "1400000");
      assert.equal(ctx.intent.simulation.balanceChangeCount, 1);
      assert.equal(ctx.intent.simulation.objectChangeCount, 2);
      assert.equal(ctx.intent.simulation.warnings.length, 1);
    }
  });
});

describe("buildAgentContext — switchNetwork", () => {
  it("carries from + to", () => {
    const ctx = buildAgentContext(
      makeIntent("switchNetwork", {
        kind: "switchNetwork",
        from: "mainnet",
        to: "devnet",
      }),
    );
    if (ctx.intent.kind === "switchNetwork") {
      assert.equal(ctx.intent.from, "mainnet");
      assert.equal(ctx.intent.to, "devnet");
    }
  });
});

describe("buildAgentContext — secret-free invariant", () => {
  it("never carries the raw signature or seed-shaped fields", () => {
    const ctx = buildAgentContext(
      makeIntent("signMessage", {
        kind: "signMessage",
        address: SUI_ADDR,
        message: "the secret message that must not leak",
        display: "utf8",
      }),
    );
    const json = JSON.stringify(ctx);
    // Whole message body must not appear (only first 16 chars).
    assert.ok(!json.includes("the secret message that must not leak"));
    assert.ok(!/signature/i.test(json));
    assert.ok(!/privateKey/i.test(json));
    assert.ok(!/mnemonic/i.test(json));
  });
});
