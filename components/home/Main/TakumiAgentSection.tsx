import {
  ArrowRight,
  ArrowUp,
  Clock,
  Gift,
  type LucideIcon,
  Mic,
  Repeat,
  Send,
  Sparkles,
  TrendingUp,
} from "lucide-react-native";
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import ActivitySection, { type ActivitySectionRef } from "./ActivitySection";

export interface TakumiAgentSectionRef {
  refetch: () => void;
}

export interface TakumiAgentSectionProps {
  /** Fired when the user taps the "Ask Takumi anything…" bar or the mic. */
  onAsk?: () => void;
  /** Fired with a ready-made prompt when a card / quick chip is tapped. */
  onSelectPrompt?: (prompt: string) => void;
  /** Fired when the spotlight "Show me" CTA is tapped. */
  onSpotlightPress?: () => void;
}

type CardVariant = "red" | "dark" | "light";

interface Capability {
  id: string;
  label: string;
  sample: string;
  prompt: string;
  icon: LucideIcon;
  variant: CardVariant;
}

const CAPABILITIES: Capability[] = [
  {
    id: "pay",
    label: "Pay & Send",
    sample: "Send 50 USDT",
    prompt: "Send 50 USDT to a friend",
    icon: Send,
    variant: "red",
  },
  {
    id: "swap",
    label: "Swap",
    sample: "ETH → USDC",
    prompt: "Swap 1 ETH for USDC",
    icon: Repeat,
    variant: "dark",
  },
  {
    id: "earn",
    label: "Earn yield",
    sample: "earn on USDC",
    prompt: "Earn yield on my idle USDC",
    icon: TrendingUp,
    variant: "light",
  },
  {
    id: "redeem",
    label: "Redeem",
    sample: "use my points",
    prompt: "What can I redeem with my points?",
    icon: Gift,
    variant: "light",
  },
];

const QUICK_PROMPTS: {
  id: string;
  label: string;
  prompt: string;
  icon: LucideIcon;
}[] = [
  { id: "send", label: "Send", prompt: "Send 50 USDT to a friend", icon: Send },
  { id: "swap", label: "Swap", prompt: "Swap 1 ETH for USDC", icon: Repeat },
  {
    id: "earn",
    label: "Earn",
    prompt: "Earn yield on my USDC",
    icon: TrendingUp,
  },
  {
    id: "redeem",
    label: "Redeem",
    prompt: "What can I redeem with my points?",
    icon: Gift,
  },
];

const RAIL_GAP = 12;
const CARD_HEIGHT = 176;

const VARIANT_STYLES: Record<
  CardVariant,
  {
    card: string;
    iconWrap: string;
    iconColor: string;
    title: string;
    sample: string;
  }
> = {
  red: {
    card: "bg-light-primary-red",
    iconWrap: "bg-white/20",
    iconColor: "#ffffff",
    title: "text-white",
    sample: "text-white/70",
  },
  dark: {
    card: "bg-light-matte-black",
    iconWrap: "bg-white/15",
    iconColor: "#ffffff",
    title: "text-white",
    sample: "text-white/60",
  },
  light: {
    card: "bg-light-primary-red/10 border border-light-primary-red/20",
    iconWrap: "bg-light",
    iconColor: "#c71c4b",
    title: "text-light-matte-black",
    sample: "text-light-matte-black/45",
  },
};

