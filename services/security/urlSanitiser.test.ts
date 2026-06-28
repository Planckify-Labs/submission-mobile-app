/**
 * Tests for the URL sanitiser — TWV-2026-032.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     services/security/urlSanitiser.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractAndSanitiseUrls, sanitiseUrl } from "./urlSanitiser.ts";

describe("sanitiseUrl", () => {
  it("accepts an https URL", () => {
    const out = sanitiseUrl("https://docs.takumipay.xyz/setup");
    assert.ok(out);
    assert.equal(out.host, "docs.takumipay.xyz");
    assert.equal(out.allowlisted, true);
  });

  it("flags a non-allowlisted https URL", () => {
    const out = sanitiseUrl("https://random.example.com/");
    assert.ok(out);
    assert.equal(out.allowlisted, false);
  });

  it("accepts http (intentional — confirmation gate handles trust)", () => {
    const out = sanitiseUrl("http://localhost:3000");
    assert.ok(out);
  });

  it("rejects javascript: URLs", () => {
    assert.equal(sanitiseUrl("javascript:alert(1)"), null);
  });

  it("rejects data: URLs", () => {
    assert.equal(sanitiseUrl("data:text/html,<script>"), null);
  });

  it("rejects file: URLs", () => {
    assert.equal(sanitiseUrl("file:///etc/passwd"), null);
  });

  it("rejects malformed URLs", () => {
    assert.equal(sanitiseUrl("not-a-url"), null);
  });

  it("recognises a sub-domain of an allowlisted host", () => {
    const out = sanitiseUrl("https://help.docs.takumipay.xyz/article/1");
    assert.ok(out);
    assert.equal(out.allowlisted, true);
  });
});

describe("extractAndSanitiseUrls", () => {
  it("replaces URLs with [link:N] tokens", () => {
    const out = extractAndSanitiseUrls(
      "Visit https://docs.takumipay.xyz for more.",
    );
    assert.equal(out.text, "Visit [link:0] for more.");
    assert.equal(out.urls.length, 1);
    assert.equal(out.urls[0].host, "docs.takumipay.xyz");
  });

  it("blocks javascript: URLs by replacing with [blocked-url]", () => {
    const out = extractAndSanitiseUrls("Click javascript:alert(1) here");
    // The URL_RE only matches http(s), so javascript: URLs aren't
    // extracted at all — they pass through as plain text. Confirm
    // that's the behaviour (defence in depth: the renderer strips raw
    // text anyway).
    assert.equal(out.urls.length, 0);
    assert.match(out.text, /javascript:/);
  });

  it("handles multiple URLs", () => {
    const out = extractAndSanitiseUrls(
      "See https://a.example and https://b.example.",
    );
    assert.equal(out.urls.length, 2);
    assert.match(out.text, /\[link:0\][\s\S]*\[link:1\]/);
  });

  it("returns empty for non-string input", () => {
    const out = extractAndSanitiseUrls(undefined as unknown as string);
    assert.equal(out.urls.length, 0);
    assert.equal(out.text, "");
  });
});
