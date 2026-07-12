import { describe, expect, it } from "vitest";
import {
  base64ToBytes,
  bytesEqual,
  bytesToBase64,
  bytesToUtf8,
  utf8ToBytes,
} from "./bytes";

describe("bytes", () => {
  it("round-trips base64 over every byte value", () => {
    const all = new Uint8Array(256);
    for (let i = 0; i < 256; i++) all[i] = i;

    const encoded = bytesToBase64(all);
    const decoded = base64ToBytes(encoded);

    expect(decoded).toEqual(all);
    // The Hermes failure mode this guards against: a comma-joined stringify
    // of the byte array rather than a real base64 encoding.
    expect(encoded).not.toContain(",");
  });

  it("matches known base64 vectors", () => {
    expect(bytesToBase64(utf8ToBytes("hello"))).toBe("aGVsbG8=");
    expect(bytesToBase64(utf8ToBytes("f"))).toBe("Zg==");
    expect(bytesToBase64(new Uint8Array([]))).toBe("");
    expect(bytesToUtf8(base64ToBytes("aGVsbG8="))).toBe("hello");
  });

  it("round-trips utf8 including multi-byte characters", () => {
    const text = "私のシードフレーズ — café 🔐";
    expect(bytesToUtf8(utf8ToBytes(text))).toBe(text);
  });

  it("compares bytes", () => {
    expect(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(
      true,
    );
    expect(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(
      false,
    );
    expect(bytesEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
  });
});
