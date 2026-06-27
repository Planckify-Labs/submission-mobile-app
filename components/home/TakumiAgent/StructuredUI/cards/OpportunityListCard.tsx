/**
 * OpportunityListCard — renders `defi_list_opportunities` results.
 *
 * Reads the structured payload emitted by the mobile executor in
 * `services/agent-executors/defi/reads.ts` (`{ opportunities: [...] }`).
 * Per CLAUDE.md user-facing-error rule the failure branch shows
 * hand-written friendly copy; the raw `output.error` (curated code
 * like `unknown_error` / `authentication_required`) goes to dev logs
 * only.
 *
 * Presentation (full redesign):
 *  - Rows are ranked by safety (`score` desc, APY as tiebreak) so the
 *    safest venue leads; testnets sink to the bottom and are hidden
 *    entirely in production builds when any mainnet row exists.
 *  - The list pages in groups of `PREVIEW_COUNT` via Prev/Next (shared
 *    `PagerButton`), mirroring the redemption-catalog card.
 *  - Raw DeFiLlama slugs (`aave-v3-base-sepolia`) are prettified into
 *    display names (text only — no icon/avatar; this is a data-comparison
 *    list, not a brand grid); the chain is shown once as metadata instead
 *    of being baked into the slug.
 *  - APY is the hero number (with 7d-avg context); the repeated risk
 *    pill collapses into a single header chip when every row shares a
 *    tier, and the unused `score` surfaces as a "Safety" signal.
 *  - Rows are tappable → they ask the agent to dig into that specific
 *    opportunity as the user's pick (works for strategy-less browsers,
 *    unlike the strategy-gated /strategies detail screen). Inert in
 *    historical mode where `onUserPrompt` is undefined.
 *  - The empty state is actionable: tap to ask the agent to widen.
 */

import { router } from "expo-router";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Coins,
  LogIn,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react-native";
