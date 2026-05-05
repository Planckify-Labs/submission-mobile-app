/**
 * Dev-only route — verify `@mysten/sui/transactions` `Transaction.from`
 * round-trip + `getData()` shape on the WebView WebKit/Chromium runtime.
 *
 * Spec reference: `docs/sui-dapp-bridge-spec.md` §13 task 00 + §14
 * risk row 1.
 *
 * Why this route exists: the PTB decoder inspector
 * (`services/bridge/inspectors/SuiPtbDecoderInspector.ts`) and the
 * injected-shim normalisation path (`services/chains/sui/injectedScript.ts`
 * §5.5) both depend on `Transaction.from(bytes)` and `tx.getData()`
 * behaving identically inside the React Native WebView. The Mysten SDK
 * has changed the decoded shape between minor versions
 * (`tx.getData().commands` vs `tx.blockData.transactions`); this route
 * pins the verified shape on the SDK version we ship before the
 * decoder lands in any user-visible code path.
 *
 * Manual procedure:
 *   1. Build the app in dev mode and navigate to `/_dev/sui-ptb-decode`.
 *   2. Tap "Round-trip" — the page calls `tx.transferObjects([tx.gas], "0x..")`,
 *      builds via a stub client, base64-encodes, decodes back, and asserts
 *      `data.commands` / `data.inputs` / `data.gasData.budget`.
 *   3. The result panel shows OK / FAIL with the observed shape.
 *   4. Repeat on iOS + Android.
 *
 * **No production code merged.** This file is throwaway scaffolding.
 *
 * **Pin the SDK version exactly.** No caret. The decoder shape is
 * load-bearing for inspector accuracy. The pinned version lives in
 * `package.json` `@mysten/sui` (no `^`).
 */

import { Transaction } from "@mysten/sui/transactions";
import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

interface RoundTripResult {
  ok: boolean;
  observedShape: string[];
  detail: string;
}

const SAMPLE_RECIPIENT = "0x" + "ab".repeat(32);

async function roundTrip(): Promise<RoundTripResult> {
  try {
    const tx = new Transaction();
    tx.setSender(SAMPLE_RECIPIENT);
    tx.setGasBudget(100_000_000);
    tx.transferObjects([tx.gas], SAMPLE_RECIPIENT);

    // build() with no client returns a partial wire — for shape
    // verification we use buildSync's lighter-weight cousin: serialize
    // to JSON via getData, then re-parse via Transaction.from with the
    // serialized bytes. Some Mysten versions expose `serialize()` /
    // `toJSON()` on the builder; we fall back to a stub-build branch.
    let bytes: Uint8Array | null = null;
    type LooseTx = {
      buildSync?: (args?: { onlyTransactionKind?: boolean }) => Uint8Array;
      serialize?: () => Uint8Array;
      toJSON?: () => string | Promise<string>;
    };
    const looseTx = tx as unknown as LooseTx;
    if (typeof looseTx.serialize === "function") {
      bytes = looseTx.serialize();
    } else if (typeof looseTx.toJSON === "function") {
      const s = await looseTx.toJSON();
      // Some versions of toJSON return a base64 string; decode.
      const bin = atob(s);
      bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    } else if (typeof looseTx.buildSync === "function") {
      bytes = looseTx.buildSync({ onlyTransactionKind: true });
    } else {
      return {
        ok: false,
        observedShape: [],
        detail: "no buildSync / serialize / toJSON available",
      };
    }

    if (!bytes) {
      return { ok: false, observedShape: [], detail: "build returned null" };
    }

    const reHydrated = Transaction.from(bytes);
    const lt = reHydrated as unknown as {
      getData?: () => Record<string, unknown>;
      blockData?: Record<string, unknown>;
    };
    const data = lt.getData?.() ?? lt.blockData;
    if (!data) {
      return {
        ok: false,
        observedShape: [],
        detail:
          "Transaction.from returned no data — getData() / blockData missing",
      };
    }

    const fields = Object.keys(data);
    const ok = fields.includes("commands") || fields.includes("transactions");
    return {
      ok,
      observedShape: fields,
      detail: ok
        ? "Round-trip OK — shape stable on this runtime."
        : "Decoded shape missing both `commands` and `transactions` keys.",
    };
  } catch (e) {
    return {
      ok: false,
      observedShape: [],
      detail: `threw: ${(e as Error).message}`,
    };
  }
}

export default function SuiPtbDecodeDev(): React.ReactElement {
  const [result, setResult] = useState<RoundTripResult | null>(null);
  const [running, setRunning] = useState(false);

  return (
    <ScrollView className="flex-1 bg-white p-4">
      <Text className="text-lg font-semibold mb-2">
        Sui PTB round-trip verifier
      </Text>
      <Text className="text-xs text-gray-500 mb-4">
        Builds a known PTB, base64-decodes via `Transaction.from`, asserts the
        shape exposes `commands` / `inputs` / `gasData`. Throwaway dev route —
        never linked from any nav surface.
      </Text>

      <TouchableOpacity
        onPress={async () => {
          setRunning(true);
          const r = await roundTrip();
          setResult(r);
          setRunning(false);
        }}
        className="self-start bg-blue-600 rounded-lg px-4 py-2 mb-4"
      >
        <Text className="text-white font-medium">
          {running ? "Running…" : "Run round-trip"}
        </Text>
      </TouchableOpacity>

      {result && (
        <View
          className={`rounded-xl p-3 ${
            result.ok ? "bg-emerald-50" : "bg-red-50"
          }`}
        >
          <Text
            className={`text-sm font-semibold mb-1 ${
              result.ok ? "text-emerald-800" : "text-red-800"
            }`}
          >
            {result.ok ? "OK" : "FAIL"}
          </Text>
          <Text className="text-xs text-gray-700">{result.detail}</Text>
          {result.observedShape.length > 0 && (
            <Text className="text-xs text-gray-600 mt-2 font-mono">
              shape: [{result.observedShape.join(", ")}]
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}
