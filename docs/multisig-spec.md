# Multisig spec (placeholder)

**Spec reference:** `wallet-security-vulnerabilities-spec.md`
TWV-2026-039 (task 51). Companion: TWV-2026-044 (task 56, UserOp hash
binding), TWV-2026-046 (task 58, HW attestation).

**Status:** Placeholder. No multisig ships in Takumi today. This file
reserves the design surface so that when multisig work starts, the
invariants are already written down.

## 1. Independence

See `docs/multisig-independence-spec.md`. Every multisig introduced in
Takumi MUST satisfy that spec at enrollment time and re-assert
annually. The independence checklist is the first review gate on any
multisig PR.

## 2. Signer authentication

- Each signer uses its own hardware-attested key where possible (task
  58 / TWV-2026-046).
- UserOp-based multisig (ERC-4337 account): the account contract
  enforces the UserOp hash binding from task 56 /
  TWV-2026-044. Each signer's signature is over the same hash that
  includes `entryPoint` + `chainId` + the full struct.
- Traditional EOA multisig (Safe / Safe{Core}): the account contract
  pins its `threshold` and a curated owner set; owner rotation is
  time-locked, parallel to §4 of the social-recovery spec.

## 3. Threshold (M)

Chosen per §6 of the independence spec — against the correlated-
compromise model, not the independent model. The UI surfaces the
computed effective threshold after collapsing correlated signers, not
only the nominal M.

## 4. Recovery from signer loss

- Owner rotation is time-locked using the same cadence as social-
  recovery (48–72h, contract-enforced) — cross-link to
  `docs/social-recovery-spec.md` §1.
- Rotation requires a current-signer-signed tx on the account.
- Any rotation triggers notifications to ALL remaining signers through
  their enrolled channels.

## 5. UI surface

To be defined when multisig lands. Minimum requirements:

- Every pending multisig transaction is listed with:
  - Full `callData` decode (task 8 / TWV-2026-008 Permit/Permit2
    decoding) and simulation output (task 17 / TWV-2026-011).
  - Each signer's signature status + approval timestamp.
  - A per-signer "revoke approval" action (if the contract supports
    it).
- Copy must not imply trust in the aggregate name of the signer set —
  each signer is rendered individually; Takumi does not paper over
  individual-signer risk with collective branding.
- Reproducible signer UI (task 48 / TWV-2026-034) applies: the same
  UserOp must produce an identical-bytes UI preview across app
  versions so off-chain audit tooling can compare.

## 6. Pre-implementation checklist

Any PR that introduces multisig support MUST:

- [ ] Cross-link the independence spec and pass the §7 enrollment
      record.
- [ ] Integrate with the HW-pairing flow (task 58 / TWV-2026-046) for
      HW-rooted signers.
- [ ] Integrate with the UserOp hash audit checklist (task 56 /
      TWV-2026-044) when using smart-account multisig.
- [ ] Support reproducible signer UI (task 48 / TWV-2026-034).
- [ ] Document the owner-rotation time-lock (§4).
- [ ] Wire notifications to every remaining signer on rotation.

## 7. Review gate

Any PR that adds multisig — contract, signing flow, enrollment UI,
notification wiring — MUST cite TWV-2026-039 and reference this
placeholder + the independence spec. When this file grows beyond
placeholder, the review gate stays in place — updates to the spec
are code PRs, not runtime fetches.

## 8. Cross-links

- `docs/multisig-independence-spec.md` — the full independence
  checklist.
- `docs/social-recovery-spec.md` — time-lock semantics shared with
  owner rotation.
- `docs/smart-account-audit-checklist.md` — UserOp hash binding for
  smart-account multisig.
- `docs/hw-pairing-ux-spec.md` — HW-signer onboarding.
