# NuanceBridge: personal translator and portfolio demo

## Purpose

Turn the existing HTML prototype into a working translation companion that can
be published on GitHub Pages and shown as a portfolio project. The user selected
personal use with their own API key and also requested portfolio use.

## Proposed experience

- Open in **Demo mode**, with no key required and no AI requests. Offer the
  prototype's Urdu, Spanish, and French scenarios, with curated translations,
  alternative registers, and explanations. Label every sample as a curated demo.
- Offer **Live mode** for arbitrary text. Let the user choose source language,
  target language, tone, recipient, and communication channel. Return the main
  translation, casual/direct/formal alternatives, and a short nuance explanation.
- Keep a style-profile editor. Save only explicitly entered preferences and
  non-secret settings locally. Do not claim automatic learning or IBM integration.
- Provide copy buttons, empty/loading/error states, keyboard access, and a
  responsive layout. Display generated text as text, never executable HTML.
- In demo mode, changing context or entering arbitrary text must not masquerade
  as a fresh translation. Explain that live mode is required for new results.

## Technical choices proposed by Codex

- Use plain HTML, CSS, and JavaScript modules, with no build step or runtime CDN
  scripts. Preserve the original prototype as a reference file.
- Use OpenRouter for the personal live connection, with a user-editable model ID.
  This keeps model selection flexible while using one fixed HTTPS API endpoint.
  The provider choice is a proposed default, not a user requirement.
- Hold the user's key in memory only; clear it on reload or explicit disconnect.
  Never place it in source, localStorage, sessionStorage, URLs, or logs.
- Explain in settings that live requests send source text and enabled style
  preferences to OpenRouter and its selected model provider, may incur charges,
  and browser extensions can access browser-entered credentials. Recommend a
  separate key with a low spending limit.
- Validate response structure and handle invalid keys, quota/rate limits,
  malformed output, network failures, cancellation, and timeouts.
- Preserve the concept's blue/teal accents in a cleaner, mobile-friendly layout.
  Use independent NuanceBridge branding and describe the SkillsBuild prototype
  origin without implying affiliation or a real IBM Bob connection.

## Files and verification

- `index.html`, `styles.css`: accessible interface and responsive styling.
- `app.js`: UI, demo/live modes, preferences, and session key lifecycle.
- `translation.js`: prompt construction, API requests, validation, error mapping.
- `demo.js`: explicitly curated scenarios, separate from live generation.
- `tests/`: Node built-in tests for request/response boundaries and persistence.
- `.github/workflows/pages.yml`: GitHub Pages deployment workflow.
- `README.md`: local preview, tests, provider setup, privacy, and deployment.
- Retain the existing prototype unchanged as the reference/backup.

Test API success and failure paths with controlled HTTP responses without paid
calls. Check demo behavior, preference persistence, mobile layout, keyboard
controls, and safe rendering in a browser where available. Actual model quality
requires a later live check with the user's own key; do not claim it was tested.

## Scope boundaries

No server, accounts, shared API key, conversation history, automatic profile
learning, or public free AI service. GitHub deployment files will be prepared
locally; publishing requires a chosen GitHub repository and account access.

## Implementation sequence

- [x] Confirm this design and provider choice. User instructed implementation
  and push to `Lee-arts-02/informal-translation-companion`.
- [x] Write failing tests for request construction, validation, errors, and
  persistence boundaries; run them to establish the baseline.
- [x] Implement the translation module and curated demo data; pass the tests.
- [x] Build the interface, settings, style profile, and demo/live transitions.
- [x] Add Pages workflow and setup documentation.
- [x] Run tests, browser checks, and independent code review; resolve findings.

Verification: all 11 unit tests passed after first observing the missing-behavior
failures. JavaScript syntax checks passed. Headless Chromium checks passed for
demo mode, controlled live response, API errors, local preferences, safe HTML-like
text rendering, key clearing on reload, and mobile overflow at 390px and 320px.
Independent code review reported no actionable findings. Paid API quality was
not tested. The Python launch helper failed inside the Windows sandbox; an
equivalent Node/Chromium harness completed outside the sandbox. Desktop and
mobile previews are retained under `preview/`.

## Source references

- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- OpenRouter authentication: https://openrouter.ai/docs/api/reference/authentication

Status: implementation authorized; execute locally and publish to the supplied repository.
