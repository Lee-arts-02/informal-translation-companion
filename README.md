# NuanceBridge

**Your words. Your choices.** A multilingual writing companion for students who
want clearer writing while keeping their intended meaning, personal voice, and
cultural expression.

[Open on Vercel](https://nuancebridge.vercel.app/)
· [Open on GitHub Pages](https://lee-arts-02.github.io/informal-translation-companion/)
· [Deployment runs](https://github.com/Lee-arts-02/informal-translation-companion/actions)

![Writing companion desktop](preview/writing-desktop.png)

## Write with control

1. Explore the **Guided demo**, or choose **Write my own**. **New draft** starts a
   fresh session; switching to live mode keeps the current draft so you can continue.
2. Describe your intention, what you want to avoid, your reader, and your relationship.
3. Write in English, another language, or a mixture (up to 6,000 characters).
4. Select an expression and click **Keep selected words**. The app protects that
   occurrence from AI replacements and manual edits. Click its chip to unprotect it.
5. Choose light edits, grammar only, selected passage only, or expressive local
   alternatives. Choose the language in which explanations should appear.
6. Ask for focused suggestions. Review the original passage, replacement, reason,
   tradeoff, and possible reader impression. **Nothing changes automatically.**
7. Accept, edit the replacement before applying it, or reject. Optional feedback
   such as “Too formal” guides subsequent live reviews in this session.
8. Compare with the original, undo, check meaning and reader perspective, or
   back-translate for reflection. Copy or explicitly download your finished draft.

For a draft in another language, **Create a starting draft** offers a complete
draft in the chosen writing language. You must review and explicitly accept it;
protected expressions remain unchanged and undo remains available.

## Demo and personal live mode

The writing demo has three authored scenarios: Chinese/English appreciation,
setting a boundary, and an Urdu idiom. Try protection, selective acceptance,
rejection, undo, Chinese explanations, starting-draft preview, and reflection without
an API key. The examples are labeled curated and make no AI requests. Demo results
are limited to known example wording, English writing, English/Simplified Chinese
explanations, and a Simplified Chinese
back-translation. Other wording/languages require live mode; no fake generation occurs.

For live writing or translation, open **API settings** and enter your own
[OpenRouter key](https://openrouter.ai/settings/keys). Use a separate key with a low
credit limit. `openrouter/auto` routes to a model; it is not guaranteed free. You
can instead enter a specific ID from the [model catalog](https://openrouter.ai/models).
Models differ in language quality, cultural knowledge, cost, and reliability.

No shared or owner-funded API account is provided to visitors. Your session key is
not verified until a request succeeds. Ctrl+Enter / Cmd+Enter in either draft box
requests guidance or translation.

## Voice and human perspectives

**My voice profile** lets you explicitly save a short writing example on this
browser, forget it, and enable/disable inclusion of the example and saved style
preferences in live writing requests. There is no automatic long-term learning.

**Invite a human perspective** downloads a text review copy containing your
draft, intention, things to avoid, and protected expressions. Send it yourself to
someone you trust, then paste their feedback into the app. Feedback informs the
next live review but never edits your draft by itself. This is a manual exchange,
not a live collaboration room, account system, or public community.

## Quick translation remains available

Expand **Need a quick translation?** for the original translator, its three curated
scenarios, register choices, and context controls. Live translation and the writing
target menu offer 28 choices, including Simplified Chinese, Traditional Chinese,
Cantonese (Traditional), English, Urdu, Spanish, French, Arabic, Bengali, Dutch,
German, Greek, Hebrew, Hindi, Indonesian, Italian, Japanese, Korean, Malay, Persian,
Polish, Portuguese, Russian, Tamil, Thai, Turkish, Ukrainian, and Vietnamese.

## Run and deploy

No runtime dependencies, CDN scripts, build step, external fonts, or analytics.
Serve the folder over HTTP; ES modules need an HTTP server:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

For Vercel, import this repository, choose the repository root, set Framework
Preset to **Other**, leave Build Command empty, and set Output Directory to `.`.
No deployment environment variables or API key are required for this personal-key app.

For GitHub Pages, choose **Settings → Pages → Source → GitHub Actions**. The
workflow verifies syntax and unit tests and publishes only an explicit app-file
allowlist. The original prototype, tests, plans, and previews are excluded.

## Privacy and boundaries

- API keys exist in tab memory only; reload, navigation, or **Forget key** clears
  them. The app does not put them in storage, URLs, source, exports, or logs.
  Browser extensions/developer tools may still access browser-entered credentials.
- Live requests send the draft, original, context, protected expressions, session
  feedback, and enabled voice preferences/example to OpenRouter and its selected
  provider. Provider retention/privacy policies apply. Cancellation cannot undo
  charges for provider work already processed.
- Drafts, protected spans, the last 40 undo snapshots, and the last 20 session
  decisions stay in memory and disappear on reload. There is no automatic cloud save.
- Only explicit style preferences, the model ID, toggles, and an explicitly saved
  voice example persist locally. A downloaded draft/review file is an intentional
  export. Consider what you disclose before sharing it with a peer.
- AI reader impressions are possibilities, not facts about cultures or people.
  Back-translation is a reflection tool, not an accuracy certificate.
- Local code verifies exact text spans, revision IDs, and protected expressions
  before applying model edits. Overlapping/unsafe/malformed responses are rejected.
  Human review is still necessary for meaning and factual accuracy.
- This independent portfolio project is inspired by an IBM SkillsBuild prototype;
  it is not affiliated with IBM. IBM Bob can support development, but there is no
  claimed Bob runtime integration. Interview notes informed design hypotheses;
  this prototype does not claim validated research outcomes.

## Verify

Use Node.js 22 or newer:

```sh
npm run check
npm test
```

Tests cover the translation API, safe preference persistence, selective edits,
repeated text and emoji offsets, protected expressions, stale suggestions, undo,
feedback, starting drafts, selection boundaries, and honest demo limitations.
They use controlled API responses and incur no model charges.

Optional full browser workflow check:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node tests/writing-browser.cjs
```

Set `TEST_URL` to check a deployed site, and optionally `CHROMIUM_EXECUTABLE` to
use an existing Chromium installation. The check writes desktop/mobile captures
under `preview/`. Paid model quality is not verified by automated checks.

## Structure

| File | Responsibility |
| --- | --- |
| `index.html`, `styles.css`, `writing.css` | Responsive writing and translation UI |
| `writing-session.js` | Versioned draft, protected spans, safe patches, feedback, undo |
| `review-api.js` | Structured review, starting drafts, reflection, back-translation |
| `writing-ui.js`, `writing-demo.js` | Writing interaction and authored examples |
| `app.js`, `demo.js` | Original translator and shared connection settings |
| `translation.js` | Translation and shared provider transport |
| `preferences.js` | Allowlisted translator/style preferences |
| `tests/` | Unit and browser checks |

Implementation scope: [`plan/writing-companion.md`](plan/writing-companion.md).
