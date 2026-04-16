# Operational signing posture

**Spec reference:** `wallet-security-vulnerabilities-spec.md`
TWV-2026-036 (task 49). Companion: TWV-2026-034 (task 48, reproducible
signer UI), TWV-2026-037 (task 50, hot-wallet key partition).

**Status:** Operational runbook. Applies to every engineer whose
workstation can touch production signing surfaces or treasury-adjacent
features. Update when infrastructure changes; review annually.

DMM Bitcoin lost ~$305M in May 2024: a Ginco developer received a
malicious "pre-employment test" PDF via LinkedIn, their authenticated
session was compromised, and the attacker rode the session to replace
a legitimate withdrawal with a drain. Radiant Capital's $50M Oct 2024
loss used the same class of entry (malicious Telegram dropper). Any
ops architecture where the developer workstation is part of the trust
boundary — without an out-of-band attestation — inherits those losses.

## 1. Rules (non-negotiable)

- Dev machines do NOT hold production signing keys. Full stop. Keys
  live in KMS / HSM; the dev machine holds at most a short-lived
  session that can request signatures, not keys.
- Any tx above the documented OOB threshold (§4) requires a secondary
  independent channel confirmation. No single-device signing for that
  class.
- Session timeouts are enforced by the signing service, not by
  developer discipline.
- Social-engineering drills are recurring (at minimum annually), not
  one-off.

## 2. Dev-machine hardening matrix

Baseline that every production-signing-capable workstation must meet.
The platform team owns the MDM profile; the security team owns the
baseline review.

| Control                      | Requirement                        |
|------------------------------|------------------------------------|
| MDM enrollment               | Enrolled; profile current          |
| Gatekeeper                   | On; no global exceptions            |
| XProtect                     | Current; auto-update on             |
| Unsigned-binary execution    | Blocked (spctl gatekeeper)         |
| Full-disk encryption         | On (FileVault / BitLocker)          |
| Screen lock                  | ≤ 5 min idle, password+biometric    |
| Firmware password            | Set (where supported)               |
| Third-party IDE plugins      | Review-required list maintained     |
| Package managers             | Allowlist per §3                    |
| Browser extensions           | Review-required for ops accounts    |
| OS update cadence            | ≤ 14 days behind latest             |
| Crowdstrike / EDR agent      | Running; health pass                |

A monthly script run by the platform team reports any workstation
that falls off the baseline. Failing workstations are suspended from
production signing until remediated.

## 3. Package-manager allowlist

Approved registries:

- **npm:** public npmjs.com + the company's private mirror.
- **pnpm / yarn:** same underlying registry.
- **Homebrew:** upstream + curated internal tap.
- **Python (for tooling):** PyPI via a private proxy.
- **GitHub:** direct git+ssh to `github.com/cstralpt/*` and
  explicitly listed upstreams.

Adding a new registry requires a security-team PR. Installing a
random package from a new source during ops work is a posture
failure.

## 4. Session-lifetime rule + OOB attestation

- Production-signing sessions (the in-flight workstation state that
  can request a signature) expire in **minutes**, not hours.
- Re-auth uses biometrics (TouchID / Face ID on macOS; Windows Hello
  / YubiKey on Windows). Password-only re-auth is not sufficient.
- For each tx class, the session expires and requires a new biometric
  tap.

### OOB attestation threshold

- Any tx above the documented USD threshold — initial default
  $50,000 equivalent at tx submission time — requires a secondary
  channel confirmation **independent of the originating workstation**.
- Accepted secondary channels (one of):
  - Phone call to a second operator reading back the tx hash.
  - Secondary device displaying the tx hash via a separate app (not
    the same laptop, not a bookmarked URL in the same browser).
  - HSM screen displaying the signed hash (reproducible hash match
    per task 48 / TWV-2026-034).
- Threshold is reviewed quarterly. Adjust downward if tx volume /
  risk profile increases.

### Trust-role separation

- No single device holds both "enters password / clipboard / general
  browsing" AND "live signing key" simultaneously.
- Concretely: the ops workstation that initiates the signing session
  is NOT the device that holds the HSM PIN. PINs live on a separate
  dedicated device — a locked-down phone, a YubiKey, a dedicated
  laptop used only for ops.

## 5. Social-engineering drill

- At least **annual** table-top exercise where the team practices:
  - DMM scenario: recruiter PDF + malicious take-home test.
  - Radiant scenario: compromised Telegram dropper.
  - WazirX scenario: compromised custody UI displaying benign summary
    while payload upgrades the multisig (cross-link task 48).
  - LinkedIn "recruiter" IM with a link or PDF that tries to phish
    the on-call signer.
- Facilitator named at each drill; attendance tracked.
- After-action notes filed in the private ops folder; public-safe
  findings summarised in the next release of this runbook.

## 6. PR-template prompt

The repository's PR template includes the prompt:

> **Touches operational signing?** — If yes, cite TWV-2026-036 in
> the description, confirm the workstation-posture check is current,
> and list the OOB-attestation path for any above-threshold tx this
> PR would enable.

Reviewers block PRs that should have answered this but did not.

## 7. Cross-reference to end-user education

For the end-user side (non-operator users of the mobile wallet), the
BIP-39 multi-chain blast-radius education lives in the Phase-1
wallet-setup screens and is the counterpart to this document. Users
accept that one seed = many chains' exposure; operators work under
the stricter partition rules of task 50 (TWV-2026-037) +
§4 here.

## 8. Threshold + channel choice — tracked outputs

The following are filled in when this document is first published;
updating them is a PR against this file:

- **OOB threshold (USD):** $50,000 equivalent.
- **OOB channel owner:** security team on-call (rotating).
- **MDM baseline platform owner:** platform team on-call.
- **Annual drill facilitator:** security team lead.

## 9. Cross-links

- Task 48 / TWV-2026-034 — reproducible signer UI (the hash-match
  primitive OOB attestation depends on).
- Task 50 / TWV-2026-037 — hot-wallet custody policy (partition
  rules the ops team enforces).
- Task 9 / TWV-2026-055 — EAS Update code signing (the signing
  ceremony here uses the same two-person-review pattern).
- Task 18 / TWV-2026-018 — CI lockfile supply-chain (package-manager
  allowlist is the operational counterpart).
