/**
 * Three-tier decoded-error contract per §10.3 + §4.10.
 *
 *   Tier 1 — per-program numeric → human table (System / SPL Token /
 *            Token-2022 / ComputeBudget / ATA / ALT / Stake / Memo).
 *   Tier 2 — Anchor-style 4-byte error discriminator → hex code; if
 *            a caller has a matching IDL, that layer translates.
 *   Tier 3 — Fallback — "unknown program error {code}" preserving the
 *            raw code so debuggers can look it up.
 *
 * Inputs come from either a `simulateTransaction` `InstructionError`
 * tuple or a successful `getTransaction`'s `err` field. We accept both
 * shapes in `decodeProgramError`.
 */

export interface DecodedProgramError {
  tier: 1 | 2 | 3;
  programId?: string;
  /** Short machine name, e.g. "InsufficientFunds". */
  name: string;
  /** User-visible detail. */
  detail: string;
  /** Raw numeric code preserved for debugging. */
  rawCode: number;
}

// ---------- Tier 1 — curated per-program tables ----------

const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const SPL_TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const COMPUTE_BUDGET = "ComputeBudget111111111111111111111111111111";
const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const ALT_PROGRAM = "AddressLookupTab1e1111111111111111111111111";
const STAKE_PROGRAM = "Stake11111111111111111111111111111111111111";
const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

const SYSTEM_ERRORS: Record<number, { name: string; detail: string }> = {
  0: { name: "AccountAlreadyInUse", detail: "Account already in use." },
  1: {
    name: "ResultWithNegativeLamports",
    detail: "Instruction would result in negative lamports.",
  },
  2: { name: "InvalidProgramId", detail: "Invalid program id." },
  3: { name: "InvalidAccountData", detail: "Invalid account data." },
  4: {
    name: "AccountDataTooSmall",
    detail: "Account data too small for instruction.",
  },
  5: { name: "InsufficientFunds", detail: "Insufficient funds for fee." },
  6: {
    name: "InvalidAccountOwner",
    detail: "Invalid account owner for the operation.",
  },
  7: {
    name: "ArithmeticOverflow",
    detail: "Arithmetic overflow while computing lamports.",
  },
  8: {
    name: "UnbalancedInstruction",
    detail: "Lamports moved do not balance across accounts.",
  },
  9: { name: "AccountBorrowFailed", detail: "Account borrow failed." },
  10: {
    name: "MaxAccountsExceeded",
    detail: "Too many accounts in the transaction.",
  },
};

const SPL_TOKEN_ERRORS: Record<number, { name: string; detail: string }> = {
  0: {
    name: "NotRentExempt",
    detail: "Account not rent-exempt for the given size.",
  },
  1: { name: "InsufficientFunds", detail: "Insufficient token balance." },
  2: { name: "InvalidMint", detail: "Invalid mint referenced by the account." },
  3: { name: "MintMismatch", detail: "Token mint mismatch." },
  4: { name: "OwnerMismatch", detail: "Token owner does not match signer." },
  5: {
    name: "FixedSupply",
    detail: "Mint has a fixed supply — cannot mint additional tokens.",
  },
  6: {
    name: "AlreadyInUse",
    detail: "Account is already initialised.",
  },
  7: {
    name: "InvalidNumberOfProvidedSigners",
    detail: "Invalid signer count.",
  },
  8: {
    name: "InvalidNumberOfRequiredSigners",
    detail: "Invalid required signer count.",
  },
  9: { name: "UninitializedState", detail: "State account not initialised." },
  10: {
    name: "NativeNotSupported",
    detail: "Operation unsupported on native mint.",
  },
  11: {
    name: "NonNativeHasBalance",
    detail: "Non-native token account has a non-zero balance.",
  },
  12: { name: "InvalidInstruction", detail: "Invalid SPL Token instruction." },
  13: { name: "InvalidState", detail: "Token state invalid for instruction." },
  14: { name: "Overflow", detail: "Arithmetic overflow." },
  15: {
    name: "AuthorityTypeNotSupported",
    detail: "Authority type not supported.",
  },
  16: {
    name: "MintCannotFreeze",
    detail: "Mint lacks freeze authority for this op.",
  },
  17: { name: "AccountFrozen", detail: "Account is frozen." },
  18: { name: "MintDecimalsMismatch", detail: "Mint decimals do not match." },
  19: { name: "NonNativeNotSupported", detail: "Native token required." },
};

