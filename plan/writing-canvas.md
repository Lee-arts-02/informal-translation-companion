# Writing Canvas

The writer wants a less constrained document UI, English by default with a language choice, and visible changes while previewing AND after applying an edit. Selection is an intent anchor, not an absolute edit boundary. Review the enclosing sentence; explicitly distinguish supporting edits outside the selection. Never silently apply a suggestion.

Implement a real standalone canvas page, linked from the existing app. Keep current translation, language checks, and habit tools accessible. Use the existing OpenRouter request client for live editing; an explicit example mode needs no key. Preserve drafts in memory only. Save interface language and explicitly confirmed habits locally. Never store API keys.

The document is central, with a nearby intent popover, a small inline revision note, sentence-level tracked changes, Accept / Dismiss and Undo. Applied changes remain visible until the writer hides them. Allow free writing, manual suggestion editing, selection or pen annotation, and copying clean text. Small screens use the same flow.

Validation: meaningful unit tests for sentence scope, change classification, stale proposals, and outside-sentence preservation; browser checks for selection, visible diff before/after acceptance, edit cancellation, language switch, local habits, and mobile overflow. Review code before shipping.
