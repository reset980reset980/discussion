const { chromium } = require('playwright');

(async () => {
    console.log('🎭 Playwright로 토론방 접속 시작...\n');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 500 // 동작을 천천히 해서 확인 가능하게
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // 메인 페이지 접속
        console.log('📍 localhost:3001 접속 중...');
        await page.goto('http://localhost:3001');
        await page.waitForTimeout(1000);

        // 토론방 9번 클릭
        console.log('🚪 토론방 9번 입장 시도...');
        await page.click('a[href*="discussion_id=9"]');
        await page.waitForTimeout(2000);

        // 입장 모달이 나타나면 정보 입력
        console.log('✍️ 사용자 정보 입력 중...');

        // 이름 입력
        const nameInput = await page.locator('input[placeholder*="이름"]').first();
        await nameInput.fill('Claude AI');
        await page.waitForTimeout(500);

        // 역할 선택 (찬성)
        await page.click('text=찬성');
        await page.waitForTimeout(500);

        // 입장 버튼 클릭
        console.log('🎯 토론방 입장...');
        await page.click('button:has-text("입장하기")');
        await page.waitForTimeout(2000);

        // 스크린샷 촬영
        console.log('📸 입장 후 스크린샷 촬영...');
        await page.screenshot({ path: 'temp_screenshots/playwright-joined.png', fullPage: true });

        // 메시지 입력 및 전송
        console.log('💬 메시지 전송 중...');
        const messageInput = await page.locator('#messageInput');
        await messageInput.fill('안녕하세요! Claude AI입니다. 테스트 메시지를 보냅니다. 🤖');
        await page.waitForTimeout(500);

        await page.click('#sendButton');
        await page.waitForTimeout(2000);

        // 메시지 전송 후 스크린샷
        console.log('📸 메시지 전송 후 스크린샷 촬영...');
        await page.screenshot({ path: 'temp_screenshots/playwright-message-sent.png', fullPage: true });

        console.log('\n✅ 테스트 완료!');
        console.log('📂 스크린샷 저장 위치:');
        console.log('   - temp_screenshots/playwright-joined.png');
        console.log('   - temp_screenshots/playwright-message-sent.png');

        // 10초 대기 후 종료 (사용자가 확인할 시간)
        console.log('\n⏳ 10초 후 브라우저 종료...');
        await page.waitForTimeout(10000);

    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
        await page.screenshot({ path: 'temp_screenshots/playwright-error.png' });
    } finally {
        await browser.close();
        console.log('👋 브라우저 종료');
    }
})();
