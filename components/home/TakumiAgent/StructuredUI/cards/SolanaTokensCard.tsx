/**
 * SolanaTokensCard — registry card for the `get_wallet_spl_tokens` read tool.
 *
 * Solana counterpart to WalletTokensCard. Displays SPL tokens (and native SOL)
 * from the active Solana cluster. Pure read — no store reads, no timers.
 */

import { AlertTriangle, Coins } from "lucide-react-native";
import type React from "react";
import { Text, View } from "react-native";
import OptimizedImage from "@/components/common/OptimizedImage";
import SingleLoadingSekeleton from "@/components/common/SingleLoadingSekeleton";
import type { ToolComponentProps } from "../types";

type SplTokenRow = {
  symbol?: string;
  name?: string;
  address?: string;
  decimals?: number;
  is_native?: boolean;
  is_stable_coin?: boolean;
  logo_url?: string | null;
  balance_lamports?: string;
  balance_display?: string;
};

type SolanaTokensInput = {
  include_balance?: boolean;
  symbol?: string;
  is_stable_coin?: boolean;
  is_native_currency?: boolean;
};

type SolanaTokensPayload = {
  cluster?: string;
  tokens?: SplTokenRow[];
};

type SolanaTokensOutput = {
  status?: "success" | "failed" | string;
  error?: string;
  display?: SolanaTokensPayload;
  data?: SolanaTokensPayload;
};

const BRAND_RED = "#c71c4b";

function formatBalance(display: string | undefined): string {
  if (!display) return "—";
  const num = Number(display);
  if (!Number.isFinite(num)) return display;
  if (num === 0) return "0";
  if (num >= 1)
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return num.toLocaleString(undefined, { maximumSignificantDigits: 6 });
}

function hasAnyBalance(tokens: SplTokenRow[]): boolean {
  return tokens.some((t) => {
    const n = Number(t.balance_display ?? "0");
    return Number.isFinite(n) && n > 0;
  });
}

function SkeletonRow() {
  return (
    <View className="flex-row items-center gap-3 py-2">
      <SingleLoadingSekeleton width={36} height={36} borderRadius={18} />
      <View className="flex-1 min-w-0">
        <SingleLoadingSekeleton
          height={12}
          borderRadius={4}
          style={{ width: "40%" }}
        />
        <SingleLoadingSekeleton
          height={10}
          borderRadius={4}
          style={{ marginTop: 4, width: "60%" }}
        />
      </View>
      <View className="items-end" style={{ width: "25%" }}>
        <SingleLoadingSekeleton
          height={12}
          borderRadius={4}
          style={{ width: "100%" }}
        />
        <SingleLoadingSekeleton
          height={10}
          borderRadius={4}
          style={{ marginTop: 4, width: "60%" }}
        />
      </View>
    </View>
  );
}

function TokenRowItem({ token }: { token: SplTokenRow }) {
  const balance = formatBalance(token.balance_display);
  const hasBalance = token.balance_display !== undefined;
  return (
    <View className="flex-row items-center gap-3 py-2">
      <View className="rounded-full overflow-hidden w-9 h-9 border border-light-matte-black/10 bg-light-primary-red/10 items-center justify-center">
        {token.logo_url ? (
          <OptimizedImage
            source={{ uri: token.logo_url }}
            containerStyle={{ width: 36, height: 36 }}
            contentFit="cover"
            alt={`${token.symbol ?? "token"} logo`}
          />
        ) : (
          <Coins size={16} color={BRAND_RED} />
        )}
      </View>
      <View className="flex-1 min-w-0">
        <Text
          className="text-sm font-semibold text-light-matte-black"
          numberOfLines={1}
        >
          {token.symbol ?? "—"}
          {token.is_native ? (
            <Text className="text-[10px] text-gray-500 font-normal">
              {" "}
              · native
            </Text>
          ) : null}
        </Text>
        {token.name ? (
          <Text className="text-[11px] text-gray-500" numberOfLines={1}>
            {token.name}
          </Text>
        ) : null}
      </View>
      <View className="items-end">
        <Text
          className={`text-sm font-semibold ${
            hasBalance ? "text-light-matte-black" : "text-gray-400"
          }`}
          numberOfLines={1}
        >
          {balance}
        </Text>
        <Text className="text-[10px] text-gray-500" numberOfLines={1}>
          {token.symbol ?? ""}
        </Text>
      </View>
    </View>
  );
}

const SolanaTokensCard: React.FC<
  ToolComponentProps<SolanaTokensInput, SolanaTokensOutput>
> = ({ state, output }) => {
  if (state === "input-streaming" || state === "input-available" || !output) {
    return (
      <View className="my-1.5 rounded-2xl border border-light-matte-black/10 bg-white px-3.5 py-3">
        <View className="flex-row items-center gap-2 mb-1">
          <Coins size={14} color={BRAND_RED} />
          <Text className="text-xs font-bold uppercase tracking-wide text-light-matte-black">
            Solana balances
          </Text>
          <View className="ml-auto">
            <SingleLoadingSekeleton width={50} height={10} borderRadius={4} />
          </View>
        </View>
        <View className="divide-y divide-gray-100">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      </View>
    );
  }

  if (state === "output-error" || output.status === "failed") {
    return (
      <View className="my-1.5 rounded-2xl border border-light-primary-red/30 bg-light-primary-red/5 px-3.5 py-3">
        <View className="flex-row items-center gap-2">
          <AlertTriangle size={14} color={BRAND_RED} />
          <Text className="text-xs font-bold uppercase tracking-wide text-light-primary-red">
            Couldn't read balances
          </Text>
        </View>
        {output.error ? (
          <Text className="text-sm text-light-matte-black/80 mt-1.5">
            {output.error}
          </Text>
        ) : null}
      </View>
    );
  }

  const payload = output.display ?? output.data ?? {};
  const tokens: SplTokenRow[] = Array.isArray(payload.tokens)
    ? payload.tokens
    : [];

  const withBalance = tokens.filter((t) => {
    const n = Number(t.balance_display ?? "0");
    return Number.isFinite(n) && n > 0;
  });
  const display = withBalance.length > 0 ? withBalance : tokens.slice(0, 6);
  const anyBalance = hasAnyBalance(tokens);
  const clusterLabel =
    payload.cluster === "devnet"
      ? "Devnet"
      : payload.cluster === "testnet"
        ? "Testnet"
        : "Mainnet";

  return (
    <View className="my-1.5 rounded-2xl border border-light-matte-black/10 bg-white px-3.5 py-3">
      <View className="flex-row items-center gap-2 mb-1">
        <Coins size={14} color={BRAND_RED} />
        <Text className="text-xs font-bold uppercase tracking-wide text-light-matte-black">
          Solana balances
        </Text>
        <Text className="text-[11px] text-gray-500 ml-auto">
          {clusterLabel} · {tokens.length}{" "}
          {tokens.length === 1 ? "token" : "tokens"}
        </Text>
      </View>
      {display.length === 0 ? (
        <Text className="text-sm text-gray-500">No tokens to show.</Text>
      ) : (
        <View className="divide-y divide-gray-100">
          {display.map((token, idx) => (
            <TokenRowItem
              key={`${token.address ?? token.symbol ?? "row"}-${idx}`}
              token={token}
            />
          ))}
        </View>
      )}
      {!anyBalance && tokens.length > 0 ? (
        <Text className="text-[11px] text-gray-400 mt-2">
          Balances will appear once the wallet has funds on this cluster.
        </Text>
      ) : null}
    </View>
  );
};

export default SolanaTokensCard;
