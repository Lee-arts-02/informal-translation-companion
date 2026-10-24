# Guided writing flow audit

User request: audit the whole app using the metacognitive-scaffolding paper, particularly intent → cross-language check → explicit scoped memory, and place passage controls above selected content rather than below the editor.

Design: preserve the free-form draft and optional workflow. Add a persistent goal summary and navigable orientation strip; make pending/confirmed intent and temporary/durable scope explicit; display actual request inputs separately from model interpretations. Guide checking through inspect → flag/explain or mark reviewed → repair preview → recheck. Show current English beside check text. Put candidate memory editing first with plain-language scope preview, explicit unsaved/saved states and a return-to-draft action. Move the selection workbench before the textarea and make active controls compact/sticky, preserving editor selection, keyboard and mobile access.

Research grounding: https://arxiv.org/html/2602.05111 . Goal scaffolding, input visibility, workflow guidance and stopping/reflection cues are proposed in a health-information study. Their use here is a writing-interface design hypothesis, not evidence of improved user outcomes.

Validation checklist:
- [x] Pending AI interpretations never enter writing requests until confirmed; explicit input remains usable without cards.
- [x] Current goal, active confirmed instructions, provided habits and changed-since-request status are visible and truthful.
- [x] Check completion and repair are tied to the current revision/context; edits invalidate reviewed status.
- [x] Candidate saving is separate from confirmation, scopes are previewed, successful save returns to a clear next action.
- [x] Selected-text controls precede the editor, become compact/sticky on selection, preserve selection and show outcomes.
- [x] Existing Unicode protection, preview, undo, translator and memory import/export behavior pass regression tests.
- [x] Inspect desktop/mobile screenshots and obtain independent review.
- [ ] Push and verify deployment.

Evidence: new state tests were observed failing before implementation. All 42 unit tests and JS syntax checks pass. Expanded installed-Chrome suite passes, including unconfirmed/confirmed request payloads, leaving candidate review without saving, scope presets, explicit saved/visit-only outcomes, reviewed-state invalidation and actual toolbar geometry at 1440/390/320px. Desktop, phone, check panel and candidate-habit screenshots inspected. Independent review approved after checking sticky container behavior and visit-only/dismissal states. API calls in browser tests are controlled fixtures, not model-quality evaluations. User PDF untouched.
