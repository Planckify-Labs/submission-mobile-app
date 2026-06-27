import { z } from "zod";
import type { TColorFill } from "@/api/types/dapp";
import { COLORS } from "@/constants/dapps-browser";

/**
 * Validates and normalizes the backend `appearance` JSON into concrete
 * colors the cards/banners can render. Because the column is untyped
 * (`Json`), a partial / legacy / malformed value must still produce a
 * sensible result — never crash — so we parse with zod and fall back to
 * design tokens. This is the single source of styling resolution shared
 * by every dapp surface (cards, category chips, promo banners).
 */

const hex = z.string().regex(/^#([0-9a-fA-F]{3,8})$/);

const colorFillSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("solid"), color: hex }),
  z.object({
    type: z.literal("gradient"),
    colors: z.array(hex).min(2),
    angle: z.number().optional(),
  }),
]);

const appearanceSchema = z
  .object({
    v: z.literal(1).optional(),
    background: colorFillSchema.optional(),
    foreground: hex.optional(),
    accent: hex.optional(),
    logoBackground: colorFillSchema.optional(),
  })
  .passthrough(); // tolerate unknown future keys

export interface TResolvedAppearance {
  backgroundColor: string;
  foreground: string;
  accent: string;
  logoBackground: string;
}

const CARD_DEFAULTS: TResolvedAppearance = {
  backgroundColor: COLORS.WHITE,
  foreground: COLORS.MATTE_BLACK,
  accent: COLORS.PRIMARY_RED,
  logoBackground: "#c71c4b08",
};

// No gradient renderer is wired yet (expo-linear-gradient isn't a dep),
// so a gradient fill collapses to its first stop. When a renderer lands,
// this is the only place that changes.
const fillToColor = (fill?: TColorFill | null): string | undefined => {
  if (!fill) return undefined;
  return fill.type === "solid" ? fill.color : fill.colors[0];
};

/**
 * @param raw      the `appearance` value straight off the API (unknown shape)
 * @param defaults per-surface fallbacks (e.g. banners want an accent fill,
 *                 not white) merged under the global card defaults
 */
export const resolveAppearance = (
  raw: unknown,
  defaults?: Partial<TResolvedAppearance>,
): TResolvedAppearance => {
  const base = { ...CARD_DEFAULTS, ...defaults };
  const parsed = appearanceSchema.safeParse(raw);
  if (!parsed.success) return base;
  const a = parsed.data;
  return {
    backgroundColor: fillToColor(a.background) ?? base.backgroundColor,
    foreground: a.foreground ?? base.foreground,
    accent: a.accent ?? base.accent,
    logoBackground: fillToColor(a.logoBackground) ?? base.logoBackground,
  };
};
