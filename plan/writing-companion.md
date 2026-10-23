# NuanceBridge writing companion implementation

Goal: implement the user-approved document synthesis: intention-aware selective
revision, protected cultural expressions, writer control, feedback, reflection,
personal voice, and human feedback. Retain quick translation and its 28 languages.

Source: the five tabs of the Google Doc reviewed in this conversation. The
checkpoint is the primary product definition; interview notes are exploratory.

Architecture: retain dependency-free HTML/CSS/ES modules and personal OpenRouter
keys. Add a pure session engine, structured review API, and separate writing UI.
No owner-funded API or server is needed for the previously chosen personal-key
model. GitHub Pages and Vercel continue to serve the same static app.

Constraints: keys remain in tab memory. Drafts and feedback remain in session
memory unless explicitly exported. Protected expressions are enforced in code.
Every model edit is checked against the current revision and exact source span.
User-facing culture/reader judgments are possibilities, never group stereotypes.
Peer review is explicit file/text exchange, not a falsely advertised cloud room.

## Tasks

- [x] Tests first: protected spans (including repeated phrases and Unicode),
  minimal patch application, stale revision rejection, undo, session feedback;
  structured AI output, input/selection boundaries, empty suggestions, and errors.
- [x] Implement `writing-session.js`: source/current text, protected ranges,
  versioned suggestions, accept/edit/reject, history and undo.
- [x] Implement `review-api.js` and reuse the existing API request transport:
  analyze, explicit starting draft, meaning check, reader view and back-translation.
- [x] Implement `writing-ui.js`, `writing-demo.js`, `writing.css` and workspace:
  context, revision scope, mixed-language text, protection, suggestion cards,
  explanations in selected language, feedback, reflection, style examples,
  original/current comparison, downloadable draft and peer-review exchange.
- [x] Integrate settings/key lifecycle, privacy notices, 28-language options,
  and keep the original translator as a secondary tool.
- [x] Update documentation, deployment allowlist and previews. Run unit and
  browser checks, independent code review, resolve findings.
- [x] Commit and deploy; verify the deployed writing workflow.

## Review focus

- Repeated or emoji-containing source spans must patch the intended occurrence.
- Protected text must survive AI suggestions, manual edits and starting drafts.
- Manual edits, context changes, mode changes and undo must invalidate old AI work.
- Empty valid suggestions should communicate that no changes are recommended.
- Neither peer export nor saved preferences may leak session API credentials.

The next UI is an English product with selectable explanation language, including
Chinese. Conversation updates remain in Chinese as requested. No paid live calls
will be made without a user key; controlled responses verify integration.

## Verification and decisions

- All 30 unit tests pass. New behavior was tested before implementation.
- Full Chromium workflow passes, including demo/live mode, sequential acceptance,
  protected expressions, undo, bilingual explanations, session feedback, starting
  preview, peer feedback, saved voice, key reload lifecycle, translator regression,
  and no overflow at 320px/390px/desktop widths.
- Browser regression caught repeated unchanged selection events cancelling selected
  reviews; selection changes are now deduplicated.
- Independent code review found overlapping protected destinations after a starting
  draft (`Ann Anna` -> `Anna Ann`). Regression observed failing, then passed after
  ambiguous overlapping mappings were rejected. Full suite passes.
- Review also noted unsupported demo explanation languages silently falling back.
  Regression observed failing, then passed with explicit supported-language errors.
- Personal BYOK/static deployment is retained. Shared owner-funded inference,
  accounts and synchronous cloud collaboration are not required for this model.
  Human collaboration is implemented as explicit review-file exchange and pasted
  feedback, honestly labeled in the UI. No automatic cloud storage is introduced.
- Published implementation commit: `c9ebdb3`. Vercel reports success; the full
  headless browser workflow passes against `https://nuancebridge.vercel.app/`.
  GitHub Pages verification and deployment jobs also passed. No paid model call
  was made; live API integration uses controlled test responses.
