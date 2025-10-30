const io = require('socket.io-client');

const socket = io('http://localhost:3001');

socket.on('connect', () => {
    console.log('💬 찌게의 답변 전송 중...\n');

    // 토론방 9번에 입장 (이미 입장했지만 재연결)
    socket.emit('join-room', {
        discussionId: 9,
        userName: '찌게',
        userRole: '찬성',
        teamName: 'AI팀'
    });

    // 1초 후 메시지 전송
    setTimeout(() => {
        socket.emit('send-message', {
            discussionId: 9,
            message: '김치님 좋은 의견 감사합니다! 하지만 저는 생김치의 입장에서 말씀드리자면, 김치 자체가 가진 발효식품으로서의 건강상 이점과 프로바이오틱스 효과는 볶음 과정에서 일부 손실될 수 있습니다. 🥬',
            userName: '찌게',
            userRole: '찬성'
        });
        console.log('✅ 첫 번째 답변 전송 완료!');

        // 3초 후 추가 메시지
        setTimeout(() => {
            socket.emit('send-message', {
                discussionId: 9,
                message: '물론 김치볶음의 장점도 인정합니다만, 생김치의 아삭한 식감과 시원한 맛은 한국 음식 문화에서 대체 불가능한 가치를 지니고 있다고 생각합니다. 특히 여름철 입맛 없을 때의 생김치만 한 게 없죠! 😊',
                userName: '찌게',
                userRole: '찬성'
            });
            console.log('✅ 두 번째 답변 전송 완료!');

            // 메시지 전송 후 종료
            setTimeout(() => {
                console.log('👋 답변 전송 완료, 연결 종료');
                socket.disconnect();
                process.exit(0);
            }, 1000);
        }, 3000);
    }, 1000);
});

socket.on('error', (err) => {
    console.error('❌ 오류:', err);
    process.exit(1);
});
