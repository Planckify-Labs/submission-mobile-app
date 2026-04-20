# Task 17 — `useMerchantChannels(country)` hook

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §6.0 (`ChannelDescriptor`),
§6.1 (`GET /v1/merchants/channels`), §1.1.1 step 3

## Why this matters

The channel picker in the signup form (task 08) must display options in
server-ranked order. Memory `feedback_filter_at_source.md` is explicit:
don't re-sort client-side; if the server already hands back the ranked list,
thread it through.

## Scope

- Create `hooks/queries/useMerchantChannels.ts`:
  ```ts
  export const useMerchantChannels = (country: "ID") => useQuery<ChannelDescriptor[]>({
    queryKey: ["merchantChannels", country],
    queryFn:  () => api.get(`/v1/merchants/channels?country=${country}`),
    staleTime: 1000 * 60 * 60,  // channel list changes rarely
  });
  ```
- Zod-validate the response against a `ChannelDescriptor[]` schema.
- Expose a helper `getChannelByCode(list, code)` for the signup form's
  polymorphic-field logic (returns the matching `ChannelDescriptor` or
  throws a typed error).
- Do not hardcode the channel list anywhere in the app. Grep of
  `"GOPAY" | "OVO"` (etc) should return only the type union in
  `api/types/payouts.ts`.
- Unit tests: happy path, unknown-country returns a validated empty list
  shape (server should 400 but the client handles empty gracefully),
  zod rejection for malformed entries.

## Rules (non-negotiable)

- **Filter at source** (memory `feedback_filter_at_source.md`). No
  `.sort()` in the consumer.
- **Type-union only**; literal channel codes live in `api/types/payouts.ts`.
- **No `useEffect` chains** to pick a default channel — use `useMemo` off
  the server list (skill `avoid-useeffect`).
- **DTO pattern** for the helper: take the whole list + code, return the
  full descriptor.

## Acceptance

- [ ] Hook exists, tests pass, zod schema coverage.
- [ ] Grep `"GOPAY" | "OVO"` returns only the types file.
- [ ] Grep in `app/merchant/signup-form.tsx` for `.sort(` on channels
      returns zero matches.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- The signup form UI (task 08).
- Multi-country expansion (§12 Q3 defers; hook already accepts a country
  param, so extension is additive).
