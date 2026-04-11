/**
 * PreviewCard — task 13 of the Takumi Agent Protocol rollout.
 *
 * Rendered inline in the chat timeline (NOT as a modal). Shows a
 * server-built `human_summary`, a circular countdown, and two actions:
 *
 *   - "Approve now"  → fires `onConfirm()` immediately
 *   - "Cancel"       → fires `onDismiss()` immediately
 *
 * If the user does nothing for `autoConfirmMs`, the timer fires
 * `onConfirm()` automatically. The timer pauses while the app is
 * backgrounded and while the optional `isReconnecting` prop is true
 * (task 09 will wire the latter from the SSE dispatcher's connection
 * state).
 *
 * Spec: `AGENT_PROTOCOL.md` §5 UX table, §10 "Tool Pending Handler".
 *
 * The countdown logic lives in `usePreviewCountdown` so it can be
 * unit-tested without a React renderer.
 */

import { CheckCircle2, Wifi, XCircle } from "lucide-react-native";
import type React from "react";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { usePreviewCountdown } from "./usePreviewCountdown";

export interface PreviewCardProps {
  /** Server-built `payload.meta.human_summary` string. */
  summary: string;
  /** Milliseconds to wait before auto-firing `onConfirm`. Defaults to 3000. */
  autoConfirmMs?: number;
  /** User tapped "Approve now" OR the countdown elapsed. */
  onConfirm: () => void;
  /** User tapped "Cancel" — dispatcher should treat as `user_declined`. */
  onDismiss: () => void;
  /**
   * When true, the card shows a "Reconnecting…" overlay and pauses the
   * countdown. Task 09's SSE dispatcher will wire this from the
   * connection state so we do not auto-confirm during a disconnect.
   */
  isReconnecting?: boolean;
}

const CIRCLE_SIZE = 36;
const CIRCLE_STROKE = 3;
const CIRCLE_RADIUS = (CIRCLE_SIZE - CIRCLE_STROKE) / 2;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

// Brand colors pulled from `tailwind.config.js`. We do not invent new
// tokens here — these are the same values the rest of the agent UI uses.
const BRAND_RED = "#c71c4b";
const MATTE_BLACK = "#20222c";
const NEUTRAL_TRACK = "#e5e7eb";
const SUCCESS_GREEN = "#10b981";
const MUTED_GRAY = "#6b7280";

const PreviewCard: React.FC<PreviewCardProps> = ({
  summary,
  autoConfirmMs = 3000,
  onConfirm,
  onDismiss,
  isReconnecting = false,
}) => {
  const { status, remainingMs, progress, reduceMotion, confirmNow, cancel } =
    usePreviewCountdown({
      autoConfirmMs,
      onConfirm,
      onDismiss,
      isReconnecting,
    });

  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

  // Countdown ring: stroke-dashoffset shrinks as progress grows so the
  // ring visibly fills. When reduced-motion is enabled we render a
  // static full ring as an indicator only.
  const strokeDashoffset = useMemo(() => {
    if (reduceMotion) return 0;
    return CIRCLE_CIRCUMFERENCE * (1 - progress);
  }, [progress, reduceMotion]);

  const a11yLabel = useMemo(() => {
    if (status === "confirmed") return `Approved. ${summary}`;
    if (status === "cancelled") return `Cancelled. ${summary}`;
    if (status === "paused") {
      return isReconnecting
        ? `${summary}. Reconnecting, auto-confirm paused.`
        : `${summary}. Auto-confirm paused.`;
    }
    return `${summary}. Auto-confirming in ${remainingSeconds} seconds. Double-tap to approve now.`;
  }, [status, summary, remainingSeconds, isReconnecting]);

  // Terminal (resolved) state — collapsed, non-interactive.
  if (status === "confirmed" || status === "cancelled") {
    const isApproved = status === "confirmed";
    return (
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={a11yLabel}
        className={`my-1.5 rounded-2xl border px-3.5 py-2.5 ${
          isApproved
            ? "bg-green-50/60 border-green-200"
            : "bg-gray-50 border-gray-200"
        }`}
      >
        <View className="flex-row items-center gap-2">
          {isApproved ? (
            <CheckCircle2 size={16} color={SUCCESS_GREEN} />
          ) : (
            <XCircle size={16} color={MUTED_GRAY} />
          )}
          <Text
            className={`text-xs font-bold ${
              isApproved ? "text-green-700" : "text-gray-500"
            }`}
          >
            {isApproved ? "Approved" : "Cancelled"}
          </Text>
        </View>
        <Text
          className="text-sm text-light-matte-black/70 mt-1"
          // Long Indonesian text / addresses must wrap, not clip.
          numberOfLines={0}
        >
          {summary}
        </Text>
      </View>
    );
  }

  // Active state — countdown + actions.
  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={a11yLabel}
      accessibilityLiveRegion="polite"
      className="my-1.5 rounded-2xl border border-light-primary-red/30 bg-light-primary-red/5 px-3.5 py-3"
    >
      <View className="flex-row items-start gap-3">
        {/* Circular countdown indicator */}
        <View
          style={{
            width: CIRCLE_SIZE,
            height: CIRCLE_SIZE,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
            <Circle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={CIRCLE_RADIUS}
              stroke={NEUTRAL_TRACK}
              strokeWidth={CIRCLE_STROKE}
              fill="transparent"
            />
            <Circle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={CIRCLE_RADIUS}
              stroke={BRAND_RED}
              strokeWidth={CIRCLE_STROKE}
              strokeLinecap="round"
              fill="transparent"
              strokeDasharray={`${CIRCLE_CIRCUMFERENCE} ${CIRCLE_CIRCUMFERENCE}`}
              strokeDashoffset={strokeDashoffset}
              // Start the ring at 12 o'clock and sweep clockwise.
              transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
            />
          </Svg>
          <View
            style={{
              position: "absolute",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text className="text-[11px] font-bold text-light-primary-red">
              {remainingSeconds}
            </Text>
          </View>
        </View>

        {/* Summary + actions */}
        <View className="flex-1">
          <Text className="text-[11px] font-bold text-light-primary-red/80 uppercase tracking-wide mb-1">
            {status === "paused"
              ? isReconnecting
                ? "Reconnecting…"
                : "Paused"
              : "Preview"}
          </Text>
          <Text
            className="text-sm text-light-matte-black leading-5"
            // Wrap unlimited — summary may be long Indonesian text or full
            // wallet addresses. Never clip.
            numberOfLines={0}
          >
            {summary}
          </Text>

          {status === "paused" && isReconnecting && (
            <View className="flex-row items-center gap-1.5 mt-2">
              <Wifi size={12} color={MUTED_GRAY} />
              <Text className="text-[11px] text-gray-500">
                Waiting for connection to resume…
              </Text>
            </View>
          )}

          <View className="flex-row gap-2 mt-2.5">
            <Pressable
              onPress={cancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 active:opacity-70"
            >
              <Text
                className="text-xs font-semibold text-light-matte-black text-center"
                style={{ color: MATTE_BLACK }}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={confirmNow}
              accessibilityRole="button"
              accessibilityLabel="Approve now"
              className="flex-1 rounded-xl bg-light-primary-red px-3 py-2 active:opacity-80"
            >
              <Text className="text-xs font-semibold text-white text-center">
                Approve now
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
};

export default PreviewCard;
