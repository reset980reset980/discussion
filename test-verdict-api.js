async function testVerdictAPI() {
    try {
        console.log('⚖️ AI 판결문 API 테스트 시작...\n');

        // 테스트 메시지 데이터
        const messages = [
            { author: '김치', role: '볶음', message: '안녕하세요. 김치 볶음을 지지합니다.' },
            { author: '찌게', role: '찌개', message: '안녕하세요! 저는 김치 찌개를 지지합니다.' },
            { author: '김치', role: '볶음', message: '김치 볶음은 밥반찬으로 최고입니다.' },
            { author: '찌게', role: '찌개', message: '김치 찌개는 완벽한 한 끼 식사입니다.' },
            { author: '김치', role: '볶음', message: '김치 볶음이 더 다양한 사람들의 입맛에 맞습니다.' },
            { author: '찌게', role: '찌개', message: '김치 찌개가 영양학적으로 균형잡힌 식사를 제공합니다.' },
            { author: '김치', role: '볶음', message: '김치 볶음은 조리가 간편합니다.' },
            { author: '찌게', role: '찌개', message: '김치 찌개는 국물이 있어 밥과 궁합이 좋습니다.' },
            { author: '김치', role: '볶음', message: '김치 볶음은 고기와 함께 먹기 좋습니다.' },
            { author: '찌게', role: '찌개', message: '김치 찌개는 추운 겨울날 몸을 따뜻하게 합니다.' },
            { author: '김치', role: '볶음', message: '김치 볶음은 다양한 재료와 조합할 수 있습니다.' },
            { author: '찌게', role: '찌개', message: '김치 찌개는 한국인의 소울푸드입니다.' }
        ];

        console.log(`📝 테스트 메시지: ${messages.length}개\n`);

        const response = await fetch('http://localhost:3001/api/generate-verdict', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                discussion_id: 9,
                messages: messages
            })
        });

        console.log(`📡 응답 상태: ${response.status}\n`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API 오류:', errorText);
            return;
        }

        const result = await response.json();
        console.log('✅ API 응답 성공!\n');
        console.log('📊 결과 구조:');
        console.log('  - introduction:', result.introduction ? '있음' : '없음');
        console.log('  - body:', result.body ? `${result.body.length}개 섹션` : '없음');
        console.log('  - conclusion:', result.conclusion ? '있음' : '없음');

        console.log('\n📄 전체 결과:');
        console.log(JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('❌ 테스트 오류:', error.message);
    }
}

testVerdictAPI();
