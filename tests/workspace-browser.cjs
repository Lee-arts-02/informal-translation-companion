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
  await page.locator(`#${id}`).evaluate((element, range) => { element.focus(); element.setSelectionRange(...range); element.dispatchEvent(new Event('select')); if (element.id === 'writing-draft') element.dispatchEvent(new Event('pointerup')); }, [start, end]);
}
async function until(page, selector, text) { await page.waitForFunction(([s, t]) => document.querySelector(s)?.textContent.includes(t), [selector, text]); }

// Open disclosures through their visible summaries, as a user would.
async function ready(page, selector) {
  if (selector === '[data-panel="check"]') selector = '#open-check';
  if (selector === '[data-panel="history"]') selector = '#open-history';
  const locator = page.locator(selector);
  if ((selector.includes('intent-panel') || selector === '.intent-card') && await page.locator('#intent-panel').evaluate(el => el.hidden))
    await (await ready(page, '#flow-intention')).click();
  const parents = await locator.first().evaluate(el => {
    const result = []; for (let p = el.parentElement; p; p = p.parentElement)
      if (p.tagName === 'DETAILS') result.unshift(p.id);
    return result;
  });
  for (const id of parents) if (id && !await page.locator(`#${id}`).evaluate(el => el.open))
    await page.locator(`#${id} > summary`).click();
  return locator;
}
async function openTools(page, section) {
  await ready(page, `#${section} > summary`);
  if (!await page.locator(`#${section}`).evaluate(el => el.open)) await page.locator(`#${section} > summary`).click();
}

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
    assert(!(await page.locator('#connection-hint').isVisible()));
    assert(!(await page.locator('#writing-tools').evaluate(el => el.open)));
    assert(!(await page.locator('#suggestions-panel').isVisible()));
    assert.match(await page.locator('#flow-next-title').textContent(), /Start with/);
    assert(!(await page.locator('#selection-workbench').isVisible()));
    assert.equal(await page.locator('#writing-target option').count(), 28);
    assert.equal(await page.locator('#back-language option').count(), 28);
    assert(await page.locator('#copy-draft').isDisabled());
    for (const id of ['protect-selection', 'express-selection', 'instruction-selection']) assert(await page.locator(`#${id}`).isDisabled());
    assert.match(await page.locator('#selected-passage').textContent(), /Select a word/);
    assert.deepEqual(errors, []);
    // Authored journey: inspect intention -> Chinese check -> local repair -> explicitly scoped memory.
    await page.locator('#writing-demo-mode').click();
    await openTools(page, 'intent-panel');
    await page.locator('#extract-intents').click();
    assert.equal(await page.locator('.intent-card').count(), 2);
    assert(await page.locator('[data-confirm-intent]').first().evaluate(element => element === document.activeElement));
    assert.match(await page.locator('.intent-card').first().textContent(), /AI interpretation/);
    assert.match(await page.locator('#flow-next-title').textContent(), /interpretation/);
    await page.locator('.intent-card').first().getByRole('button', { name: 'That’s what I mean' }).click();
    assert(await page.locator('[data-confirm-intent]').first().evaluate(element => element === document.activeElement));
    assert.match(await page.locator('.intent-card').first().textContent(), /Confirmed by you/);
    await page.locator('.intent-card').first().getByRole('button', { name: 'Remember for later' }).click();
    assert(await page.locator('#habit-review-banner').isVisible());
    await page.locator('#finish-habit-review').click();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('nuancebridge.memories.v2')).items.length), 0);
    await (await ready(page, '#open-check')).click(); await page.locator('#back-translate').click();
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
    assert.match(await page.locator('#decision-result').textContent(), /Applied to your draft/);
    assert(!((await page.locator('#writing-suggestions').textContent()).includes('Start with your words')));
    await (await ready(page, '#remember-correction')).click();
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
    await (await ready(page, '[data-panel="check"]')).click();
    assert.match(await page.locator('#snapshot-status').textContent(), /Earlier check/);
    assert(await page.locator('#repair-writing').isDisabled());
    await page.locator('#back-translate').click();
    assert.match(await page.locator('#check-text').inputValue(), /尽量/);
    await page.locator('#mark-check-reviewed').click();
    assert.match(await page.locator('#check-reviewed-status').textContent(), /Reviewed by you/);
    await (await ready(page, '[data-panel="history"]')).click();
    assert.match(await page.locator('#revision-events').textContent(), /habit saved/);
    // Persist only explicitly saved habits, not drafts/events/API credentials.
    await page.reload(); await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('#writing-draft').inputValue(), '');
    await (await ready(page, '#open-habits')).click();
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
    await openTools(page, 'context-panel');
    await (await ready(page, '#writing-recipient')).fill('Friend');
    await (await ready(page, '#writing-channel')).selectOption('Email');
    await (await ready(page, '#analyze-writing')).click();
    await page.locator('#api-key').fill('fixture-key-not-real');
    await page.locator('#settings-form button[type="submit"]').click();
    await (await ready(page, '#analyze-writing')).click(); await until(page, '#writing-suggestions', 'small local option');
    assert.deepEqual(sent.at(-1).preferences, ['Preserve uncertainty in tentative plans']);
    // Unmatched reader must not receive the habit.
    await (await ready(page, '#writing-recipient')).fill('Professor');
    await (await ready(page, '#analyze-writing')).click(); await until(page, '#writing-suggestions', 'small local option');
    assert.deepEqual(sent.at(-1).preferences, []);
    await (await ready(page, '#writing-recipient')).fill('Friend');
    await openTools(page, 'used-habits');
    await (await ready(page, '.session-habit input')).uncheck();
    await (await ready(page, '#analyze-writing')).click(); await until(page, '#writing-suggestions', 'small local option');
    assert.deepEqual(sent.at(-1).preferences, []);
    await (await ready(page, '.session-habit input')).check();
    await (await ready(page, '#use-writing-habits')).uncheck();
    assert.match(await page.locator('#habit-count').textContent(), /Off/);
    await (await ready(page, '#analyze-writing')).click(); await until(page, '#writing-suggestions', 'small local option');
    assert.deepEqual(sent.at(-1).preferences, []);
    await (await ready(page, '#use-writing-habits')).check();
    await openTools(page, 'intent-panel'); await page.locator('#extract-intents').click();
    await until(page, '#intent-list', 'Keep uncertainty');
    await (await ready(page, '#analyze-writing')).click(); await until(page, '#writing-suggestions', 'small local option');
    assert.deepEqual(sent.at(-1).intentions, []);
    await (await ready(page, '.intent-card')).getByRole('button', { name: 'That’s what I mean' }).click();
    await (await ready(page, '#analyze-writing')).click(); await until(page, '#writing-suggestions', 'small local option');
    assert.equal(sent.at(-1).intentions.length, 1);
    assert.equal(sent.at(-1).intentions[0].confirmed, true);
    const card = page.locator('.suggestion-card').first();
    await page.locator('#writing-draft').focus();
    await page.locator('#writing-draft').evaluate(element => element.setSelectionRange(0, 0));
    await page.keyboard.down('Shift');
    for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
    await page.keyboard.up('Shift');
    assert.equal(await page.locator('#selected-passage').textContent(), "I'll try");
    await page.keyboard.press('Tab'); assert(await page.locator('#protect-selection').evaluate(element => element === document.activeElement));
    await page.keyboard.press('Tab'); assert(await page.locator('#express-selection').evaluate(element => element === document.activeElement));
    await page.keyboard.press('Enter'); await until(page, '#writing-suggestions', 'small local option');
    assert.equal(sent.at(-1).scope, 'selection'); assert.deepEqual(sent.at(-1).selection, { start: 0, end: 8 });
    await (await ready(page, '#writing-scope')).selectOption('light');
    await (await ready(page, '#analyze-writing')).click(); await until(page, '#writing-suggestions', 'small local option');
    await card.getByRole('button', { name: 'Make it my own' }).click(); await card.locator('textarea').fill('I can try');
    await card.getByRole('button', { name: 'Use this expression' }).click();
    assert.match(await page.locator('#writing-draft').inputValue(), /^I can try/);
    await (await ready(page, '[data-panel="history"]')).click();
    assert.match(await page.locator('#revision-events').textContent(), /I will try/);
    assert.match(await page.locator('#revision-events').textContent(), /I can try/);
    await (await ready(page, '#writing-undo')).click();
    assert.match(await page.locator('#writing-draft').inputValue(), /^I'll try/);
    await (await ready(page, '#open-check')).click(); await page.locator('#back-translate').click();
    await until(page, '#snapshot-status', 'Current check');
    assert.deepEqual(Object.keys(sent.at(-1)).sort(), ['action', 'backLanguage', 'glossary', 'text']);
    // A changed flag cancels an actual in-flight repair; its eventual result is discarded.
    await page.locator('#correction-note').fill('保留尽量');
    holdRepair = true;
    const started = new Promise(resolve => { startedRepair = resolve; });
    const finished = new Promise(resolve => { finishedRepair = resolve; });
    await page.locator('#repair-writing').click(); await started;
    assert(await page.locator('#flow-next-action').isDisabled());
    await select(page, 'check-text', 0, 2); releaseRepair(); await finished; holdRepair = false;
    assert.equal(await page.locator('.suggestion-card').count(), 0);
    assert.match(await page.locator('#writing-status').textContent(), /flagged passage changed/);
    // Changes to context invalidate snapshots and pending repair previews.
    await page.locator('#mark-check-reviewed').click();
    assert.match(await page.locator('#check-reviewed-status').textContent(), /Reviewed by you/);
    await (await ready(page, '#writing-avoid')).fill('Avoid overpromising');
    assert(await page.locator('#repair-writing').isDisabled());
    assert.match(await page.locator('#check-reviewed-status').textContent(), /Not yet reviewed/);
    await (await ready(page, '#starting-draft')).click(); await page.locator('#starting-preview').waitFor({ state: 'visible' });
    await page.locator('#accept-starting').click();
    // Selected notes move only after confirmation, and protected words reject edits.
    await page.locator('#writing-draft').fill('Hello. 不要太正式');
    await select(page, 'writing-draft', 7, 12); await page.locator('#instruction-selection').click();
    assert.equal(await page.locator('#writing-draft').inputValue(), 'Hello. ');
    assert.match(await page.locator('#selection-feedback').textContent(), /no longer in the final draft/);
    assert.match(await (await ready(page, '#writing-intent')).inputValue(), /不要太正式/);
    await (await ready(page, '#writing-undo')).click();
    assert.equal(await page.locator('#writing-draft').inputValue(), 'Hello. 不要太正式');
    assert(!((await (await ready(page, '#writing-intent')).inputValue()).includes('不要太正式')));
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
    await (await ready(page, '#open-habits')).click(); await page.locator('.habit-tools > summary').click();
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
    await page.locator('#writing-draft').fill('A fresh draft'); await (await ready(page, '#analyze-writing')).click();
    assert(await page.locator('#settings').isVisible()); assert.equal(await page.locator('#api-key').inputValue(), ''); await page.keyboard.press('Escape');
    // Real DOM and screenshots on desktop and phone, including a fully populated workflow.
    await page.locator('#writing-demo-mode').click(); await openTools(page, 'intent-panel'); await page.locator('#extract-intents').click();
    await (await ready(page, '#analyze-writing')).click();
    fs.mkdirSync(path.join(root, 'preview'), { recursive: true });
    await page.locator('#context-panel').evaluate(element => { element.open = false; });
    await page.locator('#intent-panel').evaluate(element => { element.open = false; });
    await select(page, 'writing-draft', 0, 4);
    await page.locator('#selection-workbench').screenshot({ path: path.join(root, 'preview/selection-actions.png'), animations: 'disabled' });
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      if (width < 750 && await page.locator('#suggestions-panel').isVisible()) await page.locator('#close-companion').click();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow at ${width}`);
      await page.locator('#writing-draft').evaluate(element => element.scrollIntoView({ block: 'center' }));
      await select(page, 'writing-draft', 0, 4);
      await page.waitForFunction(() => document.getElementById('selection-workbench').matches(':popover-open'));
      const floating = await page.evaluate(() => {
        const toolbar = document.getElementById('selection-workbench'), rect = toolbar.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, side: toolbar.dataset.side, anchor: Number(toolbar.dataset.anchorTop) };
      });
      assert(floating.left >= 9 && floating.right <= width - 9, `Popover stays in viewport at ${width}`);
      assert.equal(floating.side, 'above'); assert(Math.abs(floating.bottom + 10 - floating.anchor) < 2, `Popover follows selected words at ${width}`);
      if (width !== 320) await page.screenshot({ path: path.join(root, `preview/writing-${width === 1440 ? 'desktop' : 'mobile'}.png`), fullPage: true, animations: 'disabled' });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await (await ready(page, '#open-companion')).click();
    assert(await page.locator('#suggestions-panel').isVisible());
    await page.locator('#close-companion').click(); assert(!(await page.locator('#suggestions-panel').isVisible()));
    await page.screenshot({ path: path.join(root, 'preview/writing-mobile.png'), fullPage: true, animations: 'disabled' });
    await (await ready(page, '#open-companion')).click(); assert(await page.locator('#suggestions-panel').isVisible()); await page.keyboard.press('Escape');
    assert(!(await page.locator('#suggestions-panel').isVisible()));
    await (await ready(page, '#open-check')).click(); await page.locator('#back-translate').click();
    await page.screenshot({ path: path.join(root, 'preview/writing-mobile-check.png'), animations: 'disabled' });
    await page.locator('#correction-note').fill('保留尽量'); await page.locator('#repair-writing').click();
    assert(await page.locator('.suggestion-card').isVisible());
    // The popover follows text fragments, not the editor's top edge.
    const float = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    float.on('pageerror', error => errors.push(error.message)); await float.goto(url); await float.waitForLoadState('networkidle');
    const settle = p => p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const floatingState = p => p.evaluate(() => {
      const toolbar = document.getElementById('selection-workbench'), rect = toolbar.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, anchor: Number(toolbar.dataset.anchorTop), side: toolbar.dataset.side, draftTop: document.getElementById('writing-draft').getBoundingClientRect().top };
    });
    const lines = Array.from({ length: 42 }, (_, i) => `Line ${i} 中文`).join('\n');
    for (const width of [1440, 390]) {
      await float.setViewportSize({ width, height: 1000 }); await float.locator('#writing-draft').fill(lines);
      await float.locator('#writing-draft').evaluate(element => { element.scrollIntoView({ block: 'center' }); element.scrollTop = 0; });
      await select(float, 'writing-draft', 0, 6); await settle(float); const first = await floatingState(float);
      const secondIndex = lines.indexOf('Line 1 '); await select(float, 'writing-draft', secondIndex, secondIndex + 6); await settle(float); const second = await floatingState(float);
      assert(second.top - first.top > 25, `Popover follows the second line at ${width}`);
      const index = lines.indexOf('Line 13 ');
      await float.locator('#writing-draft').evaluate(element => { element.scrollTop = parseFloat(getComputedStyle(element).lineHeight) * 8; });
      await select(float, 'writing-draft', index, index + 7); await settle(float); const middle = await floatingState(float);
      assert(middle.top > middle.draftTop + 10, `Popover is next to a middle line, not above the editor at ${width}`);
      assert.equal(middle.side, 'above'); assert(Math.abs(middle.bottom + 10 - middle.anchor) < 2);
      await float.locator('#writing-draft').evaluate(element => { element.scrollTop += parseFloat(getComputedStyle(element).lineHeight); });
      await settle(float); const scrolled = await floatingState(float);
      assert(scrolled.top < middle.top - 25, `Popover follows textarea scrolling at ${width}`);
      await float.evaluate(() => window.scrollBy(0, 35)); await settle(float); const moved = await floatingState(float);
      assert(Math.abs(scrolled.top - moved.top - 35) < 2, `Popover follows page scrolling at ${width}`);
      await float.locator('#writing-draft').evaluate(element => { element.scrollTop = element.scrollHeight; }); await settle(float);
      assert(!(await float.locator('#selection-workbench').isVisible()), 'Offscreen selected text hides actions');
      await float.locator('#writing-draft').evaluate(element => { element.scrollTop = parseFloat(getComputedStyle(element).lineHeight) * 8; }); await settle(float);
      assert(await float.locator('#selection-workbench').isVisible());
      if (width === 390) await float.screenshot({ path: path.join(root, 'preview/selection-floating-mobile.png'), animations: 'disabled' });
      await float.keyboard.press('Escape'); assert(!(await float.locator('#selection-workbench').isVisible()));
      const prefix = '中英 mixed words '.repeat(8), wrapped = `${prefix}wrappedTarget after the mixed-language phrase.`;
      await float.locator('#writing-draft').fill(wrapped); await float.locator('#writing-draft').evaluate(element => { element.scrollTop = 0; element.scrollIntoView({ block: 'center' }); });
      await select(float, 'writing-draft', 0, 2); await settle(float); const wrapFirst = await floatingState(float);
      await select(float, 'writing-draft', prefix.length, prefix.length + 13); await settle(float); const wrapLast = await floatingState(float);
      assert(wrapLast.anchor > wrapFirst.anchor + 25, `Soft wrapping moves the selected-text anchor at ${width}`);
      assert(wrapLast.left >= 9 && wrapLast.right <= width - 9);
      await float.keyboard.press('Tab'); assert(await float.locator('#protect-selection').evaluate(element => element === document.activeElement));
      await float.keyboard.press('Tab'); await float.keyboard.press('Tab'); await float.keyboard.press('Tab');
      assert(!(await float.locator('#selection-workbench').isVisible()), 'Tab can leave the toolbar without a focus trap');
      await select(float, 'writing-draft', prefix.length, prefix.length + 13); await settle(float);
      await float.mouse.click(3, 3); assert(!(await float.locator('#selection-workbench').isVisible()));
    }
    await float.close();
    // Fresh-user journeys use visible controls, including the full mobile save flow.
    for (const width of [1440, 390, 320]) {
      const newcomer = await browser.newPage({ viewport: { width, height: width === 320 ? 700 : 900 }, reducedMotion: 'reduce', isMobile: width < 750, hasTouch: width < 750 });
      newcomer.on('pageerror', error => errors.push(error.message)); newcomer.on('dialog', dialog => dialog.accept());
      await newcomer.goto(url); await newcomer.waitForLoadState('networkidle');
      assert(!(await newcomer.locator('#writing-tools').evaluate(el => el.open)));
      assert(!(await newcomer.locator('#suggestions-panel').isVisible()));
      assert(await newcomer.locator('#writing-draft').isVisible());
      assert.equal(await newcomer.locator('.quiet-tools, .panel-switch, #flow-check').count(), 0, 'No parallel tool entrances or review tabs');
      assert(await newcomer.locator('#flow-next-action').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight), `Next step is in the first screen at ${width}`);
      for (const id of ['writing-intent', 'extract-intents', 'check-output', 'habit-form']) assert(!(await newcomer.locator(`#${id}`).isVisible()));
      assert(await newcomer.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await newcomer.screenshot({ path: path.join(root, `preview/minimal-${width}.png`), fullPage: true, animations: 'disabled' });
      await newcomer.locator('#open-settings').click(); assert(await newcomer.locator('#settings').isVisible()); await newcomer.keyboard.press('Escape');
      await newcomer.locator('#writing-demo-mode').click();
      assert(!(await newcomer.locator('#writing-tools').evaluate(el => el.open)));
      await newcomer.locator('#flow-next-action').click();
      assert(await newcomer.locator('#suggestions-panel').isVisible());
      const layout = await newcomer.evaluate(() => {
        const draft = document.getElementById('writing-draft').getBoundingClientRect();
        const review = document.getElementById('suggestions-panel').getBoundingClientRect();
        return { draftBottom: draft.bottom, reviewTop: review.top, width: review.width, position: getComputedStyle(document.getElementById('suggestions-panel')).position };
      });
      assert(layout.reviewTop >= layout.draftBottom, 'Review follows the draft instead of sitting beside or over it');
      assert.equal(layout.position, 'static');
      await newcomer.locator('#close-companion').click();
      await select(newcomer, 'writing-draft', 0, 4); await newcomer.locator('#protect-selection').click();
      assert.match(await newcomer.locator('#selection-feedback').textContent(), /Kept exactly/); await (await ready(newcomer, '#writing-undo')).click();
      await (await ready(newcomer, '#flow-intention')).click();
      assert(!(await newcomer.locator('#writing-tools').evaluate(el => el.open)));
      assert(await newcomer.locator('#context-panel #intent-panel').isVisible());
      await newcomer.locator('#extract-intents').click();
      await newcomer.locator('[data-confirm-intent]').first().click();
      assert(await newcomer.locator('[data-confirm-intent]').first().evaluate(element => element === document.activeElement));
      await newcomer.locator('.intent-card').first().locator('.intent-edit > summary').click();
      await newcomer.locator('.intent-card').first().locator('.intent-edit input').fill('Keep tentative plans tentative.');
      await newcomer.locator('.intent-card').first().getByRole('button', { name: 'Use my wording' }).click();
      assert(await newcomer.locator('[data-confirm-intent]').first().evaluate(element => element === document.activeElement));
      await newcomer.locator('.intent-card').last().getByRole('button', { name: 'Remove', exact: true }).click();
      assert(await newcomer.locator('#back-from-intentions').evaluate(element => element === document.activeElement));
      await newcomer.locator('#back-from-intentions').click();
      assert(await newcomer.locator('#writing-draft').evaluate(element => element === document.activeElement));
      await newcomer.locator('#flow-next-action').click(); assert(!(await newcomer.locator('#check-output').isVisible()));
      await newcomer.locator('#back-translate').click(); assert(await newcomer.locator('#check-draft-comparison').evaluate(element => element.open));
      assert.match(await newcomer.locator('#check-intent-reference').textContent(), /Keep tentative plans tentative/);
      assert(await newcomer.locator('#panel-suggestions').isVisible(), 'Earlier review remains in the same flow');
      if (width === 1440) await newcomer.locator('#writing-workspace').screenshot({ path: path.join(root, 'preview/continuous-desktop.png'), animations: 'disabled' });
      if (width === 390) await newcomer.locator('#writing-workspace').screenshot({ path: path.join(root, 'preview/continuous-mobile.png'), animations: 'disabled' });
      await newcomer.locator('[data-mismatch]').first().click(); await newcomer.locator('#repair-writing').click();
      await newcomer.locator('.suggestion-card').getByRole('button', { name: 'Use this expression' }).click();
      assert.match(await newcomer.locator('#decision-result').textContent(), /Applied to your draft/);
      assert.match(await newcomer.locator('#writing-draft').inputValue(), /try to/);
      assert(await newcomer.locator('#decision-result').getByRole('button', { name: 'Check this version' }).evaluate(element => element === document.activeElement));
      if (width === 1440) {
        await (await ready(newcomer, '#dismiss-memory')).click();
        assert.equal(await newcomer.locator('#decision-result [data-remember-candidate]').count(), 0);
        await (await ready(newcomer, '#writing-undo')).click(); await newcomer.locator('#flow-next-action').click();
        await newcomer.locator('#back-translate').click(); await newcomer.locator('[data-mismatch]').first().click();
        await newcomer.locator('#repair-writing').click(); await newcomer.locator('.suggestion-card').getByRole('button', { name: 'Use this expression' }).click();
      }
      if (width === 390) await newcomer.screenshot({ path: path.join(root, 'preview/newcomer-mobile-repair.png'), animations: 'disabled' });
      await newcomer.locator('#decision-result').getByRole('button', { name: 'Review a habit', exact: false }).click();
      await newcomer.locator('#habit-content').fill('Keep uncertainty when a plan is tentative.');
      assert.match(await newcomer.locator('#habit-scope-preview').textContent(), /Friend/);
      assert(await newcomer.locator('#habit-form button[type="submit"]').evaluate(element => { const r = element.getBoundingClientRect(), d = element.closest('dialog').getBoundingClientRect(); return r.top >= d.top && r.bottom <= d.bottom; }));
      if (width === 390) await newcomer.screenshot({ path: path.join(root, 'preview/newcomer-mobile-habit.png'), animations: 'disabled' });
      await newcomer.locator('#habit-form button[type="submit"]').click(); await newcomer.locator('#finish-habit-review').click();
      assert(await newcomer.locator('#writing-draft').evaluate(element => element === document.activeElement));
      assert(await newcomer.locator('#suggestions-panel').isVisible(), 'Returning to writing preserves the inline review');
      assert.equal(await newcomer.locator('#suggestions-panel').evaluate(el => getComputedStyle(el).position), 'static');
      await newcomer.locator('#flow-next-action').click(); assert.match(await newcomer.locator('#back-translate').textContent(), /updated draft/);
      await newcomer.locator('#back-translate').click(); await newcomer.locator('#mark-check-reviewed').click();
      assert(await newcomer.locator('#copy-checked-draft').isVisible());
      await newcomer.evaluate(() => { navigator.clipboard.writeText = async text => { window.fixtureCopiedDraft = text; }; });
      await newcomer.locator('#copy-checked-draft').click(); await until(newcomer, '#toast', 'Copied');
      assert.match(await newcomer.evaluate(() => window.fixtureCopiedDraft), /try to/);
      assert(await newcomer.locator('#toast').evaluate(element => {
        const rect = element.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= innerHeight && element.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
      }), 'Copy feedback is visible above the inline document');
      assert.equal(await newcomer.locator('#correction-note').inputValue(), '');
      await newcomer.locator('#return-to-writing').click();
      assert.match(await newcomer.locator('#flow-next-action').textContent(), /Copy my draft/);
      await newcomer.locator('#flow-next-action').click();
      assert.equal(await newcomer.evaluate(() => window.fixtureCopiedDraft), await newcomer.locator('#writing-draft').inputValue());
      await newcomer.locator('#writing-live-mode').click(); await newcomer.locator('#flow-next-action').click();
      assert.match(await newcomer.locator('#snapshot-status').textContent(), /Earlier check/);
      assert(await newcomer.locator('#repair-writing').isDisabled());
      await newcomer.reload(); await newcomer.waitForLoadState('networkidle');
      assert.equal(await newcomer.locator('#writing-draft').inputValue(), '');
      await (await ready(newcomer, '#open-habits')).click(); assert.match(await newcomer.locator('.habit-card').textContent(), /Keep uncertainty/);
      await newcomer.close();
    }
    // Optional interpretations can be deferred through the main flow, before or after review.
    const skip = await browser.newPage({ viewport: { width: 390, height: 844 } });
    skip.on('pageerror', error => errors.push(error.message));
    await skip.goto(url); await skip.waitForLoadState('networkidle');
    await skip.locator('#writing-demo-mode').click();
    await (await ready(skip, '#flow-intention')).click(); await skip.locator('#extract-intents').click();
    assert.match(await skip.locator('#back-from-intentions').textContent(), /without unconfirmed/);
    await skip.locator('#back-from-intentions').click();
    assert.match(await skip.locator('#flow-next-action').textContent(), /Get suggestions/);
    assert.match(await skip.locator('#request-input-summary').textContent(), /0 confirmed intention/);
    await skip.locator('#flow-next-action').click(); assert(await skip.locator('.suggestion-card').isVisible());
    await (await ready(skip, '#flow-intention')).click(); await skip.locator('#extract-intents').click();
    await skip.locator('#back-from-intentions').click();
    assert.match(await skip.locator('#flow-next-action').textContent(), /Check this draft/);
    assert.match(await skip.locator('#intent-count').textContent(), /0 confirmed/);
    await skip.locator('#flow-next-action').click(); assert(await skip.locator('#back-translate').isVisible());
    await skip.close();
    // Storage denied should not break initialization or explicit memory-only save.
    const restricted = await browser.newPage(); const restrictedErrors = [];
    restricted.on('pageerror', error => restrictedErrors.push(error.message));
    await restricted.addInitScript(() => { Storage.prototype.getItem = () => { throw new Error('storage denied'); }; Storage.prototype.setItem = () => { throw new Error('storage denied'); }; });
    await restricted.goto(url); await restricted.waitForLoadState('networkidle');
    assert.equal(await restricted.locator('#writing-draft').inputValue(), '');
    await (await ready(restricted, '#open-habits')).click(); await restricted.locator('#habit-content').fill('Visit-only habit');
    await restricted.locator('#habit-form button[type="submit"]').click();
    assert.match(await restricted.locator('.habit-card').textContent(), /Visit-only habit/);
    assert.match(await restricted.locator('#habits-status').textContent(), /only for this visit/);
    assert.match(await restricted.locator('#finish-habit-review').textContent(), /Kept for this visit/);
    assert.deepEqual(restrictedErrors, []); await restricted.close();
    assert.deepEqual(errors, []);
    console.log('PASS: authored end-to-end intention/check/repair/memory; scoped live inputs; per-session exclusions; user-edited provenance; undo; source-blind backtranslation; stale snapshots; note extraction; protection; reload/key privacy; translator; desktop/mobile; denied storage.');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