import type React from "react";
import { useMemo, useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import SingleLoadingSekeleton from "@/components/common/SingleLoadingSekeleton";
import { useUserStrategy } from "@/hooks/queries/useStrategy";
import { getChainFamilyLabel } from "@/services/walletKit/chainInfo";
import { tapFeedback } from "@/utils/hapticsUtils";
import type { ToolComponentProps } from "../types";
import PagerButton from "./PagerButton";
import SetupStrategyCTA from "./SetupStrategyCTA";

const BRAND_RED = "#c71c4b";
const PREVIEW_COUNT = 6;

type RiskTier = "conservative" | "balanced" | "aggressive";

type OpportunityRow = {
  id?: string;
  protocol_slug: string;
  chain_id?: number;
  chain_name?: string;
  namespace?: string;
  asset_symbol?: string;
  pool_id?: string;
  apy?: number | string;
  apy_7d_avg?: number | string;
  tvl_usd?: number | string;
  score?: number;
  tier?: RiskTier | string;
  il_exposure?: boolean;
};

type OpportunityInput = {
  tier?: string;
  asset_symbol?: string;
  chain_id?: number;
  liquidity_profile?: string;
  amount_usd?: number;
};

type OpportunityOutput = {
  status?: "success" | "failed" | string;
  error?: string;
  data?: {
    opportunities?: OpportunityRow[];
    count?: number;
  };
};

const TIER_LABEL: Record<string, string> = {
  conservative: "Low risk",
  balanced: "Moderate risk",
  aggressive: "High risk",
};

const TIER_PILL_COLOR: Record<string, string> = {
  conservative: "bg-green-100 text-green-700",
  balanced: "bg-amber-100 text-amber-700",
  aggressive: "bg-rose-100 text-rose-700",
};

// Known DeFiLlama / adapter slugs → human display names. Anything not
// listed falls back to title-casing the slug (after stripping a trailing
// chain suffix), so new protocols still read cleanly without an entry.
const PROTOCOL_DISPLAY_NAMES: Record<string, string> = {
  "aave-v3": "Aave V3",
  "aave-v2": "Aave V2",
  aave: "Aave",
  "fluid-lending": "Fluid",
  fluid: "Fluid",
  "centrifuge-protocol": "Centrifuge",
  centrifuge: "Centrifuge",
  maple: "Maple",
  "morpho-vault": "Morpho",
  "morpho-blue": "Morpho",
  morpho: "Morpho",
  "compound-v3": "Compound V3",
  "compound-v2": "Compound V2",
  spark: "Spark",
  "sky-lending": "Sky",
  sky: "Sky",
  "ethena-usde": "Ethena",
  ethena: "Ethena",
  lido: "Lido",
  "jito-solana": "Jito",
  jito: "Jito",
  "yearn-finance": "Yearn",
  "yearn-v3": "Yearn",
  yearn: "Yearn",
  "curve-dex": "Curve",
  curve: "Curve",
  scallop: "Scallop",
  navi: "Navi",
};

// Trailing chain qualifiers we strip from a slug before prettifying, so
// "aave-v3-base-sepolia" → "aave-v3" (the chain is shown separately).
const CHAIN_SUFFIXES = [
  "-base-sepolia",
  "-arbitrum-sepolia",
  "-optimism-sepolia",
  "-ethereum-sepolia",
  "-sepolia",
  "-base",
  "-arbitrum",
  "-optimism",
  "-polygon",
  "-ethereum",
  "-mainnet",
];

const TESTNET_CHAIN_IDS = new Set<number>([
  11155111, // Ethereum Sepolia
  84532, // Base Sepolia
  421614, // Arbitrum Sepolia
  11155420, // Optimism Sepolia
  80002, // Polygon Amoy
  97, // BNB testnet
  43113, // Avalanche Fuji
  59141, // Linea Sepolia
  534351, // Scroll Sepolia
]);

function apyNumber(value: OpportunityRow["apy"]): number {
  if (value === undefined || value === null) return Number.NEGATIVE_INFINITY;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
}

// Backend `score` is 0–100 where higher is safer (see opportunity-detail
// "Risk score (0–100, higher is safer)"). Missing/NaN sinks to the bottom.
function scoreNumber(value: OpportunityRow["score"]): number {
  if (value === undefined || value === null) return Number.NEGATIVE_INFINITY;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
}

// Stable per-row identity for selection state — must survive paging, so it
// can't be the render index. `poolId` is `@@unique` on the backend.
function rowKey(row: OpportunityRow): string {
  return row.id ?? row.pool_id ?? row.protocol_slug;
}

// Keep only digits and a single decimal point as the user types an amount.
function sanitizeAmount(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  return rest.length ? `${whole}.${rest.join("")}` : whole;
}

function amountValue(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function formatApy(value: OpportunityRow["apy"]): string {
  const n = apyNumber(value);
  if (!Number.isFinite(n)) return "—";
  // Backend stores APY in percent units (e.g. 5.2 == 5.2%) so render
  // directly without multiplying.
  return `${n.toFixed(2)}%`;
}

function formatTvl(value: OpportunityRow["tvl_usd"]): string | null {
  if (value === undefined || value === null) return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B TVL`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M TVL`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K TVL`;
  return `$${n.toFixed(0)} TVL`;
}

function formatSafety(value: OpportunityRow["score"]): string | null {
  if (value === undefined || value === null) return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return null;
  return `Safety ${Math.round(n)}`;
}

// Prefer the backend's DeFiLlama-provided label (covers testnets like
// "Ethereum Sepolia" and any chain we haven't hardcoded). Fall back to a
// best-effort lookup by chainId for legacy payloads that omit the name.
function chainLabel(
  chainName?: string,
  chainId?: number,
  namespace?: string,
): string | null {
  if (chainName && chainName.trim()) return chainName;
  // Non-EVM payloads (Solana / Sui) carry a namespace but no numeric
  // chainId — ask the registry for the chain-family label instead of
  // branching on the namespace string here.
  if (chainId === undefined && namespace) {
    const label = getChainFamilyLabel(namespace);
    if (label !== "Wallet") return label;
  }
  switch (chainId) {
    case 1:
      return "Ethereum";
    case 8453:
      return "Base";
    case 42161:
      return "Arbitrum";
    case 10:
      return "Optimism";
    case 137:
      return "Polygon";
    case 56:
      return "BNB Chain";
    default:
      return chainId ? `Chain ${chainId}` : null;
  }
}

function prettyProtocol(slug: string): string {
  const lower = slug.trim().toLowerCase();
  if (PROTOCOL_DISPLAY_NAMES[lower]) return PROTOCOL_DISPLAY_NAMES[lower];
  let base = lower;
  for (const suffix of CHAIN_SUFFIXES) {
    if (base.endsWith(suffix)) {
      base = base.slice(0, -suffix.length);
      break;
    }
  }
  if (PROTOCOL_DISPLAY_NAMES[base]) return PROTOCOL_DISPLAY_NAMES[base];
  return (
    base
      .split(/[-_]/)
      .filter(Boolean)
      .map((word) =>
        /^v\d+$/i.test(word)
          ? word.toUpperCase()
          : word.charAt(0).toUpperCase() + word.slice(1),
      )
      .join(" ") || slug
  );
}

function isTestnetRow(row: OpportunityRow): boolean {
  if (
    row.chain_id !== undefined &&
    TESTNET_CHAIN_IDS.has(Number(row.chain_id))
  ) {
    return true;
  }
  const name = (row.chain_name ?? "").toLowerCase();
  return /sepolia|testnet|goerli|holesky|devnet|fuji|mumbai|amoy/.test(name);
}

function SkeletonRow() {
  return (
    <View className="flex-row items-center gap-3 py-2.5">
      <View className="flex-1">
        <SingleLoadingSekeleton width={120} height={12} borderRadius={4} />
        <SingleLoadingSekeleton
          width={90}
          height={10}
          borderRadius={4}
          style={{ marginTop: 6 }}
        />
      </View>
      <View className="items-end">
        <SingleLoadingSekeleton width={54} height={14} borderRadius={4} />
        <SingleLoadingSekeleton
          width={34}
          height={10}
          borderRadius={4}
          style={{ marginTop: 6 }}
        />
      </View>
    </View>
  );
}

function SafestPill() {
  return (
    <View className="flex-row items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5">
      <ShieldCheck size={9} color="#059669" />
      <Text className="text-[9px] font-bold text-emerald-700">Safest</Text>
    </View>
  );
}

// Bold-bordered indicator matching the app's strongest identity signal —
// the `border-2 border-light-matte-black` + brand-red treatment on the
// RedemptionCatalog product tiles and the Prev/Next PagerButton — so the
// box is unmistakably "ours" in both states (black ring always, red fill
// when checked).
function Checkbox({ checked }: { checked: boolean }) {
  return (
    <View
      className={`w-5 h-5 rounded-md border-2 border-light-matte-black items-center justify-center ${
        checked ? "bg-light-primary-red" : "bg-white"
      }`}
    >
      {checked ? <Check size={13} color="#ffffff" strokeWidth={3} /> : null}
    </View>
  );
}

function OpportunityRowItem({
  row,
  isTop,
  showTier,
  selected,
  onToggle,
}: {
  row: OpportunityRow;
  isTop: boolean;
  showTier: boolean;
  selected: boolean;
  onToggle?: () => void;
}) {
  const name = prettyProtocol(row.protocol_slug);
  const tierKey = String(row.tier ?? "").toLowerCase();
  const tierLabel = TIER_LABEL[tierKey] ?? tierKey;
  const tierClass = TIER_PILL_COLOR[tierKey] ?? "bg-gray-100 text-gray-700";
  const chain = chainLabel(row.chain_name, row.chain_id, row.namespace);
  const tvl = formatTvl(row.tvl_usd);
  const safety = formatSafety(row.score);
  const meta = [row.asset_symbol, chain].filter(Boolean).join(" · ");
  const sevenDay = formatApy(row.apy_7d_avg);

  return (
    <Pressable
      onPress={onToggle}
      disabled={!onToggle}
      android_ripple={onToggle ? { color: "rgba(0,0,0,0.04)" } : undefined}
      className={`flex-row items-center gap-3 active:opacity-70 px-3.5 py-3 mb-1.5 rounded-2xl border ${
        selected
          ? "border-light-primary-red bg-light-primary-red/10"
          : "border-light-matte-black/10 bg-white"
      }`}
    >
      <Checkbox checked={selected} />
      <View className="flex-1 min-w-0">
        <View className="flex-row items-center gap-1.5">
          <Text
            className={`text-sm font-semibold shrink ${
              selected ? "text-light-primary-red" : "text-light-matte-black"
            }`}
            numberOfLines={1}
          >
            {name}
          </Text>
          {isTop ? <SafestPill /> : null}
        </View>
        {meta ? (
          <Text className="text-[11px] text-gray-500 mt-0.5" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        <View className="flex-row items-center flex-wrap gap-x-1 mt-0.5">
          {tvl ? (
            <Text className="text-[11px] text-gray-400">{tvl}</Text>
          ) : null}
          {safety ? (
            <Text className="text-[11px] text-gray-400">
              {tvl ? "· " : ""}
              {safety}
            </Text>
          ) : null}
          {row.il_exposure ? (
            <Text className="text-[11px] text-rose-600">· IL risk</Text>
          ) : null}
        </View>
      </View>

      <View className="items-end">
        <Text className="text-base font-bold text-emerald-600">
          {formatApy(row.apy)}
        </Text>
        {sevenDay !== "—" ? (
          <Text className="text-[10px] text-gray-400 mt-0.5">
            7d {sevenDay}
          </Text>
        ) : null}
        {showTier && tierLabel ? (
          <View
            className={`rounded-full px-2 py-0.5 mt-1 ${tierClass.split(" ")[0]}`}
          >
            <Text
              className={`text-[10px] font-semibold ${tierClass.split(" ")[1]}`}
            >
              {tierLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const OpportunityListCard: React.FC<
  ToolComponentProps<OpportunityInput, OpportunityOutput>
> = ({ state, input, output, onUserPrompt }) => {
  const { data: strategy } = useUserStrategy();
  const [page, setPage] = useState(0);
  // Multi-select deposit builder: checked rows + their per-row amount,
  // keyed by the stable rowKey so a selection survives paging.
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const toggleRow = (key: string) => {
    tapFeedback();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const inputTierLabel = input?.tier
    ? (TIER_LABEL[input.tier] ?? input.tier)
    : null;

  // Rank by safety (score desc) — users asked to lead with the safest
  // venue, not the highest yield — with APY as the tiebreak. Testnets
  // always sink to the bottom and are hidden entirely in production when
  // at least one mainnet row exists. Memoised so the sort/filter doesn't
  // re-run on every page change.
  const ranked = useMemo(() => {
    const all = output?.data?.opportunities ?? [];
    const mainnet = all.filter((r) => !isTestnetRow(r));
    const visible = !__DEV__ && mainnet.length > 0 ? mainnet : all;
    return [...visible].sort((a, b) => {
      const at = isTestnetRow(a) ? 1 : 0;
      const bt = isTestnetRow(b) ? 1 : 0;
      if (at !== bt) return at - bt;
      const byScore = scoreNumber(b.score) - scoreNumber(a.score);
      if (byScore !== 0) return byScore;
      return apyNumber(b.apy) - apyNumber(a.apy);
    });
  }, [output]);

  const headerAsset = useMemo(() => {
    const assets = new Set(
      ranked.map((r) => r.asset_symbol).filter(Boolean) as string[],
    );
    return assets.size === 1 ? [...assets][0] : null;
  }, [ranked]);

  const header = inputTierLabel
    ? `${inputTierLabel} opportunities`
    : headerAsset
      ? `Yield on your ${headerAsset}`
      : "Yield opportunities";

  if (state === "input-streaming" || state === "input-available" || !output) {
    return (
      <View className="my-1.5 rounded-2xl border border-light-matte-black/10 bg-white px-3.5 py-3">
        <View className="flex-row items-center gap-2 mb-1">
          <TrendingUp size={14} color={BRAND_RED} />
          <Text className="text-xs font-bold uppercase tracking-wide text-light-matte-black">
            {header}
          </Text>
          <View className="ml-auto">
            <SingleLoadingSekeleton width={50} height={10} borderRadius={4} />
          </View>
        </View>
        <View className="gap-1.5">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      </View>
    );
  }

  if (state === "output-error" || output.status === "failed") {
    if (__DEV__ && output.error) {
      console.warn("[OpportunityListCard] tool result failed:", output.error);
    }
    if (output.error === "authentication_required") {
      return (
        <View className="my-1.5 rounded-2xl border border-light-matte-black/10 bg-white px-3.5 py-4">
          <View className="flex-row items-center gap-2 mb-2">
            <View className="w-8 h-8 rounded-full bg-light-primary-red/10 items-center justify-center">
              <LogIn size={16} color={BRAND_RED} />
            </View>
            <Text className="text-sm font-semibold text-light-matte-black">
              Sign in to explore DeFi
            </Text>
          </View>
          <Text className="text-sm text-light-matte-black/70 mb-3">
            Sign in to see real-time yield opportunities tailored to your
            wallet&apos;s risk profile.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/auth")}
            className="bg-light-primary-red rounded-full px-5 py-2.5 self-start"
          >
            <Text className="text-white font-semibold text-sm">Sign in</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View className="my-1.5 rounded-2xl border border-light-primary-red/30 bg-light-primary-red/5 px-3.5 py-3">
        <View className="flex-row items-center gap-2">
          <AlertTriangle size={14} color={BRAND_RED} />
          <Text className="text-xs font-bold uppercase tracking-wide text-light-primary-red">
            Couldn&apos;t load opportunities
          </Text>
        </View>
        <Text className="text-sm text-light-matte-black/80 mt-1.5">
          We couldn&apos;t load yield opportunities right now. Please try again
          in a moment.
        </Text>
      </View>
    );
  }

  if (ranked.length === 0) {
    return (
      <View className="my-1.5 rounded-2xl border border-light-matte-black/10 bg-white px-3.5 py-3">
        <View className="flex-row items-center gap-2">
          <ShieldCheck size={14} color={BRAND_RED} />
          <Text className="text-xs font-bold uppercase tracking-wide text-light-matte-black">
            {header}
          </Text>
        </View>
        <Text className="text-sm text-light-matte-black/80 mt-1.5">
          No matches for these filters right now.
        </Text>
        {onUserPrompt ? (
          <TouchableOpacity
            onPress={() =>
              onUserPrompt(
                "Show me yield options across all risk levels and chains, even smaller pools.",
              )
            }
            activeOpacity={0.85}
            className="mt-2.5 flex-row items-center justify-center gap-2 rounded-xl border border-light-primary-red/20 bg-light-primary-red/5 px-3 py-2.5"
          >
            <Search size={14} color={BRAND_RED} />
            <Text className="text-xs font-semibold text-light-primary-red">
              See every yield option
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  const pageCount = Math.max(1, Math.ceil(ranked.length / PREVIEW_COUNT));
  const safePage = Math.min(page, pageCount - 1);
  const shown = ranked.slice(
    safePage * PREVIEW_COUNT,
    safePage * PREVIEW_COUNT + PREVIEW_COUNT,
  );
  // Tier uniformity is computed across the full list (not the current
  // page) so the "All Low risk" header chip stays stable while paging.
  const allTiers = new Set(
    ranked.map((r) => String(r.tier ?? "").toLowerCase()).filter(Boolean),
  );
  const uniformTier = allTiers.size === 1 ? [...allTiers][0] : null;
  const uniformTierClass = uniformTier
    ? (TIER_PILL_COLOR[uniformTier] ?? "bg-gray-100 text-gray-700")
    : null;
  const topHasScore = Number.isFinite(scoreNumber(ranked[0]?.score));

  // Selected rows (in safety order, across all pages) drive the deposit
  // builder. A leg is "depositable" once it has a positive amount; the
  // card stays protocol-agnostic — it forwards every depositable pick and
  // lets the agent triage which protocols it actually supports.
  const selectedRows = ranked.filter((r) => selected.has(rowKey(r)));
  const depositable = selectedRows.filter(
    (r) => amountValue(amounts[rowKey(r)]) > 0,
  );
  const canDeposit = depositable.length > 0;
  // Submitting needs the live agent callback (undefined once the card
  // goes historical); selection/amount entry stays usable regardless.
  const canSubmit = canDeposit && !!onUserPrompt;
  const submitDeposit = () => {
    if (!onUserPrompt || depositable.length === 0) return;
    const legs = depositable.map((r) => {
      const sym = r.asset_symbol ?? input?.asset_symbol ?? "tokens";
      const chain = chainLabel(r.chain_name, r.chain_id, r.namespace);
      return `${amounts[rowKey(r)]} ${sym} into ${prettyProtocol(
        r.protocol_slug,
      )}${chain ? ` on ${chain}` : ""}`;
    });
    onUserPrompt(
      legs.length === 1
        ? `Deposit ${legs[0]} from my wallet. Please proceed.`
        : `Deposit the following from my wallet: ${legs.join("; ")}. Please proceed.`,
    );
    setSelected(new Set());
    setAmounts({});
  };

  return (
    <View className="my-1.5-">
      <View className="flex-row items-center gap-2 px-3.5 py-3 mb-1.5 rounded-2xl border border-light-matte-black/10 bg-white">
        <TrendingUp size={14} color={BRAND_RED} />
        <Text className="text-xs font-bold uppercase tracking-wide text-light-matte-black">
          {header}
        </Text>
        <View className="ml-auto flex-row items-center gap-2">
          {uniformTier && uniformTierClass ? (
            <View
              className={`rounded-full px-2 py-0.5 ${uniformTierClass.split(" ")[0]}`}
            >
              <Text
                className={`text-[10px] font-semibold ${uniformTierClass.split(" ")[1]}`}
              >
                All {TIER_LABEL[uniformTier] ?? uniformTier}
              </Text>
            </View>
          ) : null}
          <Text className="text-[10px] text-gray-500">
            {ranked.length} option{ranked.length === 1 ? "" : "s"}
          </Text>
        </View>
      </View>

      <View className="gap-1.5-">
        {shown.map((row, idx) => {
          const key = rowKey(row);
          return (
            <OpportunityRowItem
              key={key}
              row={row}
              isTop={
                safePage === 0 && idx === 0 && ranked.length > 1 && topHasScore
              }
              showTier={!uniformTier}
              selected={selected.has(key)}
              onToggle={() => toggleRow(key)}
            />
          );
        })}
      </View>

      {pageCount > 1 ? (
        <View className="mt-2 flex-row items-center justify-between px-0.5">
          <PagerButton
            direction="prev"
            disabled={safePage === 0}
            onPress={() => setPage((p) => Math.max(0, p - 1))}
          />
          <Text className="text-[11px] text-gray-500">
            Page {safePage + 1} of {pageCount}
          </Text>
          <PagerButton
            direction="next"
            disabled={safePage >= pageCount - 1}
            onPress={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          />
        </View>
      ) : null}

      {selectedRows.length > 0 ? (
        <View className="mt-3 rounded-2xl border border-light-matte-black/10 bg-white px-3.5 py-3">
          <View className="flex-row items-center gap-1.5 mb-2">
            <Coins size={13} color={BRAND_RED} />
            <Text className="text-[11px] font-bold uppercase tracking-wide text-light-matte-black">
              Amount to deposit
            </Text>
          </View>
          {selectedRows.map((r) => {
            const key = rowKey(r);
            const sym = r.asset_symbol ?? input?.asset_symbol ?? "—";
            return (
              <View key={key} className="flex-row items-center gap-3 py-1.5">
                <View className="w-14 items-center rounded-xl border border-light-primary-red/20 bg-light-primary-red/10 px-1.5 py-2.5">
                  <Text
                    className="text-[11px] font-bold text-light-matte-black"
                    numberOfLines={1}
                  >
                    {sym}
                  </Text>
                </View>
                <TextInput
                  value={amounts[key] ?? ""}
                  onChangeText={(t) =>
                    setAmounts((a) => ({ ...a, [key]: sanitizeAmount(t) }))
                  }
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#9ca3af"
                  className="flex-1 rounded-xl border border-light-matte-black/10 bg-white px-3 py-2.5 text-sm text-light-matte-black"
                />
                <Text
                  className="w-[72px] text-right text-[11px] font-semibold text-light-primary-red"
                  numberOfLines={1}
                >
                  {prettyProtocol(r.protocol_slug)}
                </Text>
              </View>
            );
          })}
          <TouchableOpacity
            onPress={submitDeposit}
            disabled={!canSubmit}
            activeOpacity={0.85}
            className={`mt-2.5 flex-row items-center justify-center gap-2 rounded-full px-4 py-2.5 ${
              canSubmit ? "bg-light-primary-red" : "bg-light-matte-black/15"
            }`}
          >
            <Text
              className={`text-sm font-bold ${
                canSubmit ? "text-white" : "text-light-matte-black/40"
              }`}
            >
              {canDeposit
                ? `Deposit ${depositable.length} selected`
                : "Enter an amount to deposit"}
            </Text>
            {canSubmit ? (
              <ArrowRight size={16} color="#ffffff" strokeWidth={2.5} />
            ) : null}
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {strategy && onUserPrompt ? (
            <TouchableOpacity
              onPress={() =>
                onUserPrompt(
                  "Pick the best opportunity for me from the ones you just listed and propose a deposit.",
                )
              }
              activeOpacity={0.85}
              className="mt-3 flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-light-primary-red/40 bg-light-primary-red/5 px-3 py-2.5"
            >
              <Sparkles size={14} color={BRAND_RED} />
              <Text className="text-xs font-semibold text-light-primary-red">
                Not sure? Let Takumi pick for you
              </Text>
            </TouchableOpacity>
          ) : null}
          <SetupStrategyCTA />
        </>
      )}
    </View>
  );
};

export default OpportunityListCard;