const COMPUTE_BUDGET_ERRORS: Record<number, { name: string; detail: string }> =
  {
    0: {
      name: "InstructionLimitExceeded",
      detail: "Computed instruction limit exceeded.",
    },
    1: {
      name: "InvalidInstructionData",
      detail: "Invalid compute-budget instruction data.",
    },
    2: {
      name: "DuplicateInstruction",
      detail: "Duplicate compute-budget instruction.",
    },
  };

const STAKE_ERRORS: Record<number, { name: string; detail: string }> = {
  0: { name: "NoCreditsToRedeem", detail: "No credits to redeem." },
  1: { name: "LockupInForce", detail: "Stake lockup is in force." },
  2: { name: "AlreadyDeactivated", detail: "Stake already deactivated." },
  3: { name: "TooSoonToRedelegate", detail: "Cannot redelegate yet." },
  4: { name: "InsufficientStake", detail: "Insufficient stake to split." },
  5: {
    name: "MergeMismatch",
    detail: "Stake accounts incompatible for merge.",
  },
  6: { name: "CustodianMissing", detail: "Custodian signer required." },
  7: { name: "CustodianSignatureMissing", detail: "Custodian did not sign." },
};

const PROGRAM_TABLES: Record<
  string,
  Record<number, { name: string; detail: string }>
> = {
  [SYSTEM_PROGRAM]: SYSTEM_ERRORS,
  [SPL_TOKEN]: SPL_TOKEN_ERRORS,
  [TOKEN_2022]: SPL_TOKEN_ERRORS, // Token-2022 shares the base SPL numbering; extensions start at 50+.
  [COMPUTE_BUDGET]: COMPUTE_BUDGET_ERRORS,
  [STAKE_PROGRAM]: STAKE_ERRORS,
  [ATA_PROGRAM]: {
    0: {
      name: "InvalidOwner",
      detail: "Associated token account owner does not match expected.",
    },
  },
  [ALT_PROGRAM]: {},
  [MEMO_PROGRAM]: {},
};

// ---------- Tier 2 — Anchor error discriminator ----------

function isAnchorErrorCode(code: number): boolean {
  // Anchor uses 6000+ for program custom errors; adapter displays the
  // hex discriminator so an IDL-armed consumer can resolve the name.
  return code >= 6000;
}

// ---------- API ----------

export function decodeProgramError(input: {
  programId: string;
  code: number;
}): DecodedProgramError {
  const table = PROGRAM_TABLES[input.programId];
  const hit = table?.[input.code];
  if (hit) {
    return {
      tier: 1,
      programId: input.programId,
      name: hit.name,
      detail: hit.detail,
      rawCode: input.code,
    };
  }
  if (isAnchorErrorCode(input.code)) {
    return {
      tier: 2,
      programId: input.programId,
      name: `AnchorError_${input.code.toString(16)}`,
      detail: `Anchor program error 0x${input.code.toString(16)} (${input.code}) — check the program IDL for the matching error name.`,
      rawCode: input.code,
    };
  }
  return {
    tier: 3,
    programId: input.programId,
    name: `UnknownProgramError`,
    detail: `Unknown program error ${input.code}. See the program source for the error enum.`,
    rawCode: input.code,
  };
}

/**
 * Parse a simulateTransaction / getTransaction `err` value. Accepts the
 * common shape: `{ InstructionError: [index, { Custom: code } | string] }`
 * or a bare string (pre-instruction-error failures).
 */
export function decodeSimulationErr(
  err: unknown,
  instructionPrograms: string[],
): DecodedProgramError | null {
  if (!err) return null;
  if (typeof err === "string") {
    return {
      tier: 3,
      name: "TransactionError",
      detail: err,
      rawCode: 0,
    };
  }
  if (typeof err === "object" && err !== null) {
    const wrapped = err as Record<string, unknown>;
    const arr = wrapped.InstructionError;
    if (Array.isArray(arr) && arr.length === 2) {
      const index = arr[0] as number;
      const detail = arr[1];
      const programId =
        instructionPrograms[index] ?? instructionPrograms[0] ?? SYSTEM_PROGRAM;
      if (typeof detail === "object" && detail !== null) {
        const custom = (detail as { Custom?: number }).Custom;
        if (typeof custom === "number") {
          return decodeProgramError({ programId, code: custom });
        }
      }
      if (typeof detail === "string") {
        return {
          tier: 3,
          programId,
          name: detail,
          detail: `Instruction ${index}: ${detail}`,
          rawCode: 0,
        };
      }
    }
  }
  return {
    tier: 3,
    name: "UnknownError",
    detail: "Simulation failed with an opaque error.",
    rawCode: 0,
  };
}
