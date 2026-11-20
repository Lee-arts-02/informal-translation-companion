# Built-in AI

User authorizes using the supplied IBM Bob credential for NuanceBridge without mandatory API-key prompts. The credential is configured as a Vercel Production Secret (`BOB_API_KEY`), never included in source or public files. The UI's advanced connection remains optional.

The existing translation transport supports an explicit hosted mode. The homepage chooses hosted mode unless a visitor supplies an optional OpenRouter key. Translation and output revision use same-origin `/api/ai`; the backend rebuilds trusted prompts from bounded plain user input, uses a fixed IBM inference endpoint and server-selected model, and returns only completion content or sanitized errors. Source/context/preferences transmission is disclosed in both interface languages.

The IBM endpoint and model discovery were checked with the supplied key. One short, non-sensitive live translation returned HTTP 200 and valid translation/alternative fields. Unit and browser checks additionally cover credential-free client requests, fixed server prompts/model, input validation, throttling and provider error redaction. Production smoke checks must verify translation with no client API key and no settings dialog.

Source references: [IBM API-key documentation](https://bob.ibm.com/docs/ide/account/api-keys), [IBM service domains](https://bob.ibm.com/docs/ide/troubleshooting/ts-firewall-rules), [published Bob client compatibility adapter](https://github.com/langchain-ai/openwiki/blob/main/src/agent/bob.ts). The compatibility adapter's required registered User-Agent was verified against IBM's model-discovery endpoint before integration.
