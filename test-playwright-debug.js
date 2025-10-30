const { chromium } = require('playwright');

(async () => {
    console.log('🎭 Playwright 디버그 모드 시작...\n');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 1000
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // 메인 페이지 접속
        console.log('📍 localhost:3001 접속 중...');
        await page.goto('http://localhost:3001');
        await page.waitForTimeout(2000);

        // 메인 페이지 스크린샷
        console.log('📸 메인 페이지 스크린샷...');
        await page.screenshot({ path: 'temp_screenshots/playwright-mainpage.png', fullPage: true });

        // 직접 토론방 URL로 접속
        console.log('🚪 토론방 9번으로 직접 접속...');
        await page.goto('http://localhost:3001/room.html?discussion_id=9');
        await page.waitForTimeout(3000);

        // 토론방 페이지 스크린샷
        console.log('📸 토론방 페이지 스크린샷...');
        await page.screenshot({ path: 'temp_screenshots/playwright-roompage.png', fullPage: true });

        // 입장 모달 확인
        console.log('🔍 입장 모달 확인 중...');

        // 이름 입력 필드 찾기
        const nameInputs = await page.locator('input').all();
        console.log(`   찾은 input 요소: ${nameInputs.length}개`);

        // 첫 번째 input에 이름 입력
        if (nameInputs.length > 0) {
            console.log('✍️ 이름 입력: Claude AI');
            await nameInputs[0].fill('Claude AI');
            await page.waitForTimeout(1000);
        }

        // 팀명 입력 (있다면)
        if (nameInputs.length > 1) {
            console.log('👥 팀명 입력: AI Team');
            await nameInputs[1].fill('AI Team');
            await page.waitForTimeout(1000);
        }

        // 역할 버튼 찾기
        const buttons = await page.locator('button').all();
        console.log(`   찾은 button 요소: ${buttons.length}개`);

        // 찬성 버튼 클릭
        console.log('🎯 찬성 역할 선택...');
        await page.click('text=찬성');
        await page.waitForTimeout(1000);

        // 입장 버튼 클릭
        console.log('🚪 입장하기 버튼 클릭...');
        await page.click('button:has-text("입장하기")');
        await page.waitForTimeout(3000);

        // 입장 후 스크린샷
        console.log('📸 입장 후 스크린샷...');
        await page.screenshot({ path: 'temp_screenshots/playwright-joined-debug.png', fullPage: true });

        // 메시지 입력 및 전송
        console.log('💬 메시지 전송...');
        await page.fill('#messageInput', '안녕하세요! Claude AI입니다. 아바타 이미지 테스트 중입니다! 🤖✨');
        await page.waitForTimeout(1000);

        await page.click('#sendButton');
        await page.waitForTimeout(2000);

        // 메시지 전송 후 스크린샷
        console.log('📸 메시지 전송 후 스크린샷...');
        await page.screenshot({ path: 'temp_screenshots/playwright-message-sent-debug.png', fullPage: true });

        console.log('\n✅ 테스트 완료!');
        console.log('📂 스크린샷:');
        console.log('   1. temp_screenshots/playwright-mainpage.png');
        console.log('   2. temp_screenshots/playwright-roompage.png');
        console.log('   3. temp_screenshots/playwright-joined-debug.png');
        console.log('   4. temp_screenshots/playwright-message-sent-debug.png');

        // 20초 대기 (확인 시간)
        console.log('\n⏳ 20초 대기 중... 브라우저에서 확인하세요!');
        await page.waitForTimeout(20000);

    } catch (error) {
        console.error('❌ 오류:', error.message);
        await page.screenshot({ path: 'temp_screenshots/playwright-error-debug.png', fullPage: true });
    } finally {
        await browser.close();
        console.log('👋 브라우저 종료');
    }
})();
