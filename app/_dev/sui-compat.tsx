/**
 * Task 00 — Hermes / RN compatibility smoke test for `@mysten/sui`.
 *
 * Throw-away dev screen exercising the SDK surface the rest of the spec
 * depends on (`docs/sui-chain-support-spec.md` §3.1, §11 risk row 1).
 *
 * Run on a real dev-client build (NOT Expo Go) on iOS AND Android.
 * Capture screenshots + Metro logs for the PR description, then DELETE
 * this screen and the route before merging the next Sui task.
 *
 * Steps exercised:
 *   1. Ed25519Keypair.deriveKeypair(mnemonic, "m/44'/784'/0'/0'/0'")
 *   2. keypair.toSuiAddress() — assert 0x + 64 hex
 *   3. keypair.signPersonalMessage(...)
 *   4. new Transaction(); splitCoins/transferObjects; tx.build({ client })
 *   5. messageWithIntent from "@mysten/sui/cryptography"
 *   6. bech32 decode of `suiprivkey1…` test vector
 */

import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

type Step = {
  name: string;
  status: "pending" | "pass" | "fail";
  detail?: string;
};

const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const TEST_PATH = "m/44'/784'/0'/0'/0'";

export default function SuiCompatSmokeScreen() {
  const [steps, setSteps] = useState<Step[]>([
    { name: "1. Ed25519Keypair.deriveKeypair", status: "pending" },
    { name: "2. keypair.toSuiAddress()", status: "pending" },
    { name: "3. signPersonalMessage", status: "pending" },
    { name: "4. Transaction.build({ client })", status: "pending" },
    { name: "5. messageWithIntent", status: "pending" },
    { name: "6. bech32 decode (suiprivkey1)", status: "pending" },
  ]);

  useEffect(() => {
    void runSmoke();
    async function runSmoke() {
      const next: Step[] = [...steps];
      const set = (i: number, status: Step["status"], detail?: string) => {
        next[i] = { ...next[i], status, detail };
        setSteps([...next]);
      };

      let keypair: unknown = null;

      // Step 1 — derive
      try {
        const { Ed25519Keypair } = await import("@mysten/sui/keypairs/ed25519");
        keypair = Ed25519Keypair.deriveKeypair(TEST_MNEMONIC, TEST_PATH);
        set(0, "pass");
      } catch (e) {
        set(0, "fail", String((e as Error)?.message ?? e));
        return;
      }

      // Step 2 — address
      let suiAddress = "";
      try {
        // @ts-expect-error runtime only
        suiAddress = keypair.toSuiAddress();
        const ok = /^0x[0-9a-f]{64}$/.test(suiAddress);
        if (!ok) throw new Error(`bad shape: ${suiAddress}`);
        set(1, "pass", suiAddress);
      } catch (e) {
        set(1, "fail", String((e as Error)?.message ?? e));
      }

      // Step 3 — sign personal message
      try {
        const bytes = new TextEncoder().encode("hello");
        // @ts-expect-error runtime only
        const out = await keypair.signPersonalMessage(bytes);
        if (!out?.signature) throw new Error("no signature returned");
        set(2, "pass", `sig=${String(out.signature).slice(0, 16)}…`);
      } catch (e) {
        set(2, "fail", String((e as Error)?.message ?? e));
      }

      // Step 4 — Transaction.build round-trip
      try {
        const { Transaction } = await import("@mysten/sui/transactions");
        const { SuiJsonRpcClient } = await import("@mysten/sui/jsonRpc");
        const client = new SuiJsonRpcClient({
          url: "https://fullnode.mainnet.sui.io:443",
          network: "mainnet" as const,
        });
        const tx = new Transaction();
        tx.setSender(suiAddress);
        const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(1n)]);
        tx.transferObjects([coin], tx.pure.address(suiAddress));
        const built = await tx.build({ client });
        if (!(built instanceof Uint8Array) || built.length === 0) {
          throw new Error("empty BCS");
        }
        set(3, "pass", `bcs.bytes=${built.length}`);
      } catch (e) {
        set(3, "fail", String((e as Error)?.message ?? e));
      }

      // Step 5 — messageWithIntent
      try {
        const cryptography = await import("@mysten/sui/cryptography");
        const fn =
          (cryptography as Record<string, unknown>).messageWithIntent ??
          // some SDK versions expose under a different name
          (cryptography as Record<string, unknown>).default;
        if (typeof fn !== "function") {
          throw new Error(
            "messageWithIntent not exported from @mysten/sui/cryptography",
          );
        }
        const out = (fn as (scope: string, b: Uint8Array) => Uint8Array)(
          "PersonalMessage",
          new TextEncoder().encode("ping"),
        );
        if (!(out instanceof Uint8Array) || out.length === 0) {
          throw new Error("empty intent bytes");
        }
        set(4, "pass", `intent.len=${out.length}`);
      } catch (e) {
        set(4, "fail", String((e as Error)?.message ?? e));
      }

      // Step 6 — bech32 decode of a known suiprivkey1 vector
      try {
        // Vector: 32 zero bytes encoded as suiprivkey1.
        const { decodeSuiPrivateKey } = await import(
          "@mysten/sui/cryptography"
        );
        // Use a well-formed vector by re-exporting the just-derived keypair.
        // @ts-expect-error runtime only
        const bech = keypair.getSecretKey();
        if (typeof bech !== "string" || !bech.startsWith("suiprivkey1")) {
          throw new Error(`unexpected secret-key shape: ${bech}`);
        }
        const decoded = decodeSuiPrivateKey(bech);
        if (decoded.secretKey.length !== 32) {
          throw new Error(`secretKey length=${decoded.secretKey.length}`);
        }
        set(
          5,
          "pass",
          `scheme=${decoded.scheme} len=${decoded.secretKey.length}`,
        );
      } catch (e) {
        set(5, "fail", String((e as Error)?.message ?? e));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 64 }}>
      <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 12 }}>
        Sui SDK Hermes Smoke Test
      </Text>
      <Text style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
        Spec §3.1 / Task 00. Delete this screen before merging the next Sui
        task.
      </Text>
      {steps.map((s) => (
        <View key={s.name} style={{ marginBottom: 12 }}>
          <Text style={{ fontWeight: "500" }}>
            {s.status === "pass" ? "✅" : s.status === "fail" ? "❌" : "⏳"}{" "}
            {s.name}
          </Text>
          {s.detail ? (
            <Text style={{ fontSize: 12, color: "#666", marginLeft: 16 }}>
              {s.detail}
            </Text>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}
