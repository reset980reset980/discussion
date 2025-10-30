const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: false, slowMo: 500 });
    const page = await browser.newPage();

    // 콘솔 로그 캡처
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        if (type === 'log') console.log('📝 LOG:', text);
        else if (type === 'error') console.error('❌ ERROR:', text);
        else if (type === 'warning') console.warn('⚠️  WARNING:', text);
    });

    try {
        console.log('\n🎬 테스트 시작: 의견 제출 기능 검증\n');

        // 1. 페이지 접속
        console.log('1️⃣ http://localhost:3001 접속...');
        await page.goto('http://localhost:3001');
        await page.waitForLoadState('networkidle');

        // 2. 토론방 생성 (이미 있을 수 있음)
        console.log('\n2️⃣ 테스트용 토론방 생성 시도...');
        try {
            await page.click('#createDiscussionBtn');
            await page.waitForSelector('#newDiscussionModal', { state: 'visible', timeout: 3000 });

            await page.fill('#discussionTitle', '의견 제출 테스트 토론방');
            await page.fill('#discussionDescription', '이 토론방은 의견 제출 기능을 테스트하기 위한 것입니다.');

            await page.click('#newDiscussionModal button[type="submit"]');
            await page.waitForTimeout(1000);
            console.log('   ✅ 새 토론방 생성 완료');
        } catch (e) {
            console.log('   ℹ️  토론방 생성 건너뜀 (기존 토론방 사용)');
        }

        // 3. 첫 번째 토론방 클릭
        console.log('\n3️⃣ 토론방 상세 페이지 열기...');
        await page.waitForSelector('.discussion-card', { timeout: 5000 });
        const discussionCards = await page.$$('.discussion-card');

        if (discussionCards.length === 0) {
            throw new Error('토론방이 없습니다. 먼저 토론방을 생성해주세요.');
        }

        await discussionCards[0].click();
        await page.waitForSelector('#discussionDetailModal', { state: 'visible', timeout: 5000 });
        console.log('   ✅ 토론방 상세 모달 열림');

        // 4. 의견 추가 버튼 클릭
        console.log('\n4️⃣ 의견 추가 버튼 클릭...');
        await page.click('text=💬 의견 추가');
        await page.waitForSelector('#opinionModal', { state: 'visible', timeout: 5000 });
        console.log('   ✅ 의견 추가 모달 열림');

        // 5. 제출 전 현재 의견 개수 확인
        console.log('\n5️⃣ 제출 전 의견 개수 확인...');
        const beforeSubmit = await page.evaluate(() => {
            const prosCount = document.querySelectorAll('#prosOpinions .opinion-item').length;
            const consCount = document.querySelectorAll('#consOpinions .opinion-item').length;
            return { prosCount, consCount, total: prosCount + consCount };
        });
        console.log(`   📊 현재 찬성: ${beforeSubmit.prosCount}, 반대: ${beforeSubmit.consCount}, 총: ${beforeSubmit.total}`);

        // 6. 의견 작성 (찬성 의견)
        console.log('\n6️⃣ 의견 작성 중...');
        const timestamp = new Date().toLocaleTimeString('ko-KR');
        const testAuthor = `테스트사용자_${timestamp}`;
        const testContent = `이것은 수정된 코드 테스트입니다. (${timestamp})`;

        await page.selectOption('#opinionType', 'pros');
        await page.fill('#opinionAuthor', testAuthor);
        await page.fill('#opinionContent', testContent);

        console.log(`   ✏️  작성자: ${testAuthor}`);
        console.log(`   ✏️  의견 유형: 찬성`);
        console.log(`   ✏️  내용: ${testContent}`);

        // 7. 제출하기 전 값 확인
        const valuesBeforeSubmit = await page.evaluate(() => {
            return {
                author: document.getElementById('opinionAuthor').value,
                type: document.getElementById('opinionType').value,
                content: document.getElementById('opinionContent').value
            };
        });
        console.log('\n7️⃣ 제출 직전 폼 값 확인:');
        console.log('   📝 작성자:', valuesBeforeSubmit.author);
        console.log('   📝 유형:', valuesBeforeSubmit.type);
        console.log('   📝 내용:', valuesBeforeSubmit.content);

        // 8. 제출
        console.log('\n8️⃣ 의견 제출 중...');
        await page.click('#opinionForm button[type="submit"]');

        // 잠시 대기 (서버 처리 시간)
        await page.waitForTimeout(2000);

        // 9. 모달이 닫혔는지 확인
        const modalClosed = await page.isHidden('#opinionModal');
        console.log(`   ${modalClosed ? '✅' : '❌'} 의견 추가 모달 닫힘: ${modalClosed}`);

        // 10. 제출 후 의견 개수 확인
        console.log('\n🔟 제출 후 의견 개수 확인...');
        await page.waitForTimeout(1000); // DOM 업데이트 대기

        const afterSubmit = await page.evaluate(() => {
            const prosCount = document.querySelectorAll('#prosOpinions .opinion-item').length;
            const consCount = document.querySelectorAll('#consOpinions .opinion-item').length;
            return { prosCount, consCount, total: prosCount + consCount };
        });
        console.log(`   📊 제출 후 찬성: ${afterSubmit.prosCount}, 반대: ${afterSubmit.consCount}, 총: ${afterSubmit.total}`);

        // 11. 의견 개수 증가 확인
        const increased = afterSubmit.total > beforeSubmit.total;
        console.log(`\n   ${increased ? '✅' : '❌'} 의견 개수 증가: ${beforeSubmit.total} → ${afterSubmit.total}`);

        // 12. 방금 추가한 의견이 화면에 표시되는지 확인
        const opinionVisible = await page.evaluate((author, content) => {
            const opinions = Array.from(document.querySelectorAll('.opinion-item'));
            return opinions.some(op => {
                const authorEl = op.querySelector('.opinion-author');
                const contentEl = op.querySelector('.opinion-text');
                return authorEl && contentEl &&
                       authorEl.textContent.includes(author) &&
                       contentEl.textContent.includes(content);
            });
        }, testAuthor, testContent);

        console.log(`   ${opinionVisible ? '✅' : '❌'} 화면에 의견 표시됨: ${opinionVisible}`);

        // 13. 데이터베이스 확인
        console.log('\n1️⃣3️⃣ 데이터베이스에 저장되었는지 확인...');
        const dbCheck = await fetch('http://localhost:3001/api/discussions')
            .then(r => r.json())
            .then(async discussions => {
                if (discussions.length > 0) {
                    const firstDiscussion = discussions[0];
                    const opinions = await fetch(`http://localhost:3001/api/discussions/${firstDiscussion.id}/opinions`)
                        .then(r => r.json());

                    const savedOpinion = opinions.find(op =>
                        op.author === testAuthor && op.content === testContent
                    );

                    return {
                        totalOpinions: opinions.length,
                        found: !!savedOpinion,
                        opinion: savedOpinion
                    };
                }
                return { totalOpinions: 0, found: false };
            });

        console.log(`   📊 데이터베이스 총 의견 수: ${dbCheck.totalOpinions}`);
        console.log(`   ${dbCheck.found ? '✅' : '❌'} 방금 제출한 의견 DB 저장 확인: ${dbCheck.found}`);

        if (dbCheck.found) {
            console.log(`   📝 저장된 의견 ID: ${dbCheck.opinion.id}`);
            console.log(`   📝 작성자: ${dbCheck.opinion.author}`);
            console.log(`   📝 내용: ${dbCheck.opinion.content}`);
        }

        // 최종 결과
        console.log('\n' + '='.repeat(60));
        console.log('📋 최종 테스트 결과 요약');
        console.log('='.repeat(60));
        console.log(`모달 닫힘: ${modalClosed ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`의견 개수 증가: ${increased ? '✅ PASS' : '❌ FAIL'} (${beforeSubmit.total} → ${afterSubmit.total})`);
        console.log(`화면 표시: ${opinionVisible ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`DB 저장: ${dbCheck.found ? '✅ PASS' : '❌ FAIL'}`);

        const allPassed = modalClosed && increased && opinionVisible && dbCheck.found;
        console.log('\n' + '='.repeat(60));
        console.log(allPassed ? '🎉 모든 테스트 통과!' : '❌ 일부 테스트 실패');
        console.log('='.repeat(60) + '\n');

        // 잠시 대기 후 종료
        await page.waitForTimeout(3000);

    } catch (error) {
        console.error('\n💥 테스트 중 오류 발생:', error.message);
        console.error(error.stack);
    } finally {
        await browser.close();
        console.log('\n🏁 테스트 종료\n');
    }
})();
