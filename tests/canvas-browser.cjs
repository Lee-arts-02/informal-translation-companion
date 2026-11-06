const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const allowed = fs.readdirSync(root).filter(name => /\.(html|css|js|svg)$/.test(name));
const server = http.createServer((req, res) => {
  const file = req.url === '/' ? 'index.html' : req.url.slice(1).split('?')[0];
  if (!allowed.includes(file)) return res.writeHead(404).end();
  res.setHeader('Content-Type', ({ '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml' })[path.extname(file)]);
  res.end(fs.readFileSync(path.join(root, file)));
});
async function select(page, start, end) {
  if (!await page.locator('#draft').isVisible()) await page.locator('#write-mode').click();
  await page.locator('#draft').evaluate((node, range) => {
    node.focus(); node.setSelectionRange(...range); node.dispatchEvent(new Event('pointerup'));
  }, [start, end]);
  await page.locator('#intent-popover').waitFor({ state:'visible' });
}
async function note(page, goal) {
  await page.locator('#intent-input').fill(goal);
  await page.locator('#intent-form button[type=submit]').click();
  await page.locator('#preview').click();
  await page.locator('#review-actions').waitFor({state:'visible'});
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless:true, ...(process.platform === 'win32' ? { executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe' } : {}) });
  try {
    const page = await browser.newPage({ viewport:{width:1440,height:1000} });
    const errors = [], sent = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://openrouter.ai/api/v1/chat/completions', async route => {
      const body = route.request().postDataJSON(); sent.push(body);
      await route.fulfill({ contentType:'application/json', body:JSON.stringify({choices:[{message:{content:JSON.stringify({replacement:'I hope to send you the draft on Friday.',reason:'This expresses an intention rather than a firm promise.'})}}]}) });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/canvas.html`);
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    await page.locator('#example').click();
    const original = await page.locator('#draft').inputValue();
    await select(page, 5, 9);
    fs.mkdirSync(path.join(root,'temp'), { recursive:true });
    await page.screenshot({path:path.join(root,'temp/canvas-popover.png')});
    await page.locator('[data-goal=softer]').click();
    await page.locator('#intent-form button[type=submit]').click();
    await page.locator('#preview').click();
    assert.equal(sent.length, 0);
    assert(await page.locator('#document-view ins.supporting').count() > 0);
    assert.equal(await page.locator('#draft').inputValue(), original);
    await page.screenshot({path:path.join(root,'temp/canvas-preview.png'),fullPage:true});
    await page.locator('#accept').click();
    assert(await page.locator('#document-view ins').first().isVisible());
    assert.equal(await page.locator('#draft').inputValue(),original.replace("I'll send","I'll try to send"));
    await page.locator('#show-changes').click();
    assert.equal(await page.locator('#document-view ins').count(),0);
    await page.locator('#show-changes').click();
    assert(await page.locator('#document-view ins').count() > 0);
    await page.locator('#remember').click();
    assert.equal(await page.locator('#habit-list li').count(),1);
    await page.locator('#habit-input').fill('Keep uncertainty when describing plans.');
    await page.locator('#habit-form button').click();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('nuancebridge.canvas.habits'))[0]),'Keep uncertainty when describing plans.');
    await page.locator('#undo').click(); assert.equal(await page.locator('#draft').inputValue(),original);
    await page.locator('#connect').click();
    await page.locator('#canvas-key').fill('test-session-key');
    await page.locator('#connection-form button[type=submit]').click();
    await select(page,5,9); await note(page,'Make the commitment softer.');
    assert.equal(sent.length,1);
    assert.match(JSON.parse(sent[0].messages[1].content).habits[0],/uncertainty/);
    assert(await page.locator('#document-view del').count() > 0);
    await page.locator('#manual-edit summary').click();
    await page.locator('#replacement').fill('I may send you the draft on Friday.');
    assert.match(await page.locator('#reason').innerText(), /adjusted by you/);
    await page.locator('#accept').click();
    assert(await page.locator('#document-view del').count() > 0);
    assert((await page.locator('#draft').inputValue()).includes("Friday. If I'm delayed"));
    await page.locator('#connect').click(); await page.locator('#disconnect').click();
    assert.equal(await page.locator('#source-label').innerText(),'Live AI preview');
    await page.locator('#ui-language').selectOption('zh');
    assert.equal(await page.locator('h1').innerText(),'让表达更像你。');
    await page.locator('#ui-language').selectOption('en');
    const stored = await page.evaluate(()=>JSON.stringify({...localStorage}));
    assert(!stored.includes('test-session-key') && !stored.includes("I'll send") && !stored.includes('I hope to send'));
    for(const width of [390,320]) {
      await page.setViewportSize({width,height:1000});
      assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth), `overflow at ${width}`);
      await page.screenshot({path:path.join(root,`temp/canvas-mobile-${width}.png`),fullPage:true});
    }
    await page.locator('#edit-draft').click();
    await page.locator('#pen-mode').click();
    const spans=page.locator('#document-view span');
    const a=await spans.nth(10).boundingBox(), b=await spans.nth(7).boundingBox();
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
    await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await page.mouse.up();
    await page.locator('#intent-popover').waitFor({state:'visible'});
    const box=await page.locator('#intent-popover').boundingBox();
    assert(box.x>=0 && box.x+box.width<=320);
    await page.keyboard.press('Escape');
    assert(!await page.locator('#intent-popover').isVisible());
    // Multiple native selections remain underlined; each passage accumulates requirements.
    await page.reload(); await page.locator('#example').click();
    await select(page,5,9);
    await page.locator('[data-goal=softer]').click();
    await page.locator('#intent-form button[type=submit]').click();
    async function markReadView(word, requirement = null) {
      await page.locator('#document-view').evaluate((view, word) => {
        const text=view.textContent, start=text.indexOf(word), end=start+word.length;
        const first=[...view.children].find(x=>+x.dataset.start===start);
        const last=[...view.children].find(x=>+x.dataset.end===end);
        const range=document.createRange();range.setStart(first.firstChild,0);range.setEnd(last.firstChild,last.firstChild.length);
        const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
        view.dispatchEvent(new Event('pointerup'));
      },word);
      await page.locator('#intent-popover').waitFor({state:'visible'});
      if (requirement === null) { await page.locator('#close-popover').click(); return; }
      await page.locator('#intent-input').fill(requirement);
      await page.locator('#intent-form button[type=submit]').click();
    }
    await markReadView('Friday'); await markReadView('delayed');
    assert.equal(await page.locator('.saved-note').count(),3);
    await markReadView('Friday','Keep Friday as the date.');
    await markReadView('send','Keep it conversational.');
    await markReadView('delayed','Preserve the uncertainty.');
    assert.equal(await page.locator('.saved-note').count(),3);
    assert.equal(await page.locator('.saved-note').first().locator('.note-goals li').count(),2);
    assert(await page.locator('#document-view .focus-mark').count()>10);
    await page.route('https://openrouter.ai/api/v1/key',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({data:{label:'Test'}})}));
    await page.locator('#connect').click();await page.locator('#canvas-key').fill('test-session-key');
    await page.locator('#check-connection').click();
    await page.locator('#connection-status').filter({hasText:'Key verified'}).waitFor();
    await page.locator('#connection-form button[type=submit]').click();
    await page.locator('.note-select').first().click();await page.locator('#preview').click();
    await page.locator('#review-actions').waitFor({state:'visible'});
    const multiPayload=JSON.parse(sent.at(-1).messages[1].content);
    assert.equal(multiPayload.notes.length,2);
    assert.deepEqual(multiPayload.notes[0].goals,['Soften the commitment without losing what I mean.','Keep it conversational.']);
    assert((await page.locator('#document-view [data-notes="3"]').allTextContents()).join('').includes('delayed'));
    await page.locator('#accept').click();assert.equal(await page.locator('.saved-note').count(),3);
    await page.locator('#undo').click();assert.equal(await page.locator('.saved-note').count(),3);
    await page.locator('#write-mode').click();await page.locator('#draft').fill('Hello. '+original);
    assert.equal(await page.locator('.saved-note').count(),3);
    assert.equal(await page.locator('.saved-note').first().locator('.note-goals li').count(),2);
    for (const width of [390,320]) {
      await page.setViewportSize({width,height:1000});
      assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
      await page.screenshot({path:path.join(root,`temp/canvas-multi-${width}.png`),fullPage:true});
    }
    await page.locator('#draft').fill(('Hello. '+original).replace('delayed',''));
    await page.locator('.note-select').nth(2).click();
    assert.match(await page.locator('.saved-note').nth(2).innerText(), /Text removed/);
    await markReadView('advance','');
    assert.equal(await page.locator('.saved-note').count(),3);
    assert.match(await page.locator('.saved-note').nth(2).innerText(), /advance/);
    assert.match(await page.locator('.saved-note').nth(2).innerText(), /Preserve the uncertainty/);
    await page.locator('#pen-mode').click();
    for (const word of ['draft','know']) {
      await page.locator('#document-view').scrollIntoViewIfNeeded();
      const boxes=await page.locator('#document-view').evaluate((view, word)=>{
        const start=view.textContent.indexOf(word), end=start+word.length;
        const first=[...view.children].find(x=>+x.dataset.start===start).getBoundingClientRect();
        const last=[...view.children].find(x=>+x.dataset.end===end).getBoundingClientRect();
        return {a:{x:first.x+first.width/2,y:first.y+first.height/2},b:{x:last.x+last.width/2,y:last.y+last.height/2}};
      },word);
      await page.mouse.move(boxes.a.x,boxes.a.y);await page.mouse.down();await page.mouse.move(boxes.b.x,boxes.b.y,{steps:10});await page.mouse.up();
      await page.locator('#intent-popover').waitFor({state:'visible'});
      await page.locator('#intent-input').fill('Preserve this detail.');await page.locator('#intent-form button[type=submit]').click();
    }
    assert.equal(await page.locator('.saved-note').count(),5);
    assert.deepEqual(errors,[]);
    console.log('PASS: cumulative native selections and requirements, combined sentence API input, all notes survive adoption/undo/manual editing, connection check, tracked changes, habits, privacy, English/Chinese and mobile.');
  } finally { await browser.close(); server.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
