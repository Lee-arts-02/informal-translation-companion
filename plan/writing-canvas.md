# Writing Canvas

The writer wants a less constrained document UI, English by default with a language choice, and visible changes while previewing AND after applying an edit. Selection is an intent anchor, not an absolute edit boundary. Review the enclosing sentence; explicitly distinguish supporting edits outside the selection. Never silently apply a suggestion.

Implement a real standalone canvas page, linked from the existing app. Keep current translation, language checks, and habit tools accessible. Use the existing OpenRouter request client for live editing; an explicit example mode needs no key. Preserve drafts in memory only. Save interface language and explicitly confirmed habits locally. Never store API keys.

The document is central, with a nearby intent popover, a small inline revision note, sentence-level tracked changes, Accept / Dismiss and Undo. Applied changes remain visible until the writer hides them. Allow free writing, manual suggestion editing, selection or pen annotation, and copying clean text. Small screens use the same flow.

Validation: meaningful unit tests for sentence scope, change classification, stale proposals, and outside-sentence preservation; browser checks for selection, visible diff before/after acceptance, edit cancellation, language switch, local habits, and mobile overflow. Review code before shipping.

## Cumulative annotations update

Branch: `codex/multi-note-canvas`. A document now retains multiple marked passages, each with a list of requirements. Selecting the same passage again appends rather than overwrites. Notes are numbered and independently selectable/removable; individual requirements can be removed. The original compact active-note form remains the editing surface.

The annotated document supports additional native selections and pen strokes. A sentence preview includes all requirements from intersecting anchored notes. Adopting or undoing a sentence preserves all notes and their requirements; offsets are rebased. Manual draft edits preserve notes, while removed anchors become explicit detached notes, retaining their requirements and supporting reattachment. No annotation content is persisted automatically.

Bare marks are retained immediately, so the writer can underline several passages first and enter requirements afterwards. Closing a popover keeps its underline. A deleted note cannot leave a stale reconnect target that absorbs a future selection.

Browser checks cover three retained passages, two requirements for one passage, merged same-sentence API inputs excluding unrelated sentences, retained notes after adoption/undo/manual typing, mobile widths, and key checking without draft submission. API options and verified official sources are recorded in `plan/web-ai-integration.md`.
