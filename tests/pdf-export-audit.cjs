const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({headless:true});
 try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173/index.html');
  await page.click('[data-tab="6"]');
  await page.waitForSelector('[data-panel="6"].active');
  await page.click('[data-start]');
  await page.waitForSelector('[data-mock] .answer');
  await page.evaluate(() => {
   window.__pdfHtml = '';
   window.__pdfOpenCalls = 0;
   Object.defineProperty(window, 'open', { configurable: true, value: () => {
    window.__pdfOpenCalls++;
    return { document: {
     open() {},
     write(html) { window.__pdfHtml = html; },
     close() {}
    }};
   }});
  });
  for (const [label, heading, shouldContain] of [
   ['問題のみPDF', '<h1>問題</h1>', '問題'],
   ['解答・解説PDF', '<h1>解答・解説</h1>', '正解：'],
   ['問題＋解答PDF', '<section class="answers"><h1>解答・解説</h1>', '解答・解説']
  ]) {
   await page.evaluate(() => { window.__pdfHtml = ''; window.__pdfOpenCalls = 0; });
   await page.getByRole('button',{name:label}).click();
   await page.waitForFunction(() => window.__pdfOpenCalls > 0, null, { timeout: 5000 });
   const html = await page.evaluate(() => window.__pdfHtml);
   assert.ok(html.includes('<!doctype html>'), label+' HTML document');
   assert.ok(html.includes(heading), label+' expected section');
   assert.ok(html.includes(shouldContain), label+' expected content');
   if (label==='問題のみPDF') assert.doesNotMatch(html,/正解：|解答・解説/);
   if (label==='解答・解説PDF') assert.match(html,/正解：/);
   if (label==='問題＋解答PDF') assert.match(html,/解答・解説/);
  }
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const copyText = async (label) => {
   await page.getByRole('button', { name: label }).click();
   await page.waitForFunction(() => (document.querySelector('[data-copy-status]')?.textContent || '').includes('コピーしました'));
   return page.evaluate(() => navigator.clipboard.readText());
  };
  const questionCopy = await copyText('問題のみテキスト');
  assert.match(questionCopy, /問題/);
  assert.doesNotMatch(questionCopy, /正解：|解答・解説/);
  const answerCopy = await copyText('解答・解説テキスト');
  assert.match(answerCopy, /正解：/);
  assert.match(answerCopy, /解説：/);
  const combinedCopy = await copyText('問題＋解答テキスト');
  assert.match(combinedCopy, /問題/);
  assert.match(combinedCopy, /解答・解説/);
  assert.match(combinedCopy, /正解：/);
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
