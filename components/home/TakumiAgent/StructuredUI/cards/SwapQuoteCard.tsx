/**
 * SwapQuoteCard — first-class generative UI for swap quotes.
 *
 * Live mode: shows the quote, route, price impact, a countdown to
 * `expiresAt`, and an "Accept quote" button that resolves the tool
 * via `addToolResult`.
 *
 * Historical mode: frozen receipt — no countdown, no Accept button.
 */

import { ArrowRight, CheckCircle2, Clock, XCircle } from "lucide-react-native";
import type React from "react";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { ToolComponentProps } from "../types";

type SwapRoute = {
  protocol?: string;
  pools?: string[];
  hops?: number;
};

type SwapQuoteInput = {
  from_token?: string;
  to_token?: string;
  from_amount?: string;
  slippage_bps?: number;
};

type SwapQuoteOutput = {
  status?: "success" | "failed" | "expired" | "accepted" | "rejected";
  from_token?: string;
  to_token?: string;
  from_amount?: string;
  to_amount?: string;
  route?: SwapRoute;
  price_impact_bps?: number;
  expires_at?: string;
  user_decision?: "accepted" | "rejected";
  error?: string;
};

const SUCCESS_GREEN = "#10b981";
const BRAND_RED = "#c71c4b";
const MUTED_GRAY = "#6b7280";

function formatBps(bps: number | undefined): string | null {
  if (typeof bps !== "number") return null;
  return `${(bps / 100).toFixed(2)}%`;
}

function HeaderRow({
  fromToken,
  toToken,
  fromAmount,
  toAmount,
}: {
  fromToken?: string;
  toToken?: string;
  fromAmount?: string;
  toAmount?: string;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-sm font-semibold text-light-matte-black">
        {fromAmount ?? "—"} {fromToken ?? ""}
      </Text>
      <ArrowRight size={14} color={MUTED_GRAY} />
      <Text className="text-sm font-semibold text-light-matte-black">
        {toAmount ?? "—"} {toToken ?? ""}
      </Text>
    </View>
  );
}

function RouteLine({
  route,
  priceImpactBps,
}: {
  route?: SwapRoute;
  priceImpactBps?: number;
}) {
  const protocol = route?.protocol;
  const hops = route?.hops;
  const impact = formatBps(priceImpactBps);
  const bits: string[] = [];
  if (protocol) bits.push(protocol);
  if (typeof hops === "number")
    bits.push(`${hops} hop${hops === 1 ? "" : "s"}`);
  if (impact) bits.push(`${impact} impact`);
  if (bits.length === 0) return null;
  return (
    <Text className="text-[11px] text-gray-500 mt-1">{bits.join(" · ")}</Text>
  );
}

