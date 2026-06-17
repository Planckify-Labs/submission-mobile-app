/**
 * Intent schema — the structured object the Takumi DeFi agent emits for
 * the Sui Intent Engine (Sui Overflow 2026 Phase 1, spec §3).
 *
 * The LLM does NOT emit PTB bytes or Move calls — it emits this small,
 * validated `Intent` and the compiler (`compileIntentToPtb.ts`) owns the
 * translation to a Programmable Transaction Block. Keeping the model's
 * surface narrow (symbols + human amounts, never coinTypes / package ids /
 * raw amounts) eliminates a whole class of "agent invented a contract"
 * failures (SI-2).
 *
 * This module is React-free and importable from the agent executor, the
 * compiler, and the Vitest harness without pulling in any chain SDK.
 */

import { z } from "zod";

export const IntentAction = z.enum(["supply", "withdraw", "swap"]);
export type TIntentAction = z.infer<typeof IntentAction>;

/**
 * A human amount string — exactly as the user said it ("100", "5.5").
 * The raw MIST/atom value is computed by the compiler/executor via the
 * kit's `parse*` helpers and is NEVER trusted from the model (SI-2).
 */
const Amount = z.object({
  human: z.string().min(1),
});
export type TAmount = z.infer<typeof Amount>;

export const IntentSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("supply"),
    // Scallop is the only Phase-1 lending venue; the registry only resolves
    // it on mainnet (§4.6) so the literal stays even though it is gated.
    venue: z.enum(["scallop"]),
    asset: z.string().min(1), // symbol, e.g. "USDC" — resolved to coinType by the compiler
    amount: Amount,
  }),
  z.object({
    action: z.literal("withdraw"),
    venue: z.enum(["scallop"]),
    asset: z.string().min(1),
    amount: Amount.optional(), // omit = withdraw all
  }),
  z.object({
    action: z.literal("swap"),
    // NO venue — the selector picks the DEX by active network (DeepBook on
    // testnet, Cetus/7K/DeepBook on mainnet). The model must not choose a
    // DEX (§4.5 / §4.6).
    fromAsset: z.string().min(1),
    toAsset: z.string().min(1),
    amount: Amount, // exact-in
    maxSlippageBps: z.number().int().min(1).max(5000).default(50), // 0.5% default
  }),
]);

export type Intent = z.infer<typeof IntentSchema>;
export type SupplyIntent = Extract<Intent, { action: "supply" }>;
export type WithdrawIntent = Extract<Intent, { action: "withdraw" }>;
export type SwapIntent = Extract<Intent, { action: "swap" }>;

/**
 * Parse an unknown LLM tool input into a validated `Intent`. The agent
 * tool's `inputSchema` is the single source of truth (mirrors
 * `mintPaymentIntentInputSchema`) — this is the runtime guard at the
 * executor boundary. Returns `null` on failure so the caller can raise a
 * typed `ExecutorError(invalid_input)` without leaking the zod issue text
 * to the user (CLAUDE.md user-facing-errors).
 */
export function parseIntent(input: unknown): Intent | null {
  const parsed = IntentSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}
