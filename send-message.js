const { chromium } = require('playwright');

(async () => {
    console.log('💬 메시지 전송 시작...\n');

    const browser = await chromium.connect('http://localhost:9222');  // 이미 열린 브라우저에 연결 시도

    // 연결 실패하면 새로 열기
    const context = await browser.newContext();
    const pages = context.pages();

    let page;
    if (pages.length > 0) {
        page = pages[0];
    } else {
        page = await context.newPage();
        await page.goto('http://localhost:3001/room.html?discussion_id=9');
        await page.waitForTimeout(2000);
    }

    try {
        // 메시지 입력
        const message = '안녕하세요! 찌게입니다. 저는 이 주제에 찬성하는 입장입니다. 왜냐하면 기술 발전이 사회 전반에 긍정적인 영향을 미치기 때문입니다. 🚀';

        console.log('✍️  메시지 입력:', message);
        await page.fill('#messageInput', message);
        await page.waitForTimeout(500);

        console.log('📤 전송 버튼 클릭...');
        await page.click('#sendButton');
        await page.waitForTimeout(1000);

        console.log('✅ 메시지 전송 완료!');

    } catch (error) {
        console.error('❌ 오류:', error.message);
    }
})();
