const { chromium } = require('playwright');

(async () => {
    console.log('🎭 플레이라이트 브라우저 실행...\n');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 0
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // localhost:3001로 이동
    await page.goto('http://localhost:3001');

    console.log('✅ 브라우저 준비 완료!');
    console.log('📍 http://localhost:3001');
    console.log('\n사용자님이 직접 조작하세요. 종료하려면 Ctrl+C를 누르세요.\n');

    // 계속 대기 (사용자가 종료할 때까지)
    await new Promise(() => {});
})();
