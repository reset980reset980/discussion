const io = require('socket.io-client');

const socket = io('http://localhost:3001');

socket.on('connect', () => {
    console.log('💬 찌개의 제대로 된 주장 전송 중...\n');

    socket.emit('join-room', {
        discussionId: 9,
        userName: '찌게',
        userRole: '찬성',
        teamName: 'AI팀'
    });

    setTimeout(() => {
        // 첫 번째 메시지 - 사과 및 입장 정정
        socket.emit('send-message', {
            discussionId: 9,
            message: '앗, 제가 주제를 잘못 이해했네요! 😅 다시 말씀드리겠습니다. 저는 김치 찌개가 김치 볶음보다 우월하다고 생각합니다!',
            userName: '찌게',
            userRole: '찬성'
        });
        console.log('✅ 첫 번째 메시지 전송');

        setTimeout(() => {
            // 두 번째 메시지 - 김치 찌개의 장점 1
            socket.emit('send-message', {
                discussionId: 9,
                message: '김치 찌개는 김치의 깊은 맛이 국물에 우러나와 밥과 함께 먹기에 완벽한 한 끼 식사입니다. 🍲 특히 추운 겨울날, 뜨끈한 김치 찌개 한 그릇이면 온몸이 따뜻해지죠!',
                userName: '찌게',
                userRole: '찬성'
            });
            console.log('✅ 두 번째 메시지 전송');

            setTimeout(() => {
                // 세 번째 메시지 - 김치 찌개의 장점 2
                socket.emit('send-message', {
                    discussionId: 9,
                    message: '또한 김치 찌개는 돼지고기, 두부, 파 등 다양한 재료가 함께 어우러져 영양학적으로도 균형잡힌 식사를 제공합니다. 김치 볶음은 반찬일 뿐이지만, 김치 찌개는 그 자체로 메인 요리입니다! 💪',
                    userName: '찌게',
                    userRole: '찬성'
                });
                console.log('✅ 세 번째 메시지 전송');

                setTimeout(() => {
                    // 네 번째 메시지 - 김치 볶음에 대한 반박
                    socket.emit('send-message', {
                        discussionId: 9,
                        message: '김치님께서 말씀하신 김치 볶음의 조화도 좋지만, 김치 찌개는 국물이 있어 밥 한 공기를 뚝딱 비울 수 있게 해줍니다. 한국인의 밥상에서 국물 요리의 중요성은 아무리 강조해도 지나치지 않죠! 🍚',
                        userName: '찌게',
                        userRole: '찬성'
                    });
                    console.log('✅ 네 번째 메시지 전송');

                    setTimeout(() => {
                        console.log('👋 모든 주장 전송 완료!');
                        socket.disconnect();
                        process.exit(0);
                    }, 1000);
                }, 3000);
            }, 3000);
        }, 3000);
    }, 1000);
});

socket.on('error', (err) => {
    console.error('❌ 오류:', err);
    process.exit(1);
});
