// End-to-end UI checks with authored demos and a controlled API fixture (no paid calls).
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const files = fs.readdirSync(root).filter(name => /\.(js|css|svg)$/.test(name)).concat('index.html');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const file = req.url === '/' ? 'index.html' : req.url.slice(1).split('?')[0];
  if (!files.includes(file)) return res.writeHead(404).end();
  res.setHeader('Content-Type', mime[path.extname(file)]); res.end(fs.readFileSync(path.join(root, file)));
});
async function select(page, id, start, end) {
  await page.locator(`#${id}`).evaluate((element, range) => { element.focus(); element.setSelectionRange(...range); element.dispatchEvent(new Event('select')); }, [start, end]);
}
async function until(page, selector, text) { await page.waitForFunction(([s, t]) => document.querySelector(s)?.textContent.includes(t), [selector, text]); }

(async () => {
  let browser;
  if (!process.env.TEST_URL) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const installedChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : process.platform === 'win32' && fs.existsSync(installedChrome) ? { executablePath: installedChrome } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [], sent = []; let holdRepair = false, releaseRepair, startedRepair, finishedRepair;
    page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
    const url = process.env.TEST_URL || `http://127.0.0.1:${server.address().port}`;
    await page.goto(url); await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('#writing-draft').inputValue(), '');
    assert.match(await page.locator('#flow-next-title').textContent(), /Start with/);
    assert(await page.locator('#selection-workbench').evaluate(element => Boolean(element.compareDocumentPosition(document.getElementById('writing-draft')) & Node.DOCUMENT_POSITION_FOLLOWING)));
    assert.equal(await page.locator('#writing-target option').count(), 28);
    assert.equal(await page.locator('#back-language option').count(), 28);
    assert(await page.locator('#copy-draft').isDisabled());
    for (const id of ['protect-selection', 'express-selection', 'instruction-selection']) assert(await page.locator(`#${id}`).isDisabled());
    assert.match(await page.locator('#selected-passage').textContent(), /Select a word/);
    assert.deepEqual(errors, []);
    // Authored journey: inspect intention -> Chinese check -> local repair -> explicitly scoped memory.
    await page.locator('#writing-demo-mode').click();
    await page.locator('#intent-panel > summary').click();
    await page.locator('#extract-intents').click();
    assert.equal(await page.locator('.intent-card').count(), 2);
    assert.match(await page.locator('.intent-card').first().textContent(), /AI interpretation/);
    assert.match(await page.locator('#flow-next-title').textContent(), /interpretation/);
    await page.locator('.intent-card').first().getByRole('button', { name: 'That’s what I mean' }).click();
    assert.match(await page.locator('.intent-card').first().textContent(), /Confirmed by you/);
    await page.locator('.intent-card').first().getByRole('button', { name: 'Remember for later' }).click();
    assert(await page.locator('#habit-review-banner').isVisible());
    await page.locator('#finish-habit-review').click();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('nuancebridge.memories.v2')).items.length), 0);
    await page.locator('#open-check').click(); await page.locator('#back-translate').click();
    assert.equal(await page.locator('#check-text').inputValue(), '我会在周五前发给你。');
    await page.locator('#mark-check-reviewed').click();
    assert.match(await page.locator('#flow-next-title').textContent(), /marked this version/);
    await select(page, 'check-text', 0, 3);
    assert.match(await page.locator('#check-reviewed-status').textContent(), /Not yet reviewed/);
    await page.locator('#correction-note').fill('我说的是尽量，不是保证');
    await page.locator('#repair-writing').click();
    assert.equal(await page.locator('.suggestion-card').count(), 1);
    assert.equal(await page.locator('#writing-draft').inputValue(), "I'll send it to you by Friday.");
    await page.locator('.suggestion-card').getByRole('button', { name: 'Use this expression' }).click();
    assert.equal(await page.locator('#writing-draft').inputValue(), "I'll try to send it to you by Friday.");
    assert(await page.locator('#memory-nudge').isVisible());
    await page.locator('#remember-correction').click();
    assert.equal(await page.locator('#habit-content').evaluate(element => element === document.activeElement), true);
    assert.match(await page.locator('#habit-scope-preview').textContent(), /Friend/);
    await page.locator('#habit-use-any').click(); assert.match(await page.locator('#habit-scope-preview').textContent(), /any reader/);
    await page.locator('#habit-use-context').click();
    await page.locator('#habit-content').fill('Preserve uncertainty in tentative plans');
    assert.equal(await page.locator('#habit-recipient').inputValue(), 'Friend');
    await page.locator('#habits-dialog').screenshot({ path: path.join(root, 'preview/habit-review.png'), animations: 'disabled' });
    await page.locator('#habit-form button[type="submit"]').click();
    assert.equal(await page.locator('.habit-card').count(), 1);
    assert.match(await page.locator('#habit-save-result').textContent(), /Saved on this browser/);
    await page.locator('#finish-habit-review').click();
    await page.locator('[data-panel="check"]').click();
    assert.match(await page.locator('#snapshot-status').textContent(), /Earlier check/);
    assert(await page.locator('#repair-writing').isDisabled());
    await page.locator('#back-translate').click();
    assert.match(await page.locator('#check-text').inputValue(), /尽量/);
    await page.locator('#mark-check-reviewed').click();
    assert.match(await page.locator('#check-reviewed-status').textContent(), /Reviewed by you/);
    await page.locator('[data-panel="history"]').click();
    assert.match(await page.locator('#revision-events').textContent(), /habit saved/);
    // Persist only explicitly saved habits, not drafts/events/API credentials.
    await page.reload(); await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('#writing-draft').inputValue(), '');
    await page.locator('#open-habits').click();
    assert.match(await page.locator('.habit-card').textContent(), /Preserve uncertainty/);
    await page.locator('.habit-card').getByRole('button', { name: 'Edit habit' }).click();
    await page.locator('#habit-channel').selectOption('Email');
    await page.locator('#habit-form button[type="submit"]').click();
    await page.locator('#close-habits').click();
    // Controlled live API validates which context crosses the provider boundary.
    await page.route('https://openrouter.ai/**', async route => {
      const data = JSON.parse(route.request().postDataJSON().messages[1].content); sent.push(data);
      let result;
      if (!data.action) result = { translation: 'Fixture translation', alternatives: { casual: 'Casual fixture', direct: 'Direct fixture', formal: 'Formal fixture' }, nuance: 'Controlled translation fixture' };
      else if (data.action === 'intentions') result = { intentions: [{ content: 'Keep uncertainty', category: 'commitment', evidence: 'try' }] };
      else if (data.action === 'back') result = { text: '我会尽量在周五前发给你。' };
      else if (data.action === 'reflect') result = { meaning: 'Uncertainty retained', reader: 'A possible plan', questions: [] };
      else if (data.action === 'start') result = { draft: data.text };
      else result = { summary: 'One focused possibility', suggestions: [{ start: 0, original: "I'll try", replacement: 'I will try', reason: 'A small local option', tradeoff: 'Less contracted', reader: 'May sound deliberate', intentIds: data.intentions?.map(x => x.id) }] };
      if (holdRepair && data.action === 'repair') { startedRepair(); await new Promise(resolve => { releaseRepair = resolve; }); }
      try { await route.fulfill({ json: { choices: [{ message: { content: JSON.stringify(result) } }] } }); }
      finally { if (holdRepair && data.action === 'repair') finishedRepair(); }
    });
    await page.locator('#writing-draft').fill("I'll try to send it to you by Friday.");
    await page.locator('#context-panel > summary').click();
    await page.locator('#writing-recipient').fill('Friend');
    await page.locator('#writing-channel').selectOption('Email');
    await page.locator('#analyze-writing').click();
    await page.locator('#api-key').fill('fixture-key-not-real');
    await page.locator('#settings-form button[type="submit"]').click();
    await page.locator('#analyze-writing').click(); await until(page, '#writing-suggestions', 'small local option');
    assert.deepEqual(sent.at(-1).preferences, ['Preserve uncertainty in tentative plans']);
    // Unmatched reader must not receive the habit.
    await page.locator('#writing-recipient').fill('Professor');
    await page.locator('#analyze-writing').click(); await until(page, '#writing-suggestions', 'small local option');
    assert.deepEqual(sent.at(-1).preferences, []);
    await page.locator('#writing-recipient').fill('Friend');
    await page.locator('#used-habits > summary').click();
    await page.locator('.session-habit input').uncheck();
    await page.locator('#analyze-writing').click(); await until(page, '#writing-suggestions', 'small local option');
    assert.deepEqual(sent.at(-1).preferences, []);
    await page.locator('.session-habit input').check();
    await page.locator('#use-writing-habits').uncheck();
    assert.match(await page.locator('#habit-count').textContent(), /Off/);
    await page.locator('#analyze-writing').click(); await until(page, '#writing-suggestions', 'small local option');
    assert.deepEqual(sent.at(-1).preferences, []);
    await page.locator('#use-writing-habits').check();
    await page.locator('#intent-panel > summary').click(); await page.locator('#extract-intents').click();
    await until(page, '#intent-list', 'Keep uncertainty');
    await page.locator('#analyze-writing').click(); await until(page, '#writing-suggestions', 'small local option');
    assert.deepEqual(sent.at(-1).intentions, []);
    await page.locator('.intent-card').getByRole('button', { name: 'That’s what I mean' }).click();
    await page.locator('#analyze-writing').click(); await until(page, '#writing-suggestions', 'small local option');
    assert.equal(sent.at(-1).intentions.length, 1);
    assert.equal(sent.at(-1).intentions[0].confirmed, true);
    const card = page.locator('.suggestion-card').first();
    await page.locator('#writing-draft').focus();
    await page.locator('#writing-draft').evaluate(element => element.setSelectionRange(0, 0));
    await page.keyboard.down('Shift');
    for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
    await page.keyboard.up('Shift');
    assert.equal(await page.locator('#selected-passage').textContent(), "I'll try");
    await page.locator('#express-selection').click(); await until(page, '#writing-suggestions', 'small local option');
    assert.equal(sent.at(-1).scope, 'selection'); assert.deepEqual(sent.at(-1).selection, { start: 0, end: 8 });
    await page.locator('#writing-scope').selectOption('light');
    await page.locator('#analyze-writing').click(); await until(page, '#writing-suggestions', 'small local option');
    await card.getByRole('button', { name: 'Make it my own' }).click(); await card.locator('textarea').fill('I can try');
    await card.getByRole('button', { name: 'Use this expression' }).click();
    assert.match(await page.locator('#writing-draft').inputValue(), /^I can try/);
    await page.locator('[data-panel="history"]').click();
    assert.match(await page.locator('#revision-events').textContent(), /I will try/);
    assert.match(await page.locator('#revision-events').textContent(), /I can try/);
    await page.locator('#writing-undo').click();
    assert.match(await page.locator('#writing-draft').inputValue(), /^I'll try/);
    await page.locator('#open-check').click(); await page.locator('#back-translate').click();
    await until(page, '#snapshot-status', 'Current check');
    assert.deepEqual(Object.keys(sent.at(-1)).sort(), ['action', 'backLanguage', 'glossary', 'text']);
    // A changed flag cancels an actual in-flight repair; its eventual result is discarded.
    await page.locator('#correction-note').fill('保留尽量');
    holdRepair = true;
    const started = new Promise(resolve => { startedRepair = resolve; });
    const finished = new Promise(resolve => { finishedRepair = resolve; });
    await page.locator('#repair-writing').click(); await started;
    await select(page, 'check-text', 0, 2); releaseRepair(); await finished; holdRepair = false;
    assert.equal(await page.locator('.suggestion-card').count(), 0);
    assert.match(await page.locator('#writing-status').textContent(), /flagged passage changed/);
    // Changes to context invalidate snapshots and pending repair previews.
    await page.locator('#mark-check-reviewed').click();
    assert.match(await page.locator('#check-reviewed-status').textContent(), /Reviewed by you/);
    await page.locator('#writing-avoid').fill('Avoid overpromising');
    assert(await page.locator('#repair-writing').isDisabled());
    assert.match(await page.locator('#check-reviewed-status').textContent(), /Not yet reviewed/);
    await page.locator('#starting-draft').click(); await page.locator('#starting-preview').waitFor({ state: 'visible' });
    await page.locator('#accept-starting').click();
    // Selected notes move only after confirmation, and protected words reject edits.
    await page.locator('#writing-draft').fill('Hello. 不要太正式');
    await select(page, 'writing-draft', 7, 12); await page.locator('#instruction-selection').click();
    assert.equal(await page.locator('#writing-draft').inputValue(), 'Hello. ');
    assert.match(await page.locator('#selection-feedback').textContent(), /no longer in the final draft/);
    assert.match(await page.locator('#writing-intent').inputValue(), /不要太正式/);
    await page.locator('#writing-undo').click();
    assert.equal(await page.locator('#writing-draft').inputValue(), 'Hello. 不要太正式');
    assert(!((await page.locator('#writing-intent').inputValue()).includes('不要太正式')));
    await select(page, 'writing-draft', 7, 12); await page.locator('#instruction-selection').click();
    await select(page, 'writing-draft', 0, 5); await page.locator('#protect-selection').click();
    assert.match(await page.locator('#selection-feedback').textContent(), /Kept exactly/);
    assert(await page.locator('#writing-draft').evaluate(element => element === document.activeElement));
    await select(page, 'writing-draft', 0, 5);
    assert.equal(await page.locator('#selected-passage').textContent(), 'Hello');
    assert(await page.locator('#protect-selection').isDisabled());
    assert(await page.locator('#instruction-selection').isDisabled());
    assert.match(await page.locator('#selection-guidance').textContent(), /protected words/);
    await page.locator('#writing-draft').fill('Changed');
    assert.equal(await page.locator('#writing-draft').inputValue(), 'Hello. ');
    assert.match(await page.locator('#writing-error').textContent(), /protected/i);
    // Quick translator regression.
    await page.locator('#translation-tool > summary').click();
    await page.locator('[data-demo="spanish"]').click();
    assert.match(await page.locator('#translation').textContent(), /resolve this very quickly/);
    // Pausing/deleting a habit must also affect the retained quick translator.
    await page.locator('#open-profile').click();
    await page.locator('.habit-card').getByRole('button', { name: 'Pause', exact: true }).click(); await page.locator('#close-habits').click();
    await page.locator('#live-mode').click(); await page.locator('#recipient').selectOption('Friend'); await page.locator('#channel').selectOption('Email');
    await page.locator('#source-text').fill('Thanks for your help'); await page.locator('#translate').click(); await until(page, '#translation', 'Fixture translation');
    assert.deepEqual(sent.at(-1).preferences, []);
    await page.locator('#open-profile').click(); await page.locator('.habit-card').getByRole('button', { name: 'Enable', exact: true }).click(); await page.locator('#close-habits').click();
    await page.locator('#translate').click(); await until(page, '#translation', 'Fixture translation');
    assert.deepEqual(sent.at(-1).preferences, ['Preserve uncertainty in tentative plans']);
    await page.locator('#open-profile').click(); await page.locator('.habit-card').getByRole('button', { name: 'Delete', exact: true }).click(); await page.locator('#close-habits').click();
    await page.locator('#translate').click(); await until(page, '#translation', 'Fixture translation'); assert.deepEqual(sent.at(-1).preferences, []);
    await page.locator('#translation-tool > summary').click();
    // Import/round-trip unknown scope options without broadening them; malformed imports are atomic.
    await page.locator('#open-habits').click(); await page.locator('.habit-tools > summary').click();
    const imported = { version: 2, items: [{ id: 'import-fixture', content: 'Keep uncertainty', enabled: false, confirmed: true, scope: { recipient: 'Friend', channel: 'Letter', target: 'Klingon' }, source: { kind: 'manual', label: 'User supplied test import', eventId: '' }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] };
    await page.locator('#import-habits').setInputFiles({ name: 'habits.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
    await until(page, '#habits-list', 'Keep uncertainty');
    await page.locator('.habit-card').getByRole('button', { name: 'Edit habit' }).click();
    assert.equal(await page.locator('#habit-channel').inputValue(), 'Letter'); assert.equal(await page.locator('#habit-target').inputValue(), 'Klingon');
    await page.locator('#habit-content').fill('Keep uncertainty carefully'); await page.locator('#habit-form button[type="submit"]').click();
    assert.match(await page.locator('.habit-card').textContent(), /Letter · Klingon/);
    await page.locator('#import-habits').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"version":2,"items":[{}]}') });
    await until(page, '#habits-status', 'Nothing imported'); assert.equal(await page.locator('.habit-card').count(), 1);
    const downloadPromise = page.waitForEvent('download'); await page.locator('#export-habits').click(); const backup = await downloadPromise;
    const exported = JSON.parse(fs.readFileSync(await backup.path(), 'utf8'));
    assert.equal(exported.items[0].scope.channel, 'Letter'); assert.equal(exported.items[0].enabled, false);
    await page.locator('#close-habits').click();
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    assert(!stored.includes('fixture-key-not-real')); assert(!stored.includes('Hello. ')); assert(!stored.includes('不要太正式'));
    await page.reload(); await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('#writing-draft').inputValue(), '');
    await page.locator('#writing-draft').fill('A fresh draft'); await page.locator('#analyze-writing').click();
    assert(await page.locator('#settings').isVisible()); assert.equal(await page.locator('#api-key').inputValue(), ''); await page.keyboard.press('Escape');
    // Real DOM and screenshots on desktop and phone, including a fully populated workflow.
    await page.locator('#writing-demo-mode').click(); await page.locator('#intent-panel > summary').click(); await page.locator('#extract-intents').click();
    await page.locator('#analyze-writing').click();
    fs.mkdirSync(path.join(root, 'preview'), { recursive: true });
    await page.locator('#context-panel').evaluate(element => { element.open = false; });
    await page.locator('#intent-panel').evaluate(element => { element.open = false; });
    await select(page, 'writing-draft', 0, 4);
    await page.locator('#selection-workbench').screenshot({ path: path.join(root, 'preview/selection-actions.png'), animations: 'disabled' });
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow at ${width}`);
      const sticky = await page.evaluate(() => {
        const toolbar = document.getElementById('selection-workbench'), draft = document.getElementById('writing-draft');
        const top = toolbar.getBoundingClientRect().top + scrollY;
        window.scrollTo(0, top + 80);
        const rect = toolbar.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, draftBottom: draft.getBoundingClientRect().bottom };
      });
      assert(sticky.top >= 0 && sticky.top <= 12, `Selection controls must stay at viewport top at ${width}: ${JSON.stringify(sticky)}`);
      assert(sticky.bottom < sticky.draftBottom, `Selection controls must leave draft content below them at ${width}`);
      await page.evaluate(() => window.scrollTo(0, 0));
      const above = await page.evaluate(() => document.getElementById('selection-workbench').getBoundingClientRect().bottom <= document.getElementById('writing-draft').getBoundingClientRect().top + 1);
      assert(above, `Passage controls must render above the editor at ${width}`);
      if (width !== 320) await page.screenshot({ path: path.join(root, `preview/writing-${width === 1440 ? 'desktop' : 'mobile'}.png`), fullPage: true, animations: 'disabled' });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.locator('#suggestions-panel').isVisible());
    await page.locator('#close-companion').click(); assert(!(await page.locator('#suggestions-panel').isVisible()));
    await page.screenshot({ path: path.join(root, 'preview/writing-mobile.png'), fullPage: true, animations: 'disabled' });
    await page.locator('#open-companion').click(); assert(await page.locator('#suggestions-panel').isVisible()); await page.keyboard.press('Escape');
    assert(!(await page.locator('#suggestions-panel').isVisible()));
    await page.locator('#open-check').click(); await page.locator('#back-translate').click();
    await page.screenshot({ path: path.join(root, 'preview/writing-mobile-check.png'), animations: 'disabled' });
    await page.locator('#correction-note').fill('保留尽量'); await page.locator('#repair-writing').click();
    assert(await page.locator('.suggestion-card').isVisible());
    // Storage denied should not break initialization or explicit memory-only save.
    const restricted = await browser.newPage(); const restrictedErrors = [];
    restricted.on('pageerror', error => restrictedErrors.push(error.message));
    await restricted.addInitScript(() => { Storage.prototype.getItem = () => { throw new Error('storage denied'); }; Storage.prototype.setItem = () => { throw new Error('storage denied'); }; });
    await restricted.goto(url); await restricted.waitForLoadState('networkidle');
    assert.equal(await restricted.locator('#writing-draft').inputValue(), '');
    await restricted.locator('#open-habits').click(); await restricted.locator('#habit-content').fill('Visit-only habit');
    await restricted.locator('#habit-form button[type="submit"]').click();
    assert.match(await restricted.locator('.habit-card').textContent(), /Visit-only habit/);
    assert.match(await restricted.locator('#habits-status').textContent(), /only for this visit/);
    assert.match(await restricted.locator('#finish-habit-review').textContent(), /Kept for this visit/);
    assert.deepEqual(restrictedErrors, []); await restricted.close();
    assert.deepEqual(errors, []);
    console.log('PASS: authored end-to-end intention/check/repair/memory; scoped live inputs; per-session exclusions; user-edited provenance; undo; source-blind backtranslation; stale snapshots; note extraction; protection; reload/key privacy; translator; desktop/mobile; denied storage.');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
