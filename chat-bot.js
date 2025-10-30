const io = require('socket.io-client');

const socket = io('http://localhost:3001');

console.log('🤖 찌게(AI) 채팅 봇 시작...\n');

socket.on('connect', () => {
    console.log('✅ 서버 연결 성공!');
    console.log(`🔌 소켓 ID: ${socket.id}\n`);

    // 토론방 9번에 입장
    console.log('🚪 토론방 9번 입장 중...');
    socket.emit('join-room', {
        discussionId: 9,
        userName: '찌게',
        userRole: '찬성',
        teamName: 'AI팀'
    });
});

socket.on('participants-update', (participants) => {
    console.log(`\n👥 참여자 목록 업데이트 (총 ${participants.length}명):`);
    participants.forEach(p => {
        console.log(`   - ${p.user_name} [${p.user_role}]`);
        console.log(`     아바타: ${p.avatar_image_url}`);
        console.log(`     색상: ${p.avatar_color}\n`);
    });
});

socket.on('load-messages', (messages) => {
    console.log(`\n📜 기존 메시지 로드 (${messages.length}개):`);
    messages.forEach(m => {
        if (m.message_type === 'system') {
            console.log(`   [시스템] ${m.message}`);
        } else {
            console.log(`   [${m.user_name}] ${m.message}`);
        }
    });
});

socket.on('new-message', (data) => {
    if (data.message_type === 'system') {
        console.log(`\n💬 [시스템] ${data.message}`);
    } else {
        console.log(`\n💬 [${data.author}] ${data.message}`);
        console.log(`   아바타: ${data.avatar_image_url}`);
        console.log(`   색상: ${data.avatar_color}`);
    }
});

// 3초 후 메시지 전송
setTimeout(() => {
    console.log('\n📤 메시지 전송 중...');
    socket.emit('send-message', {
        discussionId: 9,
        message: '안녕하세요! 찌게입니다. 저는 찬성 입장에서 말씀드리겠습니다. 이 주제는 사회적으로 매우 중요하며, 긍정적인 변화를 가져올 수 있다고 생각합니다. 🚀',
        userName: '찌게',
        userRole: '찬성'
    });
    console.log('✅ 메시지 전송 완료!');
}, 3000);

// 10초 후 두 번째 메시지
setTimeout(() => {
    console.log('\n📤 추가 메시지 전송 중...');
    socket.emit('send-message', {
        discussionId: 9,
        message: '특히 기술 발전이 가져오는 효율성 증대와 새로운 기회 창출은 부인할 수 없는 장점입니다. 김치님의 의견은 어떠신가요?',
        userName: '찌게',
        userRole: '찬성'
    });
    console.log('✅ 추가 메시지 전송 완료!');
}, 10000);

// Ctrl+C로 종료
console.log('\n종료하려면 Ctrl+C를 누르세요...\n');

process.on('SIGINT', () => {
    console.log('\n\n👋 찌게(AI) 채팅 봇 종료...');
    socket.disconnect();
    process.exit(0);
});
