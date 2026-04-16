# Task 42 — Address book CRUD + send-flow autocomplete + auto-suggest

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.6

## Why this matters

Users frequently send to the same addresses. Without saved contacts, they
re-paste addresses every time — error-prone and tedious.

## Scope

Create:

- `services/contacts/types.ts` — `Contact` type: id, label, addresses (array
  of {namespace, address, chainIds?, ensName?}), notes, createdAt, lastUsedAt.
- `services/contacts/store.ts` — `expo-sqlite` CRUD:
  - `addContact(contact)`, `updateContact(id, patch)`, `deleteContact(id)`.
  - `getContacts(opts?: { search?: string, namespace?: Namespace })` — list
    with search and namespace filter.
  - `touchContact(id)` — update `lastUsedAt` (called on send).
  - `getFrequentRecipients(address, minCount)` — returns addresses sent to
    ≥ N times without a saved contact.
- `app/settings/contacts.tsx` — contacts list screen:
  - Alphabetical list with search bar.
  - Add / edit / delete contacts.
  - Each contact shows label, addresses (with ENS name if stored), last used date.
- Send flow integration (`components/send/RecipientInput.tsx`):
  - Contacts appear in autocomplete, sorted by `lastUsedAt`.
  - Namespace-aware: shows the right address based on active chain.
  - Combined with ENS suggestions (task 41) in a unified dropdown.
- Auto-suggest: after sending to an address 3+ times (tracked via
  `getFrequentRecipients`), prompt "Save as contact?" via a bottom sheet.
  Never auto-save without user confirmation.

## Rules (non-negotiable)

- **Namespace-aware contacts**: a contact can have both EVM and Solana addresses.
  The send flow shows the right one based on the active chain's namespace.
- **Never auto-save** — always prompt. Users may send to exchanges or contracts
  they don't want in their contact list.
- **Search** matches on label, address prefix, and ENS name.
- **Delete confirmation** required.

## Acceptance

- [ ] CRUD operations work: add, edit, delete contacts.
- [ ] Contacts appear in send-flow autocomplete sorted by `lastUsedAt`.
- [ ] Namespace filtering shows correct address for active chain.
- [ ] Auto-suggest triggers after 3 sends to the same address.
- [ ] Search works across label, address, and ENS name.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Contact import/export.
- Contact sharing between devices.

## Depends on

- Task 40 (ENS — for storing ENS names on contacts).

## Unblocks

- Phase B exit criteria (contacts work in send flow).
- Task 44 (address poisoning uses contact list for comparison).
