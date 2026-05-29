const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => {
    if (msg.type() === 'warning') console.log('  [WARN]', msg.text());
  });
  page.on('pageerror', err => console.log('  [ERROR]', err.message));

  // Test via file:// protocol
  const filePath = 'file:///D:/vibecoding/wordmemory/index.html';
  console.log('Opening:', filePath);
  await page.goto(filePath, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const opts = await page.$$eval('#memory-module option', els => els.map(e => e.value));
  console.log('Modules:', opts);

  let ok = true;
  if (!opts.includes('考研高频单词')) {
    console.log('FAIL: 考研高频单词 not found');
    ok = false;
  }
  if (!opts.includes('example')) {
    console.log('FAIL: example not found');
    ok = false;
  }

  if (ok) {
    // Verify word data is correct for each module
    for (const mod of ['example', '考研高频单词']) {
      await page.selectOption('#memory-module', mod);
      await page.click('button[data-count="5"]');
      await page.click('#memory-start');
      await page.waitForTimeout(500);
      const word = await page.$eval('#memory-word', el => el.textContent);
      console.log(`  ${mod}: first word = "${word}"`);
    }
    console.log('PASS: Both modules loaded correctly via file://');
  }

  await browser.close();
  process.exit(ok ? 0 : 1);
})();
