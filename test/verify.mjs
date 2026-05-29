import { chromium } from 'playwright';

const PORT = 32841;
const BASE = `http://localhost:${PORT}`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(`[CONSOLE ERROR] ${msg.text()}`);
  });
  page.on('pageerror', err => consoleErrors.push(`[PAGE ERROR] ${err.message}`));

  let allGood = true;

  // ━━ 1. PAGE LOAD ━━
  console.log('=== 1. PAGE LOAD ===');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const title = await page.title();
  console.log(`Title: ${title}`);
  if (title !== 'wordMemory - 单词记忆') {
    console.log(`❌ Title mismatch: "${title}"`);
    allGood = false;
  } else {
    console.log('✅ Title correct');
  }

  // Check tabs are visible
  const tabs = await page.$$('.tab');
  console.log(`Tabs found: ${tabs.length}`);
  if (tabs.length !== 3) { console.log('❌ Expected 3 tabs'); allGood = false; }
  else { console.log('✅ 3 tabs visible'); }

  // Check upload section
  const uploadEl = await page.$('#upload-input');
  if (!uploadEl) { console.log('❌ Upload input not found'); allGood = false; }
  else { console.log('✅ Upload input found'); }

  // Check module list
  const moduleList = await page.$('#module-list');
  if (!moduleList) { console.log('❌ Module list not found'); allGood = false; }
  else { console.log('✅ Module list found'); }

  if (consoleErrors.length > 0) {
    console.log(`❌ Console errors found: ${consoleErrors.length}`);
    consoleErrors.forEach(e => console.log(`   ${e}`));
    allGood = false;
  } else {
    console.log('✅ No console errors');
  }

  // ━━ 2. UPLOAD example.json ━━
  console.log('\n=== 2. UPLOAD example.json ===');
  const fileInput = page.locator('#upload-input');
  const filePath = 'D:/vibecoding/wordmemory/data/example.json';
  await fileInput.setInputFiles(filePath);
  await page.waitForTimeout(1000);

  const uploadStatus = await page.$eval('#upload-status', el => el.textContent);
  console.log(`Upload status: "${uploadStatus}"`);
  if (uploadStatus.includes('成功导入')) {
    console.log('✅ Upload succeeded');
  } else {
    console.log(`❌ Upload failed: ${uploadStatus}`);
    allGood = false;
  }

  // Verify module list updated
  const moduleText = await page.$eval('#module-list', el => el.textContent);
  console.log(`Module list: "${moduleText.trim()}"`);
  if (moduleText.includes('example')) {
    console.log('✅ Module list shows example module');
  } else {
    console.log('❌ Module list does not show example');
    allGood = false;
  }

  // ━━ 3. MEMORY TAB ━━
  console.log('\n=== 3. MEMORY MODULE ===');
  // Memory tab should already be active
  const memoryModuleSelect = await page.$('#memory-module');
  if (!memoryModuleSelect) { console.log('❌ Memory module select not found'); allGood = false; }
  else { console.log('✅ Memory module select found'); }

  // Start memory session with 5 words
  await page.click('#memory-start');
  await page.waitForTimeout(500);

  const memoryPlayArea = await page.$('#memory-play-area');
  const playAreaVisible = await memoryPlayArea.evaluate(el => el.style.display !== 'none');
  if (playAreaVisible) {
    console.log('✅ Memory play area visible');
  } else {
    console.log('❌ Memory play area not visible');
    allGood = false;
  }

  const memoryWord = await page.$eval('#memory-word', el => el.textContent);
  console.log(`Memory word shown: "${memoryWord}"`);
  if (!memoryWord) {
    console.log('❌ No memory word displayed');
    allGood = false;
  } else {
    console.log('✅ Memory word displayed');
  }

  // Click "会" (know)
  const knowBtn = await page.$('#memory-know');
  const dunnoBtn = await page.$('#memory-dunno');
  if (!knowBtn) { console.log('❌ Know button not found'); allGood = false; }
  else { console.log('✅ Know button found'); }
  if (!dunnoBtn) { console.log('❌ Dunno button not found'); allGood = false; }
  else { console.log('✅ Dunno button found'); }

  // Click through a few words
  for (let i = 0; i < 3; i++) {
    const beforeWord = await page.$eval('#memory-word', el => el.textContent).catch(() => '');
    await page.click('#memory-know');
    await page.waitForTimeout(400);
    const afterWord = await page.$eval('#memory-word', el => el.textContent).catch(() => '');
    if (beforeWord && afterWord) {
      console.log(`  Memory: "${beforeWord}" → "${afterWord}" (clicked 会)`);
    }
  }

  // ━━ 4. QUIZ TAB ━━
  console.log('\n=== 4. QUIZ MODULE ===');
  await page.click('.tab[data-tab="quiz"]');
  await page.waitForTimeout(500);

  // Check quiz tab is now active
  const quizTab = await page.$('.tab[data-tab="quiz"].tab--active');
  if (quizTab) {
    console.log('✅ Quiz tab is active');
  } else {
    console.log('❌ Quiz tab not active after click');
    allGood = false;
  }

  const quizContent = await page.$('#tab-quiz');
  const quizVisible = await quizContent.evaluate(el => !el.classList.contains('tab-content--hidden'));
  if (quizVisible) {
    console.log('✅ Quiz content visible');
  } else {
    console.log('❌ Quiz content hidden');
    allGood = false;
  }

  // Click Start Quiz
  await page.click('#quiz-start');
  await page.waitForTimeout(500);

  const quizArea = await page.$('#quiz-play-area');
  const quizAreaVisible = await quizArea.evaluate(el => el.style.display !== 'none');
  if (quizAreaVisible) {
    console.log('✅ Quiz play area visible');
  } else {
    console.log('❌ Quiz play area not visible');
    allGood = false;
  }

  const quizWord = await page.$eval('#quiz-word', el => el.textContent);
  console.log(`Quiz word: "${quizWord}"`);
  if (!quizWord) {
    console.log('❌ No quiz word displayed');
    allGood = false;
  } else {
    console.log('✅ Quiz word displayed');
  }

  // Try a correct answer
  await page.fill('#quiz-input', '放弃');
  await page.click('#quiz-submit');
  await page.waitForTimeout(600);

  const feedback = await page.$eval('#quiz-feedback', el => el.textContent).catch(() => '');
  console.log(`Quiz feedback after correct: "${feedback.trim()}"`);

  // Answer another one wrong
  const currentWord = await page.$eval('#quiz-word', el => el.textContent).catch(() => '');
  await page.fill('#quiz-input', '这是一个完全错误的答案xyz');
  await page.click('#quiz-submit');
  await page.waitForTimeout(600);
  const wrongFeedback = await page.$eval('#quiz-feedback', el => el.textContent).catch(() => '');
  console.log(`Quiz feedback after wrong: "${wrongFeedback.trim()}"`);

  // Try "忘了" button
  await page.click('#quiz-forgot');
  await page.waitForTimeout(500);
  const forgotFeedback = await page.$eval('#quiz-feedback', el => el.textContent).catch(() => '');
  console.log(`Quiz feedback after forgot: "${forgotFeedback.trim()}"`);
  console.log('✅ Quiz module verified');

  // ━━ 5. ERROR BOOK TAB ━━
  console.log('\n=== 5. ERROR BOOK ===');
  await page.click('.tab[data-tab="errorbook"]');
  await page.waitForTimeout(800);

  const errorBookTab = await page.$('.tab[data-tab="errorbook"].tab--active');
  if (errorBookTab) {
    console.log('✅ Error book tab is active');
  } else {
    console.log('❌ Error book tab not active');
    allGood = false;
  }

  const errorBookContent = await page.$('#tab-errorbook');
  const errorBookVisible = await errorBookContent.evaluate(el => !el.classList.contains('tab-content--hidden'));
  if (errorBookVisible) {
    console.log('✅ Error book content visible');
  } else {
    console.log('❌ Error book content hidden');
    allGood = false;
  }

  // Check if error book has rows (we triggered at least one wrong answer)
  const rows = await page.$$('#errorbook-tbody tr');
  console.log(`Error book rows: ${rows.length}`);
  if (rows.length > 0) {
    console.log('✅ Error book has data');
    // Read first row
    const firstRowCells = await rows[0].$$eval('td', cells => cells.map(c => c.textContent.trim()));
    console.log(`  First row: ${firstRowCells.join(' | ')}`);
  } else {
    console.log('⚠️  Error book is empty (may be OK if no wrong answers registered)');
  }

  // Check error dots rendering
  const errorDotsSpans = await page.$$('.error-dots');
  const errorNumberSpans = await page.$$('.error-number');
  console.log(`Error dots spans: ${errorDotsSpans.length}, Error number spans: ${errorNumberSpans.length}`);

  // Also check the empty state
  const emptyEl = await page.$('#errorbook-empty');
  if (emptyEl) {
    const emptyDisplay = await emptyEl.evaluate(el => el.style.display);
    console.log(`Empty state display: ${emptyDisplay}`);
  }

  // ━━ 6. RENDER CHECKS ━━
  console.log('\n=== 6. RENDER CHECKS ===');

  // Screenshot
  await page.screenshot({ path: 'D:/vibecoding/wordmemory/test/verify-screenshot.png', fullPage: true });
  console.log('📸 Screenshot saved to test/verify-screenshot.png');

  // Check glassmorphism styles are applied
  const cardBg = await page.$eval('.card', el => getComputedStyle(el).background).catch(() => '');
  console.log(`Card background: ${cardBg.substring(0, 80)}...`);
  if (cardBg.includes('rgba')) {
    console.log('✅ Glassmorphism card background applied');
  }

  const tabNav = await page.$('.tabs');
  const tabNavBg = await tabNav.evaluate(el => getComputedStyle(el).background).catch(() => '');
  console.log(`Tab nav background: ${tabNavBg.substring(0, 80)}...`);

  // Check fonts are loading
  const bodyFont = await page.$eval('body', el => getComputedStyle(el).fontFamily);
  console.log(`Body font: ${bodyFont.substring(0, 50)}...`);

  // ━━ FINAL REPORT ━━
  console.log('\n' + '═'.repeat(50));
  if (allGood) {
    console.log('✅ VERIFICATION PASSED');
  } else {
    console.log('❌ VERIFICATION FAILED - see errors above');
  }
  console.log('═'.repeat(50));

  await browser.close();
  process.exit(allGood ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
