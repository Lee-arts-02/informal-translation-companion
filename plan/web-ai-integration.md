# Browser AI integration

Verified against official documentation on 2026-11-06. This is an implementation assessment, not evidence of live model quality.

## Implemented: personal browser API connection

The canvas already uses real OpenRouter requests, not just authored examples. **Connect AI → enter an OpenRouter key → optionally Check connection → Use this connection → Preview sentence**. Personal previews call `POST https://openrouter.ai/api/v1/chat/completions` through `requestCompletion` in `translation.js`. Requests carry the whole draft as context, the current sentence, accumulated requirements for every anchored note intersecting that sentence, the active focus, enabled saved habits, and the interface language. The writer reviews and accepts changes before the draft changes.

The connection dialog discloses these inputs. API keys remain in tab memory and are cleared on disconnect/pagehide. Drafts, annotations, and their requirements are not stored in localStorage. Only explicitly saved habits and interface language are stored. **Check connection** calls `GET https://openrouter.ai/api/v1/key`, without sending the draft or requesting a model completion. A successful key check does not guarantee model availability or sufficient budget for every inference.

This fits the user's earlier personal BYOK choice and static deployment on GitHub Pages or Vercel. No owner API key is embedded in the public website. Existing completed responses retain their source label when connection settings change.

Sources: [OpenRouter authentication](https://openrouter.ai/docs/api_reference/authentication), [key/credit inspection](https://openrouter.ai/docs/api_reference/limits), [quickstart](https://openrouter.ai/docs/quickstart).

## Next option: one-click OpenRouter authorization

OpenRouter's [OAuth PKCE guide](https://openrouter.ai/docs/guides/overview/auth/oauth) supports sending users to its authorization page, returning an authorization code to the app, and exchanging it for a user-owned API key. Use an S256 challenge and a cryptographically random verifier. The user authorizes the app and pays with their own OpenRouter credits. This removes manual key copying without making the project owner pay for visitors' usage.

For this app, an implementation should keep draft and note state intact during the redirect (explicit temporary tab storage, or an authorization popup with strict origin/source validation), remove callback codes from the URL, exchange a code only once, and clear temporary verifier state. The current update does not add OAuth: preserving the user's privacy expectations and writing session across authorization deserves its own implementation and browser checks. No account authorization was performed on the user's behalf.

## Alternative for a public portfolio demo

A server-owned key would require a backend, such as a [Vercel Function](https://vercel.com/docs/functions/runtimes), and a key stored in a [server environment variable](https://vercel.com/docs/environment-variables/managing-environment-variables). The browser would call a same-origin endpoint, and the function would validate the requested action, enforce authentication/usage limits, and call the provider. This changes who pays and needs a real server credential; it is not activated by this branch. GitHub Pages alone cannot execute that backend.

Recommendation: keep BYOK for personal use now; use OAuth PKCE for smoother user-owned connections; use a bounded authenticated backend only if a visitor demo paid by the project owner is an explicit requirement.
