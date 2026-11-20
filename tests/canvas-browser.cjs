const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const server=http.createServer((req,res)=>{
  const file=(req.url==='/'?'index.html':req.url.slice(1)).split('?')[0];
  if (!/^[\w.-]+\.(html|css|js|svg)$/.test(file)) return res.writeHead(404).end();
  try {
    res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'})[path.extname(file)]);
    res.end(fs.readFileSync(path.join(root,file)));
  } catch {res.writeHead(404).end();}
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[], requests=[], hosted=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/ai',async route=>{
      const body=route.request().postDataJSON();hosted.push(body);
      assert.equal(route.request().headers().authorization,undefined);
      const result=body.action==='revise'?{replacement:'friendly'}:{translation:'A warm hello.',alternatives:{casual:'Hey!',direct:'Hello.',formal:'Greetings.'},nuance:'Warm phrasing.'};
      await route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]})});
    });
    await page.route('https://openrouter.ai/api/v1/chat/completions',async route=>{
      requests.push(route.request().postDataJSON());
      await route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content:JSON.stringify({
        translation:'A warm hello.', alternatives:{casual:'Hey!',direct:'Hello.',formal:'Greetings.'},nuance:'Warm phrasing.'
      })}}]})});
    });
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    assert.equal(await page.locator('#writing-tools').count(),0);
    await page.getByRole('tab',{name:'Style Memory',exact:true}).click();
    await page.locator('#habits-open').click();
    await page.locator('#habit-category').selectOption('slang');
    await page.getByRole('button',{name:'emmm',exact:true}).click();
    assert.match(await page.locator('#habit-input').inputValue(),/emmm/);
    await page.getByRole('button',{name:'cool',exact:true}).click();
    assert.match(await page.locator('#habit-input').inputValue(),/emmm[\s\S]*cool/);
    await page.locator('#habit-form button[type=submit]').click();
    await page.reload();
    await page.getByRole('tab',{name:'Style Memory',exact:true}).click();
    assert.match(await page.locator('#habit-list').innerText(),/emmm/);
    await page.getByRole('tab',{name:'Translate',exact:true}).click();
    await page.getByRole('button',{name:'Instagram',exact:true}).click();
    await page.getByRole('button',{name:'Emoji / Meme',exact:true}).click();
    await page.locator('#translation-source').fill('Hello');
    await page.locator('#translation-submit').click();
    await page.locator('#translation-result').waitFor({state:'visible'});
    assert.equal(await page.locator('#connection').isVisible(),false);
    assert.equal(hosted.length,1);assert.equal(hosted[0].action,'translate');
    assert.equal(hosted[0].input.channel,'Instagram');assert.match(hosted[0].input.preferences[0],/emmm/);
    await page.locator('#translation-output').evaluate(node=>{node.focus();node.setSelectionRange(2,6);node.dispatchEvent(new Event('pointerup'));});
    await page.locator('#output-goal').fill('Make this friendlier.');await page.locator('#suggest-output').click();
    await page.waitForFunction(()=>document.getElementById('output-replacement').value==='friendly');
    assert.equal(hosted[1].action,'revise');await page.locator('#apply-output').click();
    assert.equal(await page.locator('#translation-output').inputValue(),'A friendly hello.');
    assert.equal(await page.locator('#connection').isVisible(),false);
    await page.locator('#connect').click();
    await page.locator('#canvas-key').fill('test-fixture-key');
    await page.locator('#connection-form button[type=submit]').click();
    await page.locator('#translation-source').fill('Hello');
    await page.locator('#translation-submit').click();
    await page.locator('#translation-result').waitFor({state:'visible'});
    const sent=JSON.parse(requests[0].messages[1].content);
    assert.equal(sent.channel,'Instagram'); assert.equal(sent.tone,'Emoji / Meme');
    assert.match(sent.preferences[0],/emmm/);
    for (const width of [1440,390,320]) {
      await page.setViewportSize({width,height:1000});
      assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'overflow at '+width);
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: preference starters, persistence, new channel/tone payloads, removed canvas, responsive widths.');
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
