# Minimal writing-first workspace

User request: reduce information density; emphasize the draft and one current next step. Intentions, cross-language checks and habits should expand only when needed, consistently on desktop and phones.

Design: compact heading, one writing-language control, full-width draft and a single contextual next-action strip. A quiet tool row opens intention settings, meaning checks or habits; the remaining settings, context, provenance, profile switches and secondary editing actions live in a collapsed More tools disclosure. No empty suggestions pane or four-step roadmap by default. Suggestions/checks open an explicit companion surface only after a user action or returned guidance; closing it restores the writing view. Keep the selection-anchored popover, safety invariants, explicit scoped saving, source-blind checks and all secondary utilities. Examples and project background are also collapsed.

Verify initial density and reachability at 1440/390/320, tool open/close/focus, actual contextual primary action, all existing provider/state and full writing/memory regressions, screenshots and independent review, then publish.

Implemented: independently disclosed intentions, companion hidden until requested, compact mobile editor, one state-dependent primary action (including copying a reviewed draft), collapsed secondary tools/examples/about, and busy-state protection on the primary request trigger. Input transparency and scoped explicit habit saving remain available.

Verification: 46 unit tests and syntax checks pass. Complete desktop/mobile browser regression passes, including primary suggestions, independent intentions, repair/save/return, first-screen next action at 320px, selection positioning, privacy and request payloads. Independent code review confirmed all findings resolved and layouts fit 1440/390/320×700 without horizontal overflow. This is browser emulation, not a physical-device keyboard test or participant study.
