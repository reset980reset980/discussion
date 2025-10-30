const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500 // Slow down for visibility
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  // Directory for screenshots
  const screenshotsDir = path.join(__dirname, 'test-screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
  }

  console.log('=== Starting Opinion Submission Test ===\n');

  // Listen to console messages
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE - ${msg.type()}]:`, msg.text());
  });

  // Listen to page errors
  page.on('pageerror', error => {
    console.log('[PAGE ERROR]:', error.message);
  });

  // Listen to network requests/responses
  page.on('response', response => {
    if (response.url().includes('/api/')) {
      console.log(`[API RESPONSE]: ${response.status()} ${response.url()}`);
    }
  });

  try {
    // Step 1: Navigate to the page
    console.log('Step 1: Navigating to http://localhost:3001');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(screenshotsDir, '01-homepage.png'), fullPage: true });
    console.log('✓ Page loaded\n');

    // Step 2: Wait for page to load and find discussion cards
    console.log('Step 2: Waiting for discussion cards to load');
    await page.waitForSelector('.discussion-card', { timeout: 10000 });

    const cardCount = await page.locator('.discussion-card').count();
    console.log(`✓ Found ${cardCount} discussion cards\n`);

    // Step 3: Find and click on a discussion card
    console.log('Step 3: Looking for "착한 사마리아인의 법 제정" discussion');

    // Try to find the specific discussion, otherwise click the first one
    let discussionCard = page.locator('.discussion-card').filter({ hasText: '착한 사마리아인의 법 제정' }).first();
    let discussionExists = await discussionCard.count() > 0;

    if (!discussionExists) {
      console.log('  Specific discussion not found, clicking first available card');
      discussionCard = page.locator('.discussion-card').first();
    }

    await page.screenshot({ path: path.join(screenshotsDir, '02-before-click.png'), fullPage: true });

    await discussionCard.click();
    console.log('✓ Clicked on discussion card\n');

    // Step 4: Wait for modal to open
    console.log('Step 4: Waiting for discussion detail modal');
    await page.waitForSelector('#discussionDetailModal.modal.active', { timeout: 10000 });
    await page.waitForTimeout(1000); // Wait for animations
    await page.screenshot({ path: path.join(screenshotsDir, '03-modal-opened.png'), fullPage: true });
    console.log('✓ Modal opened\n');

    // Check if the opinion form is visible
    const formVisible = await page.locator('#opinionForm').isVisible();
    console.log(`Opinion form visible: ${formVisible}\n`);

    // Step 5: Fill in the opinion form
    console.log('Step 5: Filling in opinion form');

    // Fill author name
    await page.fill('#opinionAuthor', '테스트사용자');
    console.log('  ✓ Filled author name');

    // Select opinion type (pros/찬성)
    await page.selectOption('#opinionType', 'pros');
    console.log('  ✓ Selected opinion type: pros (찬성)');

    // Fill opinion content
    await page.fill('#opinionContent', '이것은 테스트 의견입니다');
    console.log('  ✓ Filled opinion content');

    await page.screenshot({ path: path.join(screenshotsDir, '04-form-filled.png'), fullPage: true });
    console.log('✓ Form filled completely\n');

    // Step 6: Click submit button
    console.log('Step 6: Clicking submit button');
    const submitButton = page.locator('#opinionForm button[type="submit"]');

    // Wait a moment to see the filled form
    await page.waitForTimeout(1000);

    await submitButton.click();
    console.log('✓ Submit button clicked\n');

    // Step 7: Wait for response and check for toast/messages
    console.log('Step 7: Waiting for response...');
    await page.waitForTimeout(3000); // Wait for processing

    // Check for toast messages
    const toastExists = await page.locator('.toast, .alert, .notification, [role="alert"]').count() > 0;
    if (toastExists) {
      const toastText = await page.locator('.toast, .alert, .notification, [role="alert"]').first().textContent();
      console.log(`Toast message found: "${toastText}"`);
    } else {
      console.log('No toast message found');
    }

    await page.screenshot({ path: path.join(screenshotsDir, '05-after-submit.png'), fullPage: true });

    // Check if form was cleared (success indicator)
    const authorValue = await page.inputValue('#opinionAuthor');
    const contentValue = await page.inputValue('#opinionContent');
    console.log(`\nForm state after submission:`);
    console.log(`  Author field: "${authorValue}" ${authorValue === '' ? '(CLEARED)' : '(NOT CLEARED)'}`);
    console.log(`  Content field: "${contentValue}" ${contentValue === '' ? '(CLEARED)' : '(NOT CLEARED)'}`);

    // Check the opinions list to see if new opinion was added
    console.log('\nChecking if opinion appears in the list...');
    await page.waitForTimeout(1000);

    const opinionsList = page.locator('.opinion-item');
    const opinionsCount = await opinionsList.count();
    console.log(`Total opinions in list: ${opinionsCount}`);

    // Look for our test opinion
    const testOpinionExists = await page.locator('.opinion-item').filter({ hasText: '테스트사용자' }).count() > 0;
    if (testOpinionExists) {
      console.log('✓ Test opinion found in the list!');
      const testOpinion = page.locator('.opinion-item').filter({ hasText: '테스트사용자' }).first();
      const opinionText = await testOpinion.textContent();
      console.log(`Opinion content: ${opinionText.substring(0, 100)}...`);
    } else {
      console.log('✗ Test opinion NOT found in the list');
    }

    await page.screenshot({ path: path.join(screenshotsDir, '06-final-state.png'), fullPage: true });

    // Wait a bit more to see if anything else happens
    await page.waitForTimeout(2000);

    console.log('\n=== Test Summary ===');
    console.log(`Screenshots saved to: ${screenshotsDir}`);
    console.log(`Form was ${authorValue === '' && contentValue === '' ? 'CLEARED' : 'NOT CLEARED'} after submission`);
    console.log(`Test opinion ${testOpinionExists ? 'APPEARED' : 'DID NOT APPEAR'} in the list`);
    console.log(`Toast message: ${toastExists ? 'SHOWN' : 'NOT SHOWN'}`);

  } catch (error) {
    console.error('\n❌ Test Error:', error.message);
    await page.screenshot({ path: path.join(screenshotsDir, 'error.png'), fullPage: true });
  } finally {
    console.log('\nClosing browser in 5 seconds...');
    await page.waitForTimeout(5000);
    await browser.close();
  }
})();
