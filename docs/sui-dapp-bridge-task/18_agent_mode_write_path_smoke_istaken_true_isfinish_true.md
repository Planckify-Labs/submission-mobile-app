# Task 18 — Agent-mode write path smoke

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-dapp-bridge-spec.md` §11.5.5.

## Why this matters

Once production agent tools land (owned by the wallet-kit spec §7.2),
they will submit Sui intents via `DappBridge.submitAgentIntent`. The
seam needs to be smoke-tested *before* those tools land — proving the
renderer dispatches on `via === "agent"` (not `namespace === "sui"`),
the auto inspectors run, and `executeApproval` signs through the same
dwell-site path the dApp branch uses.

## Scope

- Stub a Sui write tool in a test file (NOT in
  `services/agent-executors/` — that path is owned by wallet-kit
  §7.2). The stub:
  1. Builds a `Transaction` via `@mysten/sui/transactions`
     (e.g. `transferObjects([gas], "0x...")`).
  2. `await tx.build({ client })` → base64 BCS.
  3. Constructs an `ApprovalIntent`:
     ```ts
     {
       id, namespace: "sui", kind: "signTransaction",
       origin: { url: "agent://takumi", title: "Takumi AI", via: "agent" },
       wallet: <active sui wallet>,
       payload: { mode: "sign-and-execute", address, network: "testnet", transaction: <base64> },
       annotations: [],
       createdAt: Date.now()
     }
     ```
  4. Calls `bridge.submitAgentIntent(intent)`.
- Integration test asserts:
  - The renderer registry resolves the intent to `AgentCardRenderer`
    (`renderers.ts:21-24`), NOT `SuiTransactionSheet`.
  - The auto pipeline runs `SuiPtbDecoderInspector` and
    `SuiSimulationInspector` — `decoded` and `simulation` end up on
    the intent payload.
  - On approve, `executeApproval` reaches the `installSuiSigner` signer
    and round-trips through `getSuiSignerForWallet`.
  - On reject, returns `4001`.

## Rules (non-negotiable)

- **No production agent tool merged.** That's the wallet-kit spec's job.
  This task is integration-only.
- **`via: "agent"` wins over `namespace`.** The `via` row at
  `renderers.ts:21-24` precedes the per-namespace rows. Tests must lock
  this ordering invariant.
- **No code branch in `SuiAdapter.ts` for "agent" vs "dApp" origin.**
  Same `executeApproval` path — the only difference is the renderer.
- **Signer dwell unchanged.** Agent-mode signing must hit
  `getSuiSignerForWallet` — same dwell as the dApp path. No alternate
  signer path for agent intents.

## Acceptance

- [ ] Renderer-resolution test green.
- [ ] Auto-inspector pipeline runs and patches the intent.
- [ ] Approve path signs and submits successfully against a mocked RPC.
- [ ] Reject path returns `4001`.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Production `send_sui` / `send_sui_coin` tools — wallet-kit spec §7.2.
- Agent UI changes.
