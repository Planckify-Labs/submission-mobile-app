/**
 * Unit tests for `toAgentMessages`.
 *
 *     node --test --experimental-strip-types services/agent-messages/translate.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type ServerModelMessage, toAgentMessages } from "./translate.ts";

describe("toAgentMessages", () => {
  it("translates a pure-text user turn", () => {
    const input: ServerModelMessage[] = [
      {
        role: "user",
        content: "hello",
        id: "u1",
        created_at: "2026-04-15T00:00:00Z",
      },
    ];
    const result = toAgentMessages(input);
    assert.deepEqual(result, [
      {
        id: "u1",
        role: "user",
        parts: [{ type: "text", text: "hello" }],
        createdAt: "2026-04-15T00:00:00Z",
      },
    ]);
  });

  it("translates a pure-text assistant turn", () => {
    const input: ServerModelMessage[] = [
      {
        role: "assistant",
        content: [{ type: "text", text: "hi there" }],
        id: "a1",
      },
    ];
    const result = toAgentMessages(input);
    assert.equal(result.length, 1);
    assert.equal(result[0].role, "assistant");
    assert.deepEqual(result[0].parts, [{ type: "text", text: "hi there" }]);
  });

  it("pairs tool-call with tool-result by toolCallId and unwraps json output", () => {
    const input: ServerModelMessage[] = [
      {
        role: "assistant",
        id: "a1",
        content: [
          { type: "text", text: "checking balance" },
          {
            type: "tool-call",
            toolCallId: "tc1",
            toolName: "getBalance",
            input: { token: "ETH" },
          },
        ],
      },
      {
        role: "tool",
        id: "t1",
        content: [
          {
            type: "tool-result",
            toolCallId: "tc1",
            toolName: "getBalance",
            output: { type: "json", value: { balance: "0.5" } },
          },
        ],
      },
    ];
    const result = toAgentMessages(input);
    assert.equal(result.length, 1, "tool message should be folded in");
    assert.equal(result[0].role, "assistant");
    assert.equal(result[0].parts.length, 2);
    assert.deepEqual(result[0].parts[0], {
      type: "text",
      text: "checking balance",
    });
    const toolPart = result[0].parts[1];
    assert.equal(toolPart.type, "tool");
    if (toolPart.type !== "tool") return;
    assert.equal(toolPart.toolCallId, "tc1");
    assert.equal(toolPart.toolName, "getBalance");
    assert.deepEqual(toolPart.input, { token: "ETH" });
    assert.deepEqual(toolPart.output, { balance: "0.5" });
    assert.equal(toolPart.state, "output-available");
  });

  it("preserves part ordering across multiple tool calls", () => {
    const input: ServerModelMessage[] = [
      {
        role: "assistant",
        id: "a1",
        content: [
          { type: "text", text: "first" },
          { type: "tool-call", toolCallId: "tc1", toolName: "A", input: {} },
          { type: "text", text: "middle" },
          { type: "tool-call", toolCallId: "tc2", toolName: "B", input: {} },
          { type: "text", text: "last" },
        ],
      },
      {
        role: "tool",
        id: "t1",
        content: [
          {
            type: "tool-result",
            toolCallId: "tc1",
            output: { type: "json", value: 1 },
          },
          {
            type: "tool-result",
            toolCallId: "tc2",
            output: { type: "json", value: 2 },
          },
        ],
      },
    ];
    const result = toAgentMessages(input);
    const parts = result[0].parts;
    assert.equal(parts.length, 5);
    assert.equal(parts[0].type, "text");
    assert.equal(parts[1].type, "tool");
    assert.equal(parts[2].type, "text");
    assert.equal(parts[3].type, "tool");
    assert.equal(parts[4].type, "text");
    if (parts[1].type === "tool") assert.equal(parts[1].toolName, "A");
    if (parts[3].type === "tool") assert.equal(parts[3].toolName, "B");
  });

  it("marks orphaned tool calls as input-available (interrupted)", () => {
    const input: ServerModelMessage[] = [
      {
        role: "assistant",
        id: "a1",
        content: [
          {
            type: "tool-call",
            toolCallId: "orphan",
            toolName: "doStuff",
            input: { x: 1 },
          },
        ],
      },
    ];
    const result = toAgentMessages(input);
    const part = result[0].parts[0];
    assert.equal(part.type, "tool");
    if (part.type !== "tool") return;
    assert.equal(part.state, "input-available");
    assert.equal(part.output, undefined);
  });

  it("marks tool result with isError as output-error and extracts error message", () => {
    const input: ServerModelMessage[] = [
      {
        role: "assistant",
        id: "a1",
        content: [
          {
            type: "tool-call",
            toolCallId: "tc1",
            toolName: "swap",
            input: {},
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "tc1",
            output: { type: "json", value: { error: "insufficient funds" } },
            isError: true,
          },
        ],
      },
    ];
    const result = toAgentMessages(input);
    const part = result[0].parts[0];
    assert.equal(part.type, "tool");
    if (part.type !== "tool") return;
    assert.equal(part.state, "output-error");
    assert.equal(part.error, "insufficient funds");
  });

  it("handles sanitized/redacted output by passing through unchanged", () => {
    const input: ServerModelMessage[] = [
      {
        role: "assistant",
        id: "a1",
        content: [
          {
            type: "tool-call",
            toolCallId: "tc1",
            toolName: "send",
            input: { secret: "[REDACTED]" },
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "tc1",
            output: {
              type: "json",
              value: { hash: "0xabc", secret: "[REDACTED]" },
            },
          },
        ],
      },
    ];
    const result = toAgentMessages(input);
    const part = result[0].parts[0];
    assert.equal(part.type, "tool");
    if (part.type !== "tool") return;
    assert.deepEqual(part.input, { secret: "[REDACTED]" });
    assert.deepEqual(part.output, { hash: "0xabc", secret: "[REDACTED]" });
  });

  it("drops standalone tool messages from output (folded into assistant)", () => {
    const input: ServerModelMessage[] = [
      {
        role: "user",
        content: "ping",
        id: "u1",
      },
      {
        role: "assistant",
        id: "a1",
        content: [
          { type: "tool-call", toolCallId: "tc1", toolName: "ping", input: {} },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "tc1",
            output: { type: "json", value: "pong" },
          },
        ],
      },
    ];
    const result = toAgentMessages(input);
    assert.equal(result.length, 2);
    assert.equal(result[0].role, "user");
    assert.equal(result[1].role, "assistant");
  });

  it("coerces input-streaming state to input-available (live-only state)", () => {
    const input: ServerModelMessage[] = [
      {
        role: "assistant",
        id: "a1",
        content: [
          {
            type: "tool",
            toolCallId: "tc1",
            toolName: "stream",
            input: {},
            state: "input-streaming",
          },
        ],
      },
    ];
    const result = toAgentMessages(input);
    const part = result[0].parts[0];
    assert.equal(part.type, "tool");
    if (part.type !== "tool") return;
    assert.equal(part.state, "input-available");
  });

  it("handles user messages with array content", () => {
    const input: ServerModelMessage[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "hello" },
          { type: "text", text: "world" },
        ],
        id: "u1",
      },
    ];
    const result = toAgentMessages(input);
    assert.equal(result[0].parts[0].type, "text");
    if (result[0].parts[0].type !== "text") return;
    assert.equal(result[0].parts[0].text, "hello\n\nworld");
  });

  it("respects server-marked interrupted_at hint and emits output-error (task 12)", () => {
    const input: ServerModelMessage[] = [
      {
        role: "assistant",
        id: "a1",
        content: [
          {
            type: "tool-call",
            toolCallId: "tc1",
            toolName: "transfer_erc20",
            input: { amount: "1" },
            interrupted_at: "2026-04-15T12:00:00Z",
          } as unknown as {
            type: "tool-call";
            toolCallId: string;
            toolName: string;
          },
        ],
      },
    ];
    const result = toAgentMessages(input);
    const part = result[0].parts[0];
    assert.equal(part.type, "tool");
    if (part.type !== "tool") return;
    assert.equal(part.state, "output-error");
    assert.equal(part.error, "interrupted");
  });

  it("uses args field as fallback when input is absent (legacy server format)", () => {
    const input: ServerModelMessage[] = [
      {
        role: "assistant",
        id: "a1",
        content: [
          {
            type: "tool-call",
            toolCallId: "tc1",
            toolName: "legacy",
            args: { x: 1 },
          } as unknown as {
            type: "tool-call";
            toolCallId: string;
            toolName: string;
          },
        ],
      },
    ];
    const result = toAgentMessages(input);
    const part = result[0].parts[0];
    assert.equal(part.type, "tool");
    if (part.type !== "tool") return;
    assert.deepEqual(part.input, { x: 1 });
  });
});