function SpotlightCard({
  width,
  onPress,
}: {
  width: number;
  onPress?: () => void;
}) {
  return (
    <View
      style={{ width, height: CARD_HEIGHT }}
      className="rounded-2xl bg-light-primary-red p-4 overflow-hidden justify-between"
    >
      {/* decorative layers */}
      <View
        pointerEvents="none"
        className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full bg-white/5"
      />
      <View
        pointerEvents="none"
        className="absolute right-3 bottom-1 opacity-100"
      >
        <TrendingUp size={84} color="rgba(255,255,255,0.12)" />
      </View>

      {/* top row */}
      <View className="flex-row items-center justify-between">
        <Text className="text-white/70 text-[10px] font-extrabold tracking-widest">
          ✦ TAKUMI PICK
        </Text>
        <View className="flex-row items-center gap-1 bg-white/20 rounded-full px-2.5 py-1">
          <ArrowUp size={11} color="#ffffff" strokeWidth={3} />
          <Text className="text-white text-[10px] font-bold">~8% APY</Text>
        </View>
      </View>

      {/* headline */}
      <View>
        <Text className="text-white font-extrabold text-[18px] leading-[22px]">
          Grow your idle{"\n"}USDC, hands-free
        </Text>
        <Text className="text-white/75 text-[11px] mt-1">
          Auto-earn yield · I cover the gas.
        </Text>
      </View>

      {/* cta */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        className="self-start flex-row items-center gap-1 bg-light rounded-full px-4 py-2"
      >
        <Text className="text-light-primary-red font-extrabold text-[12px]">
          Show me
        </Text>
        <ArrowRight size={14} color="#c71c4b" strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}

function CapabilityCard({
  item,
  width,
  onPress,
}: {
  item: Capability;
  width: number;
  onPress?: () => void;
}) {
  const styles = VARIANT_STYLES[item.variant];
  const Icon = item.icon;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{ width, height: CARD_HEIGHT }}
      className={`rounded-2xl p-3.5 justify-between ${styles.card}`}
    >
      <View
        className={`w-9 h-9 rounded-full items-center justify-center ${styles.iconWrap}`}
      >
        <Icon size={18} color={styles.iconColor} strokeWidth={2.2} />
      </View>
      <View>
        <Text className={`font-extrabold text-[13px] ${styles.title}`}>
          {item.label}
        </Text>
        <Text className={`text-[10px] mt-0.5 ${styles.sample}`}>
          “{item.sample}”
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const TakumiAgentSection = forwardRef<
  TakumiAgentSectionRef,
  TakumiAgentSectionProps
>(({ onAsk, onSelectPrompt, onSpotlightPress }, ref) => {
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<"takumi" | "history">("takumi");
  const [activeCard, setActiveCard] = useState(0);
  const activityRef = useRef<ActivitySectionRef>(null);

  // The History tab hosts the real activity list; forward refresh to it.
  useImperativeHandle(ref, () => ({
    refetch: () => activityRef.current?.refetch(),
  }));

  // Rail card geometry. The card has horizontal padding of 18 (p-[18px]); the
  // rail bleeds to the card edges with a negative margin so the next card peeks.
  const innerWidth = width - 32 /* px-4 */ - 36 /* p-[18px] x2 */;
  const heroWidth = Math.round(innerWidth * 0.8);
  const capWidth = Math.round(innerWidth * 0.46);

  const snapOffsets = useMemo(() => {
    const widths = [heroWidth, ...CAPABILITIES.map(() => capWidth)];
    const offsets: number[] = [];
    let acc = 0;
    for (const w of widths) {
      offsets.push(acc);
      acc += w + RAIL_GAP;
    }
    return offsets;
  }, [heroWidth, capWidth]);

  const handleRailScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      let nearest = 0;
      let best = Number.POSITIVE_INFINITY;
      snapOffsets.forEach((offset, i) => {
        const d = Math.abs(offset - x);
        if (d < best) {
          best = d;
          nearest = i;
        }
      });
      if (nearest !== activeCard) setActiveCard(nearest);
    },
    [snapOffsets, activeCard],
  );

  const railLength = CAPABILITIES.length + 1;

  return (
    <View className="px-4">
      <View className="bg-light rounded-[22px] w-full p-[18px] gap-3.5">
        {/* tab switcher */}
        <View className="flex-row bg-light-main-container rounded-full p-1">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab("takumi")}
            className={`flex-1 flex-row items-center justify-center gap-1.5 py-2 rounded-full ${
              activeTab === "takumi" ? "bg-light" : ""
            }`}
            style={
              activeTab === "takumi"
                ? {
                    shadowColor: "#20222c",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 2,
                  }
                : undefined
            }
          >
            <Sparkles
              size={14}
              color={activeTab === "takumi" ? "#c71c4b" : "#9aa0ad"}
              strokeWidth={2.4}
            />
            <Text
              className={`text-[13px] font-bold ${
                activeTab === "takumi"
                  ? "text-light-primary-red"
                  : "text-light-matte-black/40"
              }`}
            >
              TakumiAgent
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab("history")}
            className={`flex-1 flex-row items-center justify-center gap-1.5 py-2 rounded-full ${
              activeTab === "history" ? "bg-light" : ""
            }`}
            style={
              activeTab === "history"
                ? {
                    shadowColor: "#20222c",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 2,
                  }
                : undefined
            }
          >
            <Clock
              size={14}
              color={activeTab === "history" ? "#c71c4b" : "#9aa0ad"}
              strokeWidth={2.4}
            />
            <Text
              className={`text-[13px] font-bold ${
                activeTab === "history"
                  ? "text-light-primary-red"
                  : "text-light-matte-black/40"
              }`}
            >
              History
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "takumi" ? (
          <>
            {/* greeting */}
            <View className="flex-row items-center gap-2.5">
              <View className="w-9 h-9 rounded-full bg-light-primary-red items-center justify-center">
                <Sparkles size={18} color="#ffffff" strokeWidth={2.2} />
              </View>
              <View className="flex-1">
                <Text className="text-light-matte-black font-extrabold text-[15px]">
                  Hi, I'm TakumiAgent 👋
                </Text>
                <Text className="text-light-matte-black/45 text-[11px]">
                  Swipe to see what I can do →
                </Text>
              </View>
            </View>

            {/* swipe rail: spotlight + capability cards */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToOffsets={snapOffsets}
              onScroll={handleRailScroll}
              scrollEventThrottle={16}
              style={{ marginHorizontal: -18 }}
              contentContainerStyle={{
                gap: RAIL_GAP,
                paddingHorizontal: 18,
              }}
            >
              <SpotlightCard width={heroWidth} onPress={onSpotlightPress} />
              {CAPABILITIES.map((item) => (
                <CapabilityCard
                  key={item.id}
                  item={item}
                  width={capWidth}
                  onPress={() => onSelectPrompt?.(item.prompt)}
                />
              ))}
            </ScrollView>

            {/* rail dots */}
            <View className="flex-row items-center justify-center gap-1.5">
              {Array.from({ length: railLength }).map((_, i) => (
                <View
                  key={i}
                  className={`h-1.5 rounded-full ${
                    i === activeCard
                      ? "w-4 bg-light-primary-red"
                      : "w-1.5 bg-light-matte-black/15"
                  }`}
                />
              ))}
            </View>

            {/* quick prompt chips */}
            <View className="flex-row items-center justify-between gap-1">
              {QUICK_PROMPTS.map((chip) => {
                const Icon = chip.icon;
                return (
                  <TouchableOpacity
                    key={chip.id}
                    activeOpacity={0.8}
                    onPress={() => onSelectPrompt?.(chip.prompt)}
                    className="flex-row items-center gap-1.5 bg-light-main-container grow border border-light-matte-black/5 rounded-full px-3 py-2"
                  >
                    <Icon size={14} color="#c71c4b" strokeWidth={2.4} />
                    <Text className="text-light-matte-black font-bold text-[12px]">
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ask bar */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onAsk}
              className="flex-row items-center gap-2 bg-light-main-container border border-light-matte-black/5 rounded-full pl-4 pr-1.5 py-1.5"
            >
              <Text className="flex-1 text-light-matte-black/40 text-[13px]">
                Ask TakumiAgent anything…
              </Text>
              <View className="w-9 h-9 rounded-full bg-light-primary-red items-center justify-center">
                <Mic size={18} color="#ffffff" strokeWidth={2.2} />
              </View>
            </TouchableOpacity>
          </>
        ) : (
          <ActivitySection ref={activityRef} embedded />
        )}
      </View>
    </View>
  );
});

TakumiAgentSection.displayName = "TakumiAgentSection";

export default TakumiAgentSection;
