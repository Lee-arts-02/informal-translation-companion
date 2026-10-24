# Make passage actions understandable

Approved scope: respond to the user's screenshot and paper reference by making the existing three passage operations discoverable and their consequences explicit. Keep the existing protected edit engine and preview/undo workflow.

Research reference: Ramesh et al., Metacognitive Demands and Strategies While Using Off-The-Shelf AI Conversational Agents for Health Information Seeking, CHI 2026, https://arxiv.org/html/2602.05111 . The health-domain study proposes goal scaffolds, action guidance and input transparency; applying these to writing is a design inference, not an effectiveness finding.

Implementation:
- Show an explicit selected-text preview and empty-state instructions beside the draft.
- Replace generic adjacent buttons with distinct action cards and visible outcome descriptions.
- Disable unavailable actions, explain protected selection restrictions, retain selected range when focus moves to controls.
- Show local success feedback and keep the undo path visible. Focus the draft after protection to make continuing easy.
- Validate desktop, phone, keyboard selection, protection, scoped suggestions, instruction move and undo; request code review, then push the verified app update.

Verification: 39 unit tests and syntax checks passed. The complete browser suite passed with added empty-selection, exact quote, protected-overlap, instruction outcome, keyboard-range and selected-only request assertions; desktop/mobile screenshots inspected. Fixed a native selection-event timing issue that initially cleared protection feedback. Independent code review approved; its focus-restoration suggestion was incorporated. Existing unrelated PDF remains untouched.