function HistoricalReceipt({
  input,
  output,
  state,
}: {
  input: SwapQuoteInput;
  output: SwapQuoteOutput | undefined;
  state: ToolComponentProps<SwapQuoteInput, SwapQuoteOutput>["state"];
}) {
  if (!output || state === "input-available" || state === "input-streaming") {
    return (
      <View className="my-1.5 rounded-2xl border border-gray-200 bg-gray-50 px-3.5 py-3">
        <Text className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Quote unavailable
        </Text>
        <HeaderRow
          fromToken={input.from_token}
          toToken={input.to_token}
          fromAmount={input.from_amount}
        />
      </View>
    );
  }

  const failed = state === "output-error" || output.status === "failed";
  const accepted = output.user_decision === "accepted";

  if (failed) {
    return (
      <View className="my-1.5 rounded-2xl border border-light-primary-red/30 bg-light-primary-red/5 px-3.5 py-3">
        <View className="flex-row items-center gap-2">
          <XCircle size={16} color={BRAND_RED} />
          <Text className="text-xs font-bold uppercase tracking-wide text-light-primary-red">
            Quote failed
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

  return (
    <View className="my-1.5 rounded-2xl border border-green-200 bg-green-50/60 px-3.5 py-3">
      <View className="flex-row items-center gap-2">
        <CheckCircle2 size={16} color={SUCCESS_GREEN} />
        <Text className="text-xs font-bold uppercase tracking-wide text-green-700">
          {accepted ? "Quote accepted" : "Quote"}
        </Text>
      </View>
      <View className="mt-1.5">
        <HeaderRow
          fromToken={output.from_token ?? input.from_token}
          toToken={output.to_token ?? input.to_token}
          fromAmount={output.from_amount ?? input.from_amount}
          toAmount={output.to_amount}
        />
        <RouteLine
          route={output.route}
          priceImpactBps={output.price_impact_bps}
        />
      </View>
    </View>
  );
}

function useExpiryCountdown(
  expiresAtIso: string | undefined,
  enabled: boolean,
): { secondsLeft: number | null; expired: boolean } {
  const computeSeconds = (): number | null => {
    if (!expiresAtIso) return null;
    const exp = new Date(expiresAtIso).getTime();
    if (Number.isNaN(exp)) return null;
    return Math.max(0, Math.floor((exp - Date.now()) / 1000));
  };
  const [secondsLeft, setSecondsLeft] = useState<number | null>(computeSeconds);
  useEffect(() => {
    if (!enabled || !expiresAtIso) return;
    const tick = () => setSecondsLeft(computeSeconds());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // computeSeconds closure is fine since it reads expiresAtIso
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, expiresAtIso]);
  return {
    secondsLeft,
    expired: secondsLeft !== null && secondsLeft <= 0,
  };
}

const SwapQuoteCard: React.FC<
  ToolComponentProps<SwapQuoteInput, SwapQuoteOutput>
> = ({ state, input, output, mode, addToolResult }) => {
  const liveActive =
    mode === "live" &&
    state === "output-available" &&
    output?.user_decision === undefined;

  const { secondsLeft, expired } = useExpiryCountdown(
    output?.expires_at,
    liveActive,
  );

  if (mode === "historical") {
    return <HistoricalReceipt input={input} output={output} state={state} />;
  }

  if (state === "output-error" || output?.status === "failed") {
    return <HistoricalReceipt input={input} output={output} state={state} />;
  }

  if (!output || state === "input-available" || state === "input-streaming") {
    return (
      <View className="my-1.5 rounded-2xl border border-gray-200 bg-gray-50 px-3.5 py-3">
        <Text className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Fetching quote…
        </Text>
        <HeaderRow
          fromToken={input.from_token}
          toToken={input.to_token}
          fromAmount={input.from_amount}
        />
      </View>
    );
  }

  // Already resolved (user accepted/rejected).
  if (output.user_decision !== undefined) {
    return <HistoricalReceipt input={input} output={output} state={state} />;
  }

  const onAccept = () => {
    if (!addToolResult) return;
    addToolResult({ ...output, user_decision: "accepted" });
  };
  const onReject = () => {
    if (!addToolResult) return;
    addToolResult({ ...output, user_decision: "rejected" });
  };

  return (
    <View className="my-1.5 rounded-2xl border border-light-primary-red/30 bg-light-primary-red/5 px-3.5 py-3">
      <View className="flex-row items-center gap-2">
        <Text className="text-xs font-bold uppercase tracking-wide text-light-primary-red">
          Swap quote
        </Text>
        {secondsLeft !== null ? (
          <View className="flex-row items-center gap-1 ml-auto">
            <Clock size={12} color={MUTED_GRAY} />
            <Text className="text-[11px] text-gray-500">
              {expired ? "Expired" : `${secondsLeft}s`}
            </Text>
          </View>
        ) : null}
      </View>
      <View className="mt-1.5">
        <HeaderRow
          fromToken={output.from_token ?? input.from_token}
          toToken={output.to_token ?? input.to_token}
          fromAmount={output.from_amount ?? input.from_amount}
          toAmount={output.to_amount}
        />
        <RouteLine
          route={output.route}
          priceImpactBps={output.price_impact_bps}
        />
      </View>
      <View className="flex-row gap-2 mt-3">
        <Pressable
          onPress={onReject}
          disabled={expired}
          accessibilityRole="button"
          accessibilityLabel="Reject quote"
          className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 active:opacity-70"
        >
          <Text className="text-xs font-semibold text-light-matte-black text-center">
            Reject
          </Text>
        </Pressable>
        <Pressable
          onPress={onAccept}
          disabled={expired}
          accessibilityRole="button"
          accessibilityLabel="Accept quote"
          className="flex-1 rounded-xl bg-light-primary-red px-3 py-2 active:opacity-80"
          style={expired ? { opacity: 0.5 } : undefined}
        >
          <Text className="text-xs font-semibold text-white text-center">
            {expired ? "Expired" : "Accept"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

export default SwapQuoteCard;
