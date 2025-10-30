async function testFlowAPI() {
    try {
        console.log('🧪 흐름 분석 API 테스트 시작...\n');

        // 테스트 메시지 데이터
        const messages = [
            { author: '김치', role: '볶음', message: '안녕' },
            { author: '김치', role: '볶음', message: '찌게 안녕' },
            { author: '찌게', role: '볶음', message: '안녕하세요! 찌게입니다.' },
            { author: '찌게', role: '볶음', message: '기술 발전이 가져오는 효율성 증대는 장점입니다.' },
            { author: '김치', role: '볶음', message: '김치 볶음이 더 다양한 사람들의 입맛에 맞출 수 있습니다.' },
            { author: '찌게', role: '볶음', message: '생김치의 건강상 이점이 있습니다.' },
            { author: '찌게', role: '볶음', message: '생김치의 아삭한 식감과 시원한 맛이 좋습니다.' },
            { author: '김치', role: '볶음', message: '프로바이오틱스는 찌개도 손실될 수 있습니다.' },
            { author: '찌게', role: '볶음', message: '김치 찌개가 김치 볶음보다 우월합니다!' },
            { author: '찌게', role: '볶음', message: '김치 찌개는 완벽한 한 끼 식사입니다.' },
            { author: '찌게', role: '볶음', message: '영양학적으로 균형잡힌 식사를 제공합니다.' },
            { author: '찌게', role: '볶음', message: '국물 요리의 중요성은 강조해도 지나치지 않습니다.' }
        ];

        console.log(`📝 테스트 메시지: ${messages.length}개\n`);

        const response = await fetch('http://localhost:3001/api/analyze-flow', {
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
        console.log('  - timeline:', result.timeline ? `${result.timeline.length}개` : '없음');
        console.log('  - participant_stats:', result.participant_stats ? `${result.participant_stats.length}명` : '없음');
        console.log('  - interaction_stats:', result.interaction_stats ? `${result.interaction_stats.length}명` : '없음');
        console.log('  - trend_data:', result.trend_data ? 'OK' : '없음');

        console.log('\n📄 전체 결과:');
        console.log(JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('❌ 테스트 오류:', error.message);
    }
}

testFlowAPI();
