const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page = await browser.newPage();

  console.log('=== Testing Form Value Capture Issue ===\n');

  // Capture all events
  page.on('console', msg => console.log(`[CONSOLE ${msg.type()}]:`, msg.text()));

  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await page.waitForSelector('.discussion-card');

  // Click first discussion
  await page.locator('.discussion-card').first().click();
  await page.waitForSelector('#discussionDetailModal.modal.active');
  await page.waitForTimeout(1000);

  console.log('\n--- Filling form fields ---');

  // Fill form
  await page.fill('#opinionAuthor', '테스트사용자');
  console.log('Filled author');

  await page.selectOption('#opinionType', 'pros');
  console.log('Selected type');

  await page.fill('#opinionContent', '이것은 테스트 의견입니다');
  console.log('Filled content');

  // Check values BEFORE submit
  console.log('\n--- Values BEFORE submit ---');
  const beforeAuthor = await page.inputValue('#opinionAuthor');
  const beforeType = await page.inputValue('#opinionType');
  const beforeContent = await page.inputValue('#opinionContent');

  console.log(`Author: "${beforeAuthor}"`);
  console.log(`Type: "${beforeType}"`);
  console.log(`Content: "${beforeContent}"`);

  // Inject code to log what happens during submit
  await page.evaluate(() => {
    // Intercept submit event at capture phase (runs FIRST)
    const form = document.getElementById('opinionForm');
    form.addEventListener('submit', (e) => {
      console.log('🔥 SUBMIT EVENT FIRED (capture phase - FIRST)');
      console.log('  Author value:', document.getElementById('opinionAuthor').value);
      console.log('  Type value:', document.getElementById('opinionType').value);
      console.log('  Content value:', document.getElementById('opinionContent').value);
    }, true);

    // Also log at bubble phase (runs AFTER normal listeners)
    form.addEventListener('submit', (e) => {
      console.log('🔥 SUBMIT EVENT FIRED (bubble phase - LAST)');
      console.log('  Author value:', document.getElementById('opinionAuthor').value);
      console.log('  Type value:', document.getElementById('opinionType').value);
      console.log('  Content value:', document.getElementById('opinionContent').value);
    }, false);
  });

  console.log('\n--- Clicking submit button ---');
  await page.click('#opinionForm button[type="submit"]');

  await page.waitForTimeout(3000);

  // Check values AFTER submit
  console.log('\n--- Values AFTER submit ---');
  const afterAuthor = await page.inputValue('#opinionAuthor');
  const afterType = await page.inputValue('#opinionType');
  const afterContent = await page.inputValue('#opinionContent');

  console.log(`Author: "${afterAuthor}"`);
  console.log(`Type: "${afterType}"`);
  console.log(`Content: "${afterContent}"`);

  await page.waitForTimeout(5000);
  await browser.close();
})();
