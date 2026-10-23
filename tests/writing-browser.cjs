// Optional integration checks. Install Playwright and Chromium separately.
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const files = ['index.html', 'app.js', 'styles.css', 'writing.css', 'translation.js', 'preferences.js', 'demo.js', 'writing-session.js', 'review-api.js', 'writing-ui.js', 'writing-demo.js', 'favicon.svg'];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((request, response) => {
  const file = request.url === '/' ? 'index.html' : request.url.slice(1).split('?')[0];
  if (!files.includes(file)) { response.writeHead(404).end(); return; }
  response.setHeader('Content-Type', mime[path.extname(file)]);
  response.end(fs.readFileSync(path.join(__dirname, '..', file)));
});

(async () => {
  let browser;
  if (!process.env.TEST_URL) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', issue => errors.push(issue.message));
    const sent = [];
    await page.goto(process.env.TEST_URL || `http://127.0.0.1:${server.address().port}`);
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('.suggestion-card').count(), 2);
    assert.match(await page.locator('#protected-phrases').textContent(), /辛苦了/);
    await page.locator('.suggestion-card').first().getByRole('button', { name: 'Accept / apply my edit' }).click();
    assert.match(await page.locator('#writing-draft').inputValue(), /Thanks so much/);
    assert.equal(await page.locator('.suggestion-card').count(), 1);
    await page.locator('.suggestion-card').first().getByRole('button', { name: 'Accept / apply my edit' }).click();
    assert.match(await page.locator('#writing-draft').inputValue(), /I’ll treat you/);
    await page.locator('#writing-undo').click();
    assert.match(await page.locator('#writing-draft').inputValue(), /下次请你吃饭/);
    await page.locator('#show-original').click();
    assert.match(await page.locator('#original-text').textContent(), /Thanks for your assistance/);
    const current = await page.locator('#writing-draft').inputValue();
    await page.locator('#writing-draft').fill('Replace the entire draft');
    assert.equal(await page.locator('#writing-draft').inputValue(), current);
    assert.match(await page.locator('#writing-error').textContent(), /protected/);
    await page.locator('#analyze-writing').click();
    await page.locator('#explanation-language').selectOption('Chinese (Simplified)');
    await page.locator('#analyze-writing').click();
    assert.match(await page.locator('.suggestion-card').first().textContent(), /请吃饭/);
    await page.locator('.suggestion-card').first().locator('select').selectOption('Changes my meaning');
    await page.locator('.suggestion-card').first().getByRole('button', { name: 'Reject', exact: true }).click();
    await page.locator('#analyze-writing').click();
    assert.equal(await page.locator('.suggestion-card').count(), 0);
    assert.match(await page.locator('#session-feedback').textContent(), /Changes my meaning/);
    await page.locator('#check-meaning').click();
    assert.match(await page.locator('#reflection-result').textContent(), /演示说明/);
    await page.locator('#back-translate').click();
    assert.match(await page.locator('#reflection-result').textContent(), /辛苦了/);

    await page.locator('#writing-live-mode').click();
    await page.locator('#analyze-writing').click();
    await page.locator('#api-key').fill('writing-test-key');
    await page.locator('#settings-form button[type="submit"]').click();
    await page.route('https://openrouter.ai/**', async route => {
      const body = route.request().postDataJSON(), data = JSON.parse(body.messages[1].content);
      sent.push(data);
      let result;
      if (data.action === 'reflect') result = { meaning: 'The offer is preserved.', reader: 'This may feel warm.', questions: ['Does this still sound like you?'] };
      else if (data.action === 'back') result = { text: '谢谢你，辛苦了！' };
      else if (data.action === 'start') result = { draft: data.text };
      else result = { summary: 'One focused option', suggestions: [{ start: 0, original: 'Thanks so much', replacement: 'Thank you so much', reason: 'A small adjustment', tradeoff: 'A little more deliberate', reader: 'May feel warm' }] };
      await route.fulfill({ json: { choices: [{ message: { content: JSON.stringify(result) } }] } });
    });
    await page.locator('#analyze-writing').click();
    await page.waitForFunction(() => document.querySelector('.suggestion-card')?.textContent.includes('small adjustment'));
    assert.equal(sent.at(-1).explanationLanguage, 'Chinese (Simplified)');
    assert(sent.at(-1).feedback.some(item => item.reason === 'Changes my meaning'));
    assert.equal(await page.locator('#writing-draft').inputValue(), current);
    const replacement = page.locator('.suggestion-replacement').first();
    await replacement.fill('Thanks a lot');
    await page.locator('.suggestion-card').first().getByRole('button', { name: 'Accept / apply my edit' }).click();
    assert.match(await page.locator('#writing-draft').inputValue(), /^Thanks a lot/);
    await page.locator('#check-meaning').click();
    await page.waitForFunction(() => document.getElementById('reflection-result').textContent.includes('offer is preserved'));
    await page.locator('#starting-draft').click();
    await page.locator('#starting-preview').waitFor({ state: 'visible' });
    await page.locator('#accept-starting').click();
    assert.match(await page.locator('#writing-draft').inputValue(), /辛苦了/);
    await page.locator('#peer-review').click();
    await page.locator('#peer-notes').fill('My friend says this sounds like me.');
    await page.locator('#save-peer').click();
    assert.match(await page.locator('#session-feedback').textContent(), /My friend/);
    await page.locator('#writing-style').click();
    await page.locator('#voice-sample').fill('Hey, thanks—really appreciate it!');
    await page.locator('#save-voice').click();
    await page.keyboard.press('Escape');
    const saved = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    assert(saved.includes('really appreciate')); assert(!saved.includes('writing-test-key')); assert(!saved.includes('My friend says'));

    // Selection-only review is enforced at the model response boundary.
    await page.locator('#writing-scope').selectOption('selection');
    await page.locator('#writing-draft').evaluate(element => { element.focus(); element.setSelectionRange(0, 6); element.dispatchEvent(new Event('select')); });
    await page.locator('#analyze-writing').click();
    await page.locator('#writing-error').waitFor({ state: 'visible' });
    assert.match(await page.locator('#writing-error').textContent(), /select|match/i);
    await page.locator('#writing-scope').selectOption('light');
    await page.locator('#translation-tool > summary').click();
    assert.equal(await page.locator('#target option').count(), 28);
    await page.locator('[data-demo="spanish"]').click();
    assert.match(await page.locator('#translation').textContent(), /resolve this very quickly/);
    await page.locator('#translation-tool > summary').click();
    await page.reload();
    await page.waitForLoadState('networkidle');
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow at ${width}`);
    }
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.screenshot({ path: 'preview/writing-desktop.png', fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'preview/writing-mobile.png', fullPage: true, animations: 'disabled' });
    await page.reload();
    await page.locator('#writing-live-mode').click();
    await page.locator('#analyze-writing').click();
    assert(await page.locator('#settings').isVisible());
    assert.equal(await page.locator('#api-key').inputValue(), '');
    assert.equal(await page.locator('#session-feedback').textContent(), '');
    assert.deepEqual(errors, []);
    console.log('PASS: selective review, protection, repeated accept, undo, bilingual explanations, rejection feedback, live API contract, reflection, preview, peer notes, saved voice, key lifecycle, translator regression, mobile.');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(issue => { console.error(issue); process.exitCode = 1; });
