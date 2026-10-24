# NuanceBridge intent workspace implementation plan

> Execute inline with superpowers:executing-plans; request one independent code review before publishing.

**Goal:** Deliver all three approved rounds: friendly writing workspace, inspectable expression intent and cross-language repair, and explicit scoped memory, tested and pushed to the existing GitHub repository.

**Architecture:** Keep the static ES-module app and the existing protected-range editing engine. Add focused intent/memory/workflow modules and UI panels; use the existing provider transport with action-specific validated requests. No dependencies or shared API credentials in the deployed app.

**Spec:** The approved design in this conversation (24 October 2026).

## Constraints
- Preserve quick translation, 28 target choices, demos, starting-draft preview, undo and human feedback export.
- Original/current drafts and events remain session-only; durable preferences require explicit save. Keys remain tab-memory only.
- Distinguish user-supplied, model-proposed and confirmed intent. Never present model explanations as causal evidence.
- Backtranslation receives only the current draft, check language and necessary glossary; comparison/repair is a separate action.
- Context or text changes invalidate pending requests and previews; check snapshots bind to version and language.
- Keep the user's untracked PDF untouched and out of commits.

## Review focus
- Stale repair after text/context/intent changes must never apply.
- Protected repeated phrases and Unicode must survive repair, start and manual edits.
- Invalid memory imports must be atomic; disabled or out-of-scope preferences must not leak into live requests.
- Retained old snapshots must be clearly stale, never represented as current.
- Empty states, storage failure, narrow screens and keyboard access must remain usable.

## Tasks
- [x] 1. Add failing unit tests for intent origin/confirmation, memory migration/scope/import, event provenance and snapshot freshness; implement focused state modules.
- [x] 2. Add request privacy/repair tests; implement separate intent, backtranslation and validated local repair APIs and authored end-to-end demo.
- [x] 3. Replace the writing workspace presentation with draft-first layout, optional context, intent cards, layered suggestions, check-and-repair panel, event history and explicit memory drawer. Retain existing utilities.
- [x] 4. Add browser checks for demo and mocked live full journeys, memory persistence/import, stale work, protection, mobile and storage failure; inspect rendered desktop/mobile.
- [x] 5a. Independent code review, fix findings, rerun required checks, update README/deploy allowlist.
- [x] 5b. Commit and push; inspect remote commit and deployment.

## Execution ledger
- Baseline: main with only one untracked user PDF; no tracked modifications. Approved scope covers all three rounds and GitHub push.
- Ruling: keep the current static deployment and existing quick-translator UI. Use English interface copy for the existing portfolio, Chinese explanations/checking by default; no forced confirmation wizard.
- Core/API tests were observed failing before implementing the new state and request boundaries, then passing.
- 39 unit tests and all JS syntax checks pass. Full installed-Chrome integration passes with authored demos and intercepted API fixtures, not paid-model calls.
- Browser evidence includes the complete intention → Chinese check → local English repair → explicit scoped save → reload journey, context matching, writing-profile off/exclusion, shared translator pause/delete behavior, unknown imported scope round-trip, atomic malformed import, actual in-flight repair cancellation, note extraction/undo, protected edits, key privacy, denied-storage visit-only saves and 1440/390/320px layouts.
- Reviewed desktop and phone screenshots; mobile assistance is a dismissible bottom panel. Preview images updated.
- Independent code review identified and verified fixes for stale flagged repairs, legacy translator preference leakage, typing-history cost, custom imported scopes and disabled-state visibility. Follow-up review approved with no release blockers.
- No project-memory registry is present. The unrelated untracked user PDF remains untouched.
- Release commit: `ad41b80cd5fa7d705a0025bdda640efd491907e7`, pushed to the existing repository's `main`.
- GitHub Actions verification and Pages deployment succeeded: https://github.com/Lee-arts-02/informal-translation-companion/actions/runs/40131361965 . Vercel reported successful deployment for the same commit.
- The complete intercepted-API browser suite passed independently against both https://nuancebridge.vercel.app/ and https://lee-arts-02.github.io/informal-translation-companion/ . No paid-model translation-quality claims are made.
- Completion audit: all three approved rounds are implemented; original translation/preview/protection/undo utilities remain; explicit memory lifecycle and source-blind, version-bound checking are covered by code and regression evidence. Temporary implementation files were removed individually.
