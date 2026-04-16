import type { BridgeEventSink } from "../events";
import { scrubLoggerPayload } from "../redact";

export const ConsoleSink: BridgeEventSink = {
  emit(e) {
    if (!__DEV__) return;
    // TWV-2026-003 — never emit a raw payload; scrubber strips BIP-39
    // word runs, 0x-prefixed 64-hex, and base58-32-byte shapes even in
    // dev. Prevents the Slope Wallet failure mode if an engineer later
    // forwards these logs to an external collector.
    console.debug("[bridge]", e.kind, scrubLoggerPayload(e));
  },
};
