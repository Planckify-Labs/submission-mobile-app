/**
 * TWV-2026-055 — rollback-prevention guard for EAS Update manifests.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     services/security/updateVerifier.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateManifestForInstall } from "./updateVerifier.pure.ts";

describe("evaluateManifestForInstall", () => {
  it("accepts the first-ever manifest", () => {
    const d = evaluateManifestForInstall(
      { createdAt: "2026-04-16T10:00:00Z" },
      null,
    );
    assert.equal(d.action, "accept");
  });

  it("accepts a strictly newer manifest (ISO timestamp)", () => {
    const d = evaluateManifestForInstall(
      { createdAt: "2026-04-16T11:00:00Z" },
      Date.parse("2026-04-16T10:00:00Z"),
    );
    assert.equal(d.action, "accept");
  });

  it("rejects an older manifest (rollback attack)", () => {
    const d = evaluateManifestForInstall(
      { createdAt: "2026-04-15T10:00:00Z" },
      Date.parse("2026-04-16T10:00:00Z"),
    );
    assert.equal(d.action, "reject");
    if (d.action === "reject") assert.match(d.reason, /rollback blocked/);
  });

  it("rejects the same-timestamp manifest (replay)", () => {
    const sameTs = Date.parse("2026-04-16T10:00:00Z");
    const d = evaluateManifestForInstall(
      { createdAt: "2026-04-16T10:00:00Z" },
      sameTs,
    );
    assert.equal(d.action, "reject");
  });

  it("rejects a manifest without a timestamp", () => {
    const d = evaluateManifestForInstall(
      { createdAt: "not-a-date" },
      Date.parse("2026-04-16T10:00:00Z"),
    );
    assert.equal(d.action, "reject");
  });

  it("accepts an epoch-ms timestamp", () => {
    const d = evaluateManifestForInstall(
      { createdAt: Date.now() + 60_000 },
      Date.now(),
    );
    assert.equal(d.action, "accept");
  });
});
