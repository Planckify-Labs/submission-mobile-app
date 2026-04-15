# Generative UI — Task Backlog

This folder contains engineering tasks derived from `../generative-ui-spec.md`.
Each file represents one discrete unit of work from the spec's "Required
changes" table (§7) and "Migration order" (§10).

## Filename convention

```
{NN}_{task_name}_istaken_{true|false}[_isfinish_true].md
```

- `NN` — two-digit sequential task number
- `task_name` — short snake_case label
- `istaken_true` / `istaken_false` — whether an engineer is actively working on it
- `_isfinish_true` — appended as a **postfix** once the task is complete.
  A file without this postfix is not yet finished.

Three possible states:

| State | Filename pattern |
|---|---|
| Not started | `01_agent_message_types_istaken_false.md` |
| In progress | `01_agent_message_types_istaken_true.md` |
| Finished    | `01_agent_message_types_istaken_true_isfinish_true.md` |

## Workflow

1. Browse the tasks, pick one that ends with `istaken_false.md`.
2. Claim it by renaming `istaken_false` → `istaken_true`:
   ```
   git mv 01_agent_message_types_istaken_false.md 01_agent_message_types_istaken_true.md
   ```
3. Work on the task. Read the referenced sections of `../generative-ui-spec.md` —
   each task file excerpts only the minimum context needed.
4. When the task is complete and merged, append the `_isfinish_true`
   postfix — do NOT flip `istaken` back to `false`:
   ```
   git mv 01_agent_message_types_istaken_true.md 01_agent_message_types_istaken_true_isfinish_true.md
   ```
   Finished files stay in the folder as a durable record of what shipped.
5. If you abandon a task mid-flight, rename it back to `istaken_false.md`
   (without the `isfinish_true` postfix) so someone else can pick it up.

## Task map

### Mobile (scaffolding — no user-visible change)

| # | File | Title |
|---|---|---|
| 01 | `01_agent_message_types_istaken_false.md` | `AgentMessage` / `AgentMessagePart` types (M1) |
| 02 | `02_message_translator_istaken_false.md` | Server ↔ client message translator (M2) |
| 03 | `03_structured_ui_registry_istaken_false.md` | `StructuredUI/` tool→component registry (M3) |
| 04 | `04_parts_based_renderer_istaken_false.md` | Rewrite `MessageContent` as a parts iterator (M4) |

### Mobile (migrate existing live cards onto registry)

| # | File | Title |
|---|---|---|
| 05 | `05_migrate_pending_tx_card_istaken_false.md` | Migrate `PendingTxCard` with live/historical branches (M5) |
| 06 | `06_migrate_preview_card_istaken_false.md` | Migrate `PreviewCard` with live/historical branches (M6) |

### Mobile (flip point — replay becomes real)

| # | File | Title |
|---|---|---|
| 07 | `07_live_vs_historical_mode_istaken_false.md` | `streamingMessageId` + `resolveMode` (M10) |
| 08 | `08_parts_aware_history_loading_istaken_false.md` | `fromStoredMessage` parts-aware + remove extractors (M8 + M9) |

### Mobile (new first-class patterns)

| # | File | Title |
|---|---|---|
| 09 | `09_inline_spending_approval_card_istaken_false.md` | Inline-ify approval: `SpendingApprovalModal` → `SpendingApprovalCard` (M7) |
| 10 | `10_swap_quote_card_istaken_false.md` | End-to-end new tool: `SwapQuoteCard` (M11) |

### Server (optional, non-blocking)

| # | File | Title |
|---|---|---|
| 11 | `11_persist_partial_turns_istaken_false.md` | Persist partial turns on SSE disconnect (S1) |
| 12 | `12_interrupted_at_hint_istaken_false.md` | Server-side `interrupted_at` hint on reconnect (S2) |

## Source of truth

`../generative-ui-spec.md` is the canonical spec. These task files are a
projection of it — if anything here disagrees with the spec, the spec wins.
Update the spec first, then update the task.
