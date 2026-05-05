# Task 22 — TWV-2026-YYY (SUI-DAPP) security design note

**Status:** Not taken
**Owner:** Mobile (mobile-app) + Security
**Spec reference:** `sui-dapp-bridge-spec.md` §11 (Security invariants — new gate).

## Why this matters

Every new chain-signing surface gets a security design note. Solana's
TWV-2026-070 set the precedent (see `docs/wallet-security-task/`). The
TWV-2026-YYY (SUI-DAPP) note documents the three invariants the bridge
upholds for Sui — review-once, audit-forever. This is a ship-blocker
for Task 20.

## Scope

- Issue a new TWV number (TWV-2026-YYY → confirm with security; the
  spec uses YYY as placeholder).
- Create `docs/wallet-security-task/NN_sui_dapp_bridge_design_note_istaken_false.md`
  (NN = next sequential number in `wallet-security-task/`). Mirror the
  TWV-2026-070 Solana design note layout.
- Document per spec §11:
  1. **Bridge sign path goes through `SuiSignerFns` only.** The signer
     reaches the keypair through `getSuiSignerForWallet` — the single
     dwell site introduced by the wallet-kit spec (TWV-2026-XXX).
  2. **The injected script never sees private keys.** It only emits
     signed base64 blobs back to the dApp. Native side does the signing.
  3. **Cross-namespace trust is forbidden in `executeApproval`.** A
     connect intent that arrives from an origin with an existing EVM
     grant does NOT auto-grant Sui access (parallel to `SolanaAdapter:303-305`).
- Document carryover gates (no code change; documentation only):
  - **TWV-2026-013** — origin pinning. Sui inherits via `DappBridge.dispatch`.
  - **TWV-2026-015** — session nonce. Sui shim reads
    `window.__takumi_sui_nonce` per-request.
  - **TWV-2026-064** — fullscreen disabled. Sui inherits.
- Document the **`eth_sign` non-equivalent**: Sui has no analogue.
  `personal_sign` is `sui:signPersonalMessage` which always carries the
  `[0x03,0,0]` PersonalMessage intent prefix. No `HARD_REJECT_METHODS`
  entry needed (§11 final paragraph).
- Cross-link this note from the spec's §11 (replace TWV-2026-YYY
  placeholder with the issued number).

## Rules (non-negotiable)

- **Issue the TWV number with security before merging.** Don't ship
  with `TWV-2026-YYY` placeholder text in tree.
- **Mirror the Solana TWV-2026-070 layout** — same headings, same
  invariant / threat / mitigation / verification structure. Auditors
  read across notes.
- **Document failures, not just successes.** Each invariant lists the
  failure mode it prevents and how a regression would be detected.
- **No code changes in this task.** Pure documentation.

## Acceptance

- [ ] Real TWV number assigned and replacing the placeholder in spec
      §11 + this design note.
- [ ] All three primary invariants documented with threat / mitigation /
      verification sections.
- [ ] Three carryover gates listed.
- [ ] `eth_sign` non-equivalence rationale documented.
- [ ] Note merged before Task 20 (ship-blocker).

## Out of scope

- Code changes (the invariants are already enforced by Tasks 04, 06, 07).
- Penetration test of the bridge (separate engagement).
