/**
 * Task 00 — Hermes / RN compatibility smoke test for `@stellar/stellar-base`.
 *
 * Throw-away dev screen exercising the SDK surface the rest of the spec
 * depends on (`docs/stellar-chain-support-spec.md` §3.1, §11 risk row 1).
 *
 * Run on a real dev-client build (NOT Expo Go) on iOS AND Android.
 * Capture screenshots + Metro logs for the PR description, then DELETE
 * this screen and the route before merging the next Stellar task.
 *
 * Steps exercised:
 *   1. Keypair.fromRawEd25519Seed(seed) — the dwell-site primitive
 *   2. StrKey.encodeEd25519PublicKey(rawPubkey) — address encoding
 *   3. TransactionBuilder + Operation.payment + .sign() + .toXDR()
 *   4. fetch()-based Horizon `loadAccount` call (plain REST, no SDK client)
 *
 * Vector: SEP-0005's own published test vector (12-word mnemonic
 * "illness spike retreat truth genius clock brain pass fit cave bargain
 * toe" → m/44'/148'/0') is NOT re-derived here — that's Task 03's job
 * once the SLIP-0010 walker is wired. This screen only proves
 * `@stellar/stellar-base`'s primitives load and round-trip under Hermes,
 * seeded from the SEP-0005 vector's known keypair.
 */

import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

type Step = {
  name: string;
  status: "pending" | "pass" | "fail";
  detail?: string;
};

// SEP-0005 official test vector's derived keypair (§1.2 of the spec).
const EXPECTED_PUBLIC =
  "GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6";
const EXPECTED_SECRET =
  "SBGWSG6BTNCKCOB3DIFBGCVMUPQFYPA2G4O34RMTB343OYPXU5DJDVMN";

export default function StellarCompatSmokeScreen() {
  const [steps, setSteps] = useState<Step[]>([
    { name: "1. Keypair.fromRawEd25519Seed", status: "pending" },
    { name: "2. StrKey.encodeEd25519PublicKey", status: "pending" },
    { name: "3. TransactionBuilder + sign + toXDR", status: "pending" },
    { name: "4. fetch() Horizon loadAccount", status: "pending" },
  ]);

  // Run-once smoke test — `steps` is read via closure for the initial
  // snapshot only; adding it as a dependency would re-fire this effect
  // every time `setSteps` updates it below.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  useEffect(() => {
    void runSmoke();
    async function runSmoke() {
      const next: Step[] = [...steps];
      const set = (i: number, status: Step["status"], detail?: string) => {
        next[i] = { ...next[i], status, detail };
        setSteps([...next]);
      };

      let stellarBase: typeof import("@stellar/stellar-base") | null = null;
      let seedKeypair: InstanceType<
        typeof import("@stellar/stellar-base").Keypair
      > | null = null;

      // Step 1 — Keypair.fromRawEd25519Seed. We don't have the SLIP-0010
      // walker wired yet (Task 03), so decode the SEP-0005 vector's known
      // secret seed via StrKey to get the raw 32-byte seed, then rebuild
      // via fromRawEd25519Seed — the exact primitive
      // `getStellarSignerForWallet` (Task 05) will call.
      try {
        stellarBase = await import("@stellar/stellar-base");
        const { Keypair, StrKey } = stellarBase;
        // `decodeEd25519SecretSeed` already returns the npm `buffer` shim's
        // `Buffer` (a real dependency of `@stellar/stellar-base`, not a
        // Metro/global assumption — spec §3.1) — pass it straight through
        // rather than reaching for a bare global `Buffer`, which this repo
        // does not currently polyfill.
        const rawSeed = StrKey.decodeEd25519SecretSeed(EXPECTED_SECRET);
        seedKeypair = Keypair.fromRawEd25519Seed(rawSeed);
        const ok = seedKeypair.publicKey() === EXPECTED_PUBLIC;
        if (!ok) {
          throw new Error(
            `derived pubkey mismatch: got ${seedKeypair.publicKey()}`,
          );
        }
        set(0, "pass", seedKeypair.publicKey());
      } catch (e) {
        set(0, "fail", String((e as Error)?.message ?? e));
        return;
      }

      // Step 2 — StrKey.encodeEd25519PublicKey round-trip on the raw
      // public key bytes.
      try {
        const { StrKey } = stellarBase!;
        const rawPub = seedKeypair!.rawPublicKey();
        const reEncoded = StrKey.encodeEd25519PublicKey(rawPub);
        if (reEncoded !== EXPECTED_PUBLIC) {
          throw new Error(`re-encode mismatch: ${reEncoded}`);
        }
        set(1, "pass", reEncoded);
      } catch (e) {
        set(1, "fail", String((e as Error)?.message ?? e));
      }

      // Step 3 — build + sign + serialize a payment transaction, then
      // round-trip it back through fromXDR. Uses a fixed sequence number
      // (no network call) since this step only proves the XDR/signing
      // path works under Hermes, not that the account exists on-chain.
      try {
        const { Account, TransactionBuilder, Operation, Asset, Networks } =
          stellarBase!;
        const account = new Account(EXPECTED_PUBLIC, "1");
        const tx = new TransactionBuilder(account, {
          fee: "100",
          networkPassphrase: Networks.TESTNET,
        })
          .addOperation(
            Operation.payment({
              destination: EXPECTED_PUBLIC,
              asset: Asset.native(),
              amount: "1",
            }),
          )
          .setTimeout(180)
          .build();
        tx.sign(seedKeypair!);
        const xdr = tx.toXDR();
        if (typeof xdr !== "string" || xdr.length === 0) {
          throw new Error("empty XDR");
        }
        const rebuilt = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
        if (rebuilt.toXDR() !== xdr) {
          throw new Error("round-trip XDR mismatch");
        }
        set(2, "pass", `xdr.len=${xdr.length}`);
      } catch (e) {
        set(2, "fail", String((e as Error)?.message ?? e));
      }

      // Step 4 — plain fetch() against Horizon's REST API (no SDK HTTP
      // client — §3.1's stated v1 preference). Well-known funded
      // mainnet account (Stellar Development Foundation) so this passes
      // without needing a funded test wallet.
      try {
        const SDF_ACCOUNT =
          "GA6HCMBLTZS5VYYBCATRBRZ3BZJMAFUDKYYF6AH6MVCMGWMRDNSWJPIH";
        const res = await fetch(
          `https://horizon.stellar.org/accounts/${SDF_ACCOUNT}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { account_id?: string };
        if (json.account_id !== SDF_ACCOUNT) {
          throw new Error("unexpected response shape");
        }
        set(3, "pass", `account_id=${json.account_id}`);
      } catch (e) {
        set(3, "fail", String((e as Error)?.message ?? e));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 64 }}>
      <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 12 }}>
        Stellar SDK Hermes Smoke Test
      </Text>
      <Text style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
        Spec §3.1 / Task 00. Delete this screen before merging the next Stellar
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
