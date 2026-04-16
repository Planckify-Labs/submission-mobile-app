# Task 41 — ENS in send flow, approval sheets, address bar, history

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.5 (integration points)

## Why this matters

ENS resolution exists (task 40) but isn't wired into the UX. This task
integrates it everywhere users see addresses: send flow, approval sheets,
transaction history, and the dApp browser address bar.

## Scope

Wire ENS resolution into:

- **Send flow** (`components/send/RecipientInput.tsx`):
  - Recipient field accepts ENS names. As user types, debounced resolution
    shows resolved address below with avatar.
  - Confirm screen shows both name and address: "Sending to vitalik.eth (0x1234…abcd)".
  - Error state for names that don't resolve.
- **Approval sheets** (bridge spec renderers):
  - Spender addresses show ENS names when available.
  - "Approving Uniswap V3 Router (uniswap.eth)" instead of raw hex.
  - Use `useENSName` for reverse resolution in the renderer.
- **Transaction history** (`components/history/TransactionRow.tsx`):
  - Counterparty addresses show ENS names. Reverse-resolve known addresses.
  - Batch reverse resolution for visible rows (max 20 per batch).
- **dApp browser address bar**:
  - Type `vitalik.eth` → resolve contenthash → navigate to IPFS/ENS site.
  - Recently resolved ENS names appear in address bar autocomplete/suggestions.
- **Address bar suggestions**: store recently resolved names in `expo-sqlite`,
  surface in autocomplete sorted by recency.

## Rules (non-negotiable)

- **Debounce ENS lookups** in send flow — 500ms after last keystroke.
- **Never auto-send to a resolved address** — user must confirm both name
  and address on the review screen.
- **Batch reverse resolution** — don't fire 20 individual requests for 20
  history rows. Use a single batch or queue.
- **ENS in approval sheets is informational** — it does not change the approval
  logic or security model.

## Acceptance

- [ ] Send flow resolves ENS names with avatar display.
- [ ] Confirm screen shows both name and resolved address.
- [ ] Approval sheets show ENS name for known spender addresses.
- [ ] History rows show ENS names for counterparties.
- [ ] Address bar resolves ENS names and navigates to contenthash.
- [ ] Address bar suggestions include recently resolved names.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- ENS registration or management.
- ENS text record editing.

## Depends on

- Task 40 (ENS resolution service).
- Task 34 (transaction history UI — for history integration).

## Unblocks

- Phase B exit criteria (ENS resolves everywhere).
