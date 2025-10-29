/**
 * 토론방 클라이언트 JavaScript
 * 채팅 + 오른쪽 사이드바 구조
 */

// ==========================================
// 전역 변수
// ==========================================
let socket = null;
let currentDiscussionId = null;
let currentUser = {
    name: null,
    role: null
};

// 토론방 정보 저장 변수
let discussionInfo = null;

// ==========================================
// 초기화
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // URL에서 토론방 ID 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    currentDiscussionId = urlParams.get('id');

    if (!currentDiscussionId) {
        alert('토론방 ID가 없습니다');
        window.location.href = '/';
        return;
    }

    // 토론방 정보를 먼저 로드
    await loadDiscussionInfoForJoin();

    // 초기화 (입장 후에 호출됨)
    initializeEventListeners();
});

// ==========================================
// 사이드바 제어
// ==========================================
function openSidebar(panelName, title) {
    const sidebar = document.getElementById('sidebar');
    const sidebarTitle = document.getElementById('sidebarTitle');
    const panels = document.querySelectorAll('.sidebar-panel');
    const buttons = document.querySelectorAll('.action-btn');

    // 사이드바 열기
    sidebar.classList.add('active');

    // 제목 변경
    sidebarTitle.textContent = title;

    // 모든 패널 숨기기
    panels.forEach(panel => {
        panel.style.display = 'none';
    });

    // 선택한 패널 표시
    const targetPanel = document.getElementById(`panel-${panelName}`);
    if (targetPanel) {
        targetPanel.style.display = 'block';
    }

    // 버튼 활성화 상태 변경
    buttons.forEach(btn => {
        btn.classList.remove('active');
    });

    const activeBtn = document.getElementById(`btn-${panelName}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    // 패널별 로드 함수 호출
    handlePanelSwitch(panelName);
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const buttons = document.querySelectorAll('.action-btn');

    sidebar.classList.remove('active');

    // 버튼 활성화 상태 제거
    buttons.forEach(btn => {
        btn.classList.remove('active');
    });
}

function handlePanelSwitch(panelName) {
    switch(panelName) {
        case 'participants':
            // 참여자 목록은 실시간 업데이트되므로 별도 로드 불필요
            console.log('참여자 패널 활성화');
            break;
        case 'analysis':
            loadAnalysis();
            break;
        case 'questions':
            loadQuestions();
            break;
    }
}

// ==========================================
// 이벤트 리스너 등록
// ==========================================
function initializeEventListeners() {
    // 메시지 전송
    const sendBtn = document.getElementById('sendBtn');
    const messageInput = document.getElementById('messageInput');

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // 음성 입력 기능
    const voiceBtn = document.getElementById('voiceBtn');
    const voiceIcon = document.getElementById('voiceIcon');
    let recognition = null;
    let isRecording = false;

    // Web Speech API 지원 확인
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'ko-KR';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            isRecording = true;
            voiceBtn.classList.add('recording');
            voiceIcon.textContent = '⏹️';
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            messageInput.value = transcript;
            messageInput.style.height = 'auto';
            messageInput.style.height = messageInput.scrollHeight + 'px';
        };

        recognition.onerror = (event) => {
            console.error('음성 인식 오류:', event.error);
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                alert('음성 인식 중 오류가 발생했습니다: ' + event.error);
            }
        };

        recognition.onend = () => {
            isRecording = false;
            voiceBtn.classList.remove('recording');
            voiceIcon.textContent = '🎤';
        };

        voiceBtn.addEventListener('click', () => {
            if (isRecording) {
                recognition.stop();
            } else {
                recognition.start();
            }
        });
    } else {
        // Web Speech API 미지원 브라우저
        voiceBtn.addEventListener('click', () => {
            alert('이 브라우저는 음성 입력을 지원하지 않습니다.\nChrome, Edge 또는 Safari를 사용해주세요.');
        });
        voiceBtn.style.opacity = '0.5';
        voiceBtn.title = '음성 입력 미지원';
    }

    // 텍스트 영역 자동 높이 조절
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = messageInput.scrollHeight + 'px';
    });

    // 헤더 버튼
    document.getElementById('shareBtn').addEventListener('click', openShareModal);
    document.getElementById('closeBtn').addEventListener('click', closeRoom);

    // 설정 버튼 - 이름 변경
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            const newName = prompt('새로운 이름을 입력하세요:', currentUser.name);
            if (newName && newName !== currentUser.name) {
                // 방별로 사용자 정보 업데이트
                const savedUser = localStorage.getItem(`room_${currentDiscussionId}_user`);
                if (savedUser) {
                    const userData = JSON.parse(savedUser);
                    userData.name = newName;
                    localStorage.setItem(`room_${currentDiscussionId}_user`, JSON.stringify(userData));
                }
                alert('이름이 변경되었습니다. 페이지를 새로고침합니다.');
                location.reload();
            }
        });
    }

    // 사이드바 버튼
    document.getElementById('btn-participants').addEventListener('click', () => {
        openSidebar('participants', '참여자');
    });

    document.getElementById('btn-analysis').addEventListener('click', () => {
        openSidebar('analysis', 'AI 분석');
    });

    // AI 질문 버튼 - 채팅창에 질문 전송
    const btnQuestions = document.getElementById('btn-questions');
    btnQuestions.addEventListener('click', generateAndSendQuestion);

    document.getElementById('closeSidebarBtn').addEventListener('click', closeSidebar);

    // 최초 5분 동안 AI 질문 버튼 비활성화
    startInitialTimer();

    // 분석 새로고침
    const refreshBtn = document.getElementById('refreshAnalysisBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadAnalysis);
    }

    // PDF 다운로드
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', downloadPDF);
    }
}

// ==========================================
// 토론방 정보 로드 (입장 전)
// ==========================================
async function loadDiscussionInfoForJoin() {
    try {
        const response = await fetch(`/api/discussions/${currentDiscussionId}`);
        const data = await response.json();

        if (response.ok) {
            discussionInfo = data;
            document.getElementById('roomTitle').textContent = data.title;

            // 팀전이면 역할 선택 표시
            const roleSection = document.getElementById('joinRoleSection');
            const roleRadioGroup = document.getElementById('joinRoleRadioGroup');

            if (data.type === '팀전') {
                roleSection.style.display = 'flex';
                const team1Name = data.team1_name || '찬성';
                const team2Name = data.team2_name || '반대';

                roleRadioGroup.innerHTML = `
                    <div class="join-modal-radio-item">
                        <input type="radio" id="roleTeam1" name="userRole" value="${team1Name}" checked>
                        <label for="roleTeam1">${team1Name}</label>
                    </div>
                    <div class="join-modal-radio-item">
                        <input type="radio" id="roleTeam2" name="userRole" value="${team2Name}">
                        <label for="roleTeam2">${team2Name}</label>
                    </div>
                `;
            } else if (data.type === '역할극') {
                roleSection.style.display = 'flex';
                // 역할극은 나중에 구현
                roleRadioGroup.innerHTML = `
                    <div class="join-modal-radio-item">
                        <input type="radio" id="roleParticipant" name="userRole" value="참여자" checked>
                        <label for="roleParticipant">참여자</label>
                    </div>
                `;
            } else {
                roleSection.style.display = 'none';
            }

            console.log('토론방 정보 로드 완료:', data);

            // 비밀방이면 입장 코드 확인
            if (data.is_private) {
                // 이미 입장 코드를 확인한 적이 있는지 체크
                const verifiedCode = sessionStorage.getItem(`room_${currentDiscussionId}_verified`);
                if (!verifiedCode) {
                    // 입장 코드 모달 표시
                    document.getElementById('entryCodeModal').style.display = 'flex';
                    return;
                }
            }

            // 비밀방이 아니거나 이미 확인된 경우 입장 모달 표시
            showJoinModal();

        } else {
            throw new Error(data.error || '토론방 정보를 불러올 수 없습니다');
        }
    } catch (error) {
        console.error('토론방 정보 로드 실패:', error);
        alert(error.message);
        window.location.href = '/';
    }
}

// 입장 모달 표시
function showJoinModal() {
    // 이 방에 저장된 사용자 정보 확인
    const savedUser = localStorage.getItem(`room_${currentDiscussionId}_user`);
    if (savedUser) {
        const userData = JSON.parse(savedUser);
        document.getElementById('joinUserName').value = userData.name;
    }

    // 입장 모달 표시
    document.getElementById('joinModal').style.display = 'flex';
}

// ==========================================
// 토론방 정보 로드 (입장 후)
// ==========================================
async function loadDiscussionInfo() {
    try {
        const response = await fetch(`/api/discussions/${currentDiscussionId}`);
        const data = await response.json();

        if (response.ok) {
            document.getElementById('roomTitle').textContent = data.title;
            console.log('토론방 정보 로드 완료:', data);
        } else {
            throw new Error(data.error || '토론방 정보를 불러올 수 없습니다');
        }
    } catch (error) {
        console.error('토론방 정보 로드 실패:', error);
        alert(error.message);
    }
}

// ==========================================
// 입장 확인
// ==========================================
function confirmJoin() {
    const userName = document.getElementById('joinUserName').value.trim();

    if (!userName) {
        alert('이름을 입력해주세요');
        return;
    }

    let userRole = '참여자';
    const roleSection = document.getElementById('joinRoleSection');

    if (roleSection.style.display === 'flex') {
        const selectedRadio = document.querySelector('input[name="userRole"]:checked');
        if (selectedRadio) {
            userRole = selectedRadio.value;
        }
    }

    // 사용자 정보 저장
    currentUser.name = userName;
    currentUser.role = userRole;

    // 이 방에 사용자 정보 저장 (방별로 독립적)
    localStorage.setItem(`room_${currentDiscussionId}_user`, JSON.stringify({
        name: userName,
        role: userRole
    }));

    // 모달 닫기
    document.getElementById('joinModal').style.display = 'none';

    // Socket 초기화 및 입장
    initializeSocket();
}

function closeJoinModal() {
    // 뒤로가기
    window.location.href = '/';
}

// ==========================================
// 비밀 토론방 입장 코드 확인
// ==========================================
async function verifyEntryCode() {
    const entryCode = document.getElementById('entryCodeInput').value.trim();

    if (!entryCode) {
        alert('입장 코드를 입력해주세요');
        return;
    }

    try {
        const response = await fetch(`/api/discussions/${currentDiscussionId}/verify-entry`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ entryCode })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // 세션에 확인 완료 저장
            sessionStorage.setItem(`room_${currentDiscussionId}_verified`, 'true');

            // 입장 코드 모달 닫기
            document.getElementById('entryCodeModal').style.display = 'none';

            // 입장 모달 표시
            showJoinModal();
        } else {
            alert(data.error || '입장 코드가 틀렸습니다');
        }
    } catch (error) {
        console.error('입장 코드 확인 오류:', error);
        alert('입장 코드 확인 중 오류가 발생했습니다');
    }
}

function closeEntryCodeModal() {
    // 뒤로가기
    window.location.href = '/';
}

// ==========================================
// Socket.io 실시간 통신
// ==========================================
function initializeSocket() {
    // Socket.io 연결
    socket = io();

    // 연결 성공
    socket.on('connect', () => {
        console.log('Socket.io 연결됨:', socket.id);

        // 토론방 입장
        socket.emit('join-room', {
            discussionId: currentDiscussionId,
            userName: currentUser.name,
            userRole: currentUser.role || '참여자'
        });

        // Heartbeat 시작 - 30초마다 서버에 알림
        startHeartbeat();
    });

    // 기존 메시지 로드 (입장 시 한 번)
    socket.on('load-messages', (messages) => {
        console.log(`기존 메시지 ${messages.length}개 로드됨`);
        messages.forEach(msg => {
            addMessageToUI({
                author: msg.user_name,
                role: msg.user_role,
                message: msg.message,
                timestamp: msg.created_at,
                is_ai: msg.is_ai,
                message_type: msg.message_type
            });
        });
    });

    // AI 질문 타이머 동기화 (서버에서 전송)
    socket.on('ai-timer-sync', (data) => {
        console.log(`⏱️ AI 질문 타이머 동기화: ${data.remainingSeconds}초 남음, 활성화: ${data.isReady}`);
        startInitialTimer(data.remainingSeconds, data.isReady);
    });

    // 새 메시지 수신
    socket.on('new-message', (data) => {
        addMessageToUI(data);
    });

    // 참여자 목록 업데이트
    socket.on('participants-update', (participants) => {
        updateParticipantsList(participants);
    });

    // 에러 처리
    socket.on('error', (error) => {
        console.error('Socket.io 에러:', error);
        alert(error.message);
    });

    // 연결 해제
    socket.on('disconnect', () => {
        console.log('Socket.io 연결 해제됨');
    });
}

// ==========================================
// 메시지 기능
// ==========================================
function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();

    if (!message) return;

    // Socket.io로 메시지 전송
    if (socket && socket.connected) {
        socket.emit('send-message', {
            discussionId: currentDiscussionId,
            message: message,
            userName: currentUser.name,
            userRole: currentUser.role || '참여자'
        });

        messageInput.value = '';
        messageInput.style.height = 'auto';
    } else {
        alert('서버와 연결이 끊어졌습니다. 페이지를 새로고침해주세요.');
    }
}

function addMessageToUI(data) {
    const messageList = document.getElementById('messageList');
    const messageEl = document.createElement('div');

    const time = new Date(data.timestamp).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
    });

    // 시스템 메시지 처리
    if (data.message_type === 'system' || data.author === 'System') {
        messageEl.className = 'system-message';
        messageEl.innerHTML = `<span>${escapeHtml(data.message)}</span>`;
    } else if (data.is_ai || data.message_type === 'ai-question') {
        // AI 질문 메시지 (우아한 라벤더 스타일)
        messageEl.className = 'message message-ai';
        messageEl.innerHTML = `
            <div class="message-avatar">
                <span style="font-size: 20px; color: white;">🤖</span>
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author">${escapeHtml(data.author)} <span class="message-role">[AI]</span></span>
                </div>
                <div class="message-text">${escapeHtml(data.message)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
    } else {
        // 일반 메시지 - 카카오톡 스타일 (내 메시지 우측, 타인 메시지 좌측)
        const avatarImageUrl = data.avatar_image_url || '/images/avatars/avatar1.png';
        const avatarColor = data.avatar_color || '#9333ea';
        const roleClass = getRoleClass(data.role);

        // 현재 사용자의 메시지인지 확인
        const isOwnMessage = currentUser && data.author === currentUser.name;
        const messageClass = isOwnMessage ? 'message message-own' : 'message message-other';

        messageEl.className = messageClass;
        messageEl.innerHTML = `
            <div class="message-avatar" style="background-color: ${avatarColor};">
                <img src="${avatarImageUrl}" alt="avatar">
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author">${escapeHtml(data.author)} <span class="message-role ${roleClass}">[${escapeHtml(data.role)}]</span></span>
                </div>
                <div class="message-text">${escapeHtml(data.message)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
    }

    messageList.appendChild(messageEl);
    scrollToBottom();
}

// 역할에 따른 CSS 클래스 반환
function getRoleClass(role) {
    if (role === '찬성') return 'role-pros';
    if (role === '반대') return 'role-cons';
    return 'role-neutral';
}

function scrollToBottom() {
    const messagesArea = document.getElementById('messagesArea');
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==========================================
// 참여자 기능
// ==========================================
function updateParticipantsList(participants) {
    const participantsList = document.getElementById('participantsList');

    if (!participants || participants.length === 0) {
        participantsList.innerHTML = `
            <div class="empty-state">
                <p>아직 참여자가 없습니다</p>
            </div>
        `;
        document.getElementById('participantCount').textContent = '0';
        document.getElementById('participantBadge').textContent = '0';
        document.getElementById('onlineCount').textContent = '0명 온라인';
        return;
    }

    // 참여자 목록 HTML 생성 (아바타 이미지 + 이름 [역할] 형식)
    participantsList.innerHTML = participants.map(p => {
        const avatarImageUrl = p.avatar_image_url || '/images/avatars/avatar1.png';
        const avatarColor = p.avatar_color || '#9333ea';
        const roleClass = getRoleClass(p.user_role);
        return `
            <div class="participant-item">
                <div class="participant-avatar" style="background-color: ${avatarColor};">
                    <img src="${avatarImageUrl}" alt="avatar">
                </div>
                <div class="participant-info">
                    <div class="participant-name">${p.user_name}${p.user_name === currentUser.name ? ' (나)' : ''} <span class="participant-role ${roleClass}">[${p.user_role || '참여자'}]</span></div>
                </div>
                <div class="participant-status ${p.is_online ? '' : 'offline'}"></div>
            </div>
        `;
    }).join('');

    // 통계 업데이트
    const onlineCount = participants.filter(p => p.is_online).length;
    document.getElementById('participantCount').textContent = participants.length;
    document.getElementById('participantBadge').textContent = participants.length;
    document.getElementById('onlineCount').textContent = `${onlineCount}명 온라인`;

    // 역할별 통계 (찬성/반대/중립)
    const prosCount = participants.filter(p => p.user_role === '찬성').length;
    const consCount = participants.filter(p => p.user_role === '반대').length;
    const neutralCount = participants.filter(p => !['찬성', '반대'].includes(p.user_role)).length;

    if (document.getElementById('prosCount')) {
        document.getElementById('prosCount').textContent = prosCount;
        document.getElementById('consCount').textContent = consCount;
        document.getElementById('neutralCount').textContent = neutralCount;
    }
}

// ==========================================
// AI 분석 기능
// ==========================================
async function loadAnalysis() {
    console.log('AI 분석 로드 중...');

    const summaryBox = document.getElementById('summaryBox');
    summaryBox.innerHTML = `
        <p class="empty-state">충분한 대화가 진행된 후 AI 분석이 생성됩니다.</p>
    `;

    // TODO: 실제 분석 데이터 로드
}

// ==========================================
// AI 질문 기능 (채팅창 전송)
// ==========================================
let initialTimer = null;
let isAIQuestionReady = false;

// AI 질문 관리 변수
let storedAIQuestions = [];
let currentQuestionIndex = 0;

// 최초 5분 타이머 - AI 질문 버튼 활성화 대기 (서버 동기화)
function startInitialTimer(remainingSeconds, isReady) {
    const btnQuestions = document.getElementById('btn-questions');
    const timerBadge = document.getElementById('aiQuestionTimer');

    // 이미 활성화된 경우
    if (isReady) {
        isAIQuestionReady = true;
        timerBadge.style.display = 'none';
        btnQuestions.disabled = false;
        btnQuestions.style.opacity = '1';
        btnQuestions.style.cursor = 'pointer';
        console.log('✅ AI 질문 기능 활성화됨 (이미 5분 경과)');
        return;
    }

    // 타이머 진행 중
    let timeLeft = remainingSeconds;
    timerBadge.style.display = 'block';
    btnQuestions.disabled = true;
    btnQuestions.style.opacity = '0.5';
    btnQuestions.style.cursor = 'not-allowed';

    // 초기 표시
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerBadge.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // 기존 타이머가 있으면 제거
    if (initialTimer) {
        clearInterval(initialTimer);
    }

    initialTimer = setInterval(() => {
        timeLeft--;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerBadge.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (timeLeft <= 0) {
            clearInterval(initialTimer);
            isAIQuestionReady = true;

            // 타이머 뱃지 숨김
            timerBadge.style.display = 'none';

            // 버튼 활성화
            btnQuestions.disabled = false;
            btnQuestions.style.opacity = '1';
            btnQuestions.style.cursor = 'pointer';

            console.log('✅ AI 질문 기능 활성화됨');
        }
    }, 1000);
}

// AI 질문 생성 및 채팅창 전송 (한 번에 하나씩)
async function generateAndSendQuestion() {
    if (!isAIQuestionReady) {
        alert('토론이 충분히 진행된 후 AI 질문을 생성할 수 있습니다.');
        return;
    }

    const btnQuestions = document.getElementById('btn-questions');
    const originalText = btnQuestions.querySelector('.btn-label').textContent;

    try {
        // 저장된 질문이 있으면 다음 질문 전송
        if (storedAIQuestions.length > 0 && currentQuestionIndex < storedAIQuestions.length) {
            const q = storedAIQuestions[currentQuestionIndex];

            console.log(`📤 AI 질문 ${currentQuestionIndex + 1}/${storedAIQuestions.length} 전송:`, q);

            // Socket.io로 AI 질문 메시지 전송
            if (socket && socket.connected) {
                socket.emit('send-ai-question', {
                    discussionId: currentDiscussionId,
                    question: q.question,
                    category: q.category,
                    questionNumber: currentQuestionIndex + 1
                });
            }

            currentQuestionIndex++;

            // 모든 질문을 다 보냈으면 초기화
            if (currentQuestionIndex >= storedAIQuestions.length) {
                console.log('✅ 모든 AI 질문 전송 완료');
                storedAIQuestions = [];
                currentQuestionIndex = 0;
            }

            // 서버가 ai-timer-sync 이벤트를 브로드캐스트하므로 여기서는 타이머 재시작 불필요
            console.log('⏱️ 서버에서 타이머 동기화 대기 중...');

            return;
        }

        // 새로운 질문 생성
        btnQuestions.disabled = true;
        btnQuestions.querySelector('.btn-label').textContent = '생성 중...';

        const response = await fetch(`/api/discussions/${currentDiscussionId}/generate-questions`, {
            method: 'POST'
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log('✨ AI 질문 생성 완료:', data.questions);

            // 질문 저장
            storedAIQuestions = data.questions;
            currentQuestionIndex = 0;

            // 첫 번째 질문 전송
            if (storedAIQuestions.length > 0) {
                const firstQuestion = storedAIQuestions[0];

                if (socket && socket.connected) {
                    socket.emit('send-ai-question', {
                        discussionId: currentDiscussionId,
                        question: firstQuestion.question,
                        category: firstQuestion.category,
                        questionNumber: 1
                    });
                }

                currentQuestionIndex = 1;
                console.log(`📤 AI 질문 1/${storedAIQuestions.length} 전송 완료`);
                console.log('⏱️ 서버에서 타이머 동기화 대기 중...');
            }

            // 버튼 복원
            btnQuestions.disabled = false;
            btnQuestions.querySelector('.btn-label').textContent = originalText;

        } else {
            throw new Error(data.error || data.message || '질문 생성 실패');
        }
    } catch (error) {
        console.error('AI 질문 생성 오류:', error);
        alert(`AI 질문 생성 실패: ${error.message}`);

        // 버튼 복원
        btnQuestions.disabled = false;
        btnQuestions.querySelector('.btn-label').textContent = originalText;
    }
}

// ==========================================
// 공유 모달
// ==========================================
function openShareModal() {
    const modal = document.getElementById('shareModal');
    modal.classList.add('active');

    // TODO: 단축 URL 및 QR 코드 생성
    const currentUrl = window.location.href;
    document.getElementById('shortUrl').value = currentUrl;
}

function closeShareModal() {
    const modal = document.getElementById('shareModal');
    modal.classList.remove('active');
}

function copyUrl() {
    const urlInput = document.getElementById('shortUrl');
    urlInput.select();
    document.execCommand('copy');
    alert('URL이 클립보드에 복사되었습니다!');
}

// ==========================================
// PDF 다운로드
// ==========================================
function downloadPDF() {
    alert('PDF 다운로드 기능은 추후 구현 예정입니다.');
    // TODO: jsPDF를 사용한 PDF 생성
}

// ==========================================
// Heartbeat 메커니즘
// ==========================================
let heartbeatInterval = null;

function startHeartbeat() {
    // 기존 heartbeat가 있으면 정리
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }

    // 30초마다 서버에 heartbeat 전송
    heartbeatInterval = setInterval(() => {
        if (socket && socket.connected) {
            socket.emit('heartbeat');
            console.log('💓 Heartbeat 전송');
        }
    }, 30000); // 30초

    console.log('💓 Heartbeat 시작 (30초 간격)');
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
        console.log('💓 Heartbeat 중지');
    }
}

// ==========================================
// 기타
// ==========================================
function closeRoom() {
    // Heartbeat 중지
    stopHeartbeat();

    if (confirm('토론방을 나가시겠습니까?')) {
        // Socket 연결 종료
        if (socket) {
            socket.disconnect();
        }
        window.location.href = '/';
    }
}

// 브라우저 창 닫을 때 처리
window.addEventListener('beforeunload', () => {
    stopHeartbeat();
    if (socket) {
        socket.disconnect();
    }
});

// 전역 함수
window.closeShareModal = closeShareModal;
window.copyUrl = copyUrl;
window.generateQuestions = generateAndSendQuestion;

// ========================================== AI 분석 기능 ==========================================

// 분석 결과 저장
let analysisResult = null;

// 탭 전환 기능
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;

        // 모든 탭 버튼과 컨텐츠에서 active 제거
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        // 클릭한 탭 활성화
        btn.classList.add('active');
        document.getElementById('tab-' + targetTab).classList.add('active');
    });
});

// 채팅 메시지 수집 함수
function collectChatMessages() {
    const messages = [];
    const messageElements = document.querySelectorAll('.message:not(.system-message):not(.message-ai)');

    messageElements.forEach(el => {
        const authorEl = el.querySelector('.message-author');
        const textEl = el.querySelector('.message-text');
        const roleEl = el.querySelector('.message-role');

        const author = authorEl ? authorEl.textContent.trim() : 'Unknown';
        const text = textEl ? textEl.textContent.trim() : '';
        const role = roleEl ? roleEl.textContent.trim().replace(/[\[\]]/g, '') : 'neutral';

        if (text) {
            messages.push({
                author: author.split('[')[0].trim(),
                role: role,
                message: text
            });
        }
    });

    return messages;
}

// AI 분석 시작 버튼
const startAnalysisBtn = document.getElementById('startAnalysisBtn');
if (startAnalysisBtn) {
    startAnalysisBtn.addEventListener('click', async () => {
        const messages = collectChatMessages();

        // 최소 5개 메시지 체크
        if (messages.length < 5) {
            alert('AI 분석을 위해서는 최소 5개 이상의 메시지가 필요합니다.');
            return;
        }

        // 뷰 전환: 시작 -> 로딩
        document.getElementById('analysis-start-view').style.display = 'none';
        document.getElementById('analysis-loading-view').style.display = 'block';

        try {
            // Gemini API 호출
            const response = await fetch('/api/analyze-discussion', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    discussion_id: discussionId,
                    messages: messages
                })
            });

            if (!response.ok) {
                throw new Error('분석 요청 실패');
            }

            const result = await response.json();
            analysisResult = result;

            // 결과 렌더링
            renderAnalysisResult(result);

            // 뷰 전환: 로딩 -> 결과
            document.getElementById('analysis-loading-view').style.display = 'none';
            document.getElementById('analysis-result-view').style.display = 'block';

        } catch (error) {
            console.error('AI 분석 오류:', error);
            alert('AI 분석 중 오류가 발생했습니다: ' + error.message);

            // 뷰 전환: 로딩 -> 시작
            document.getElementById('analysis-loading-view').style.display = 'none';
            document.getElementById('analysis-start-view').style.display = 'block';
        }
    });
}

// 분석 결과 렌더링
function renderAnalysisResult(result) {
    // AI 최종 판정
    const winnerBadge = document.getElementById('winnerBadge');
    const verdictText = document.getElementById('verdictText');

    if (result.winner) {
        winnerBadge.textContent = result.winner === 'pros' ? '찬성 승리' : '반대 승리';
        winnerBadge.className = 'winner-badge';
        if (result.winner === 'cons') {
            winnerBadge.style.color = '#ef4444';
        }
    }

    if (result.verdict) {
        verdictText.textContent = result.verdict;
    }

    // 팀별 종합 분석
    if (result.team_analysis) {
        if (result.team_analysis.pros) {
            const prosStrategyEl = document.getElementById('prosStrategy');
            const prosArgumentsEl = document.getElementById('prosArguments');
            if (prosStrategyEl) prosStrategyEl.textContent = result.team_analysis.pros.strategy || '';
            if (prosArgumentsEl) prosArgumentsEl.textContent = result.team_analysis.pros.arguments || '';
        }
        if (result.team_analysis.cons) {
            const consStrategyEl = document.getElementById('consStrategy');
            const consArgumentsEl = document.getElementById('consArguments');
            if (consStrategyEl) consStrategyEl.textContent = result.team_analysis.cons.strategy || '';
            if (consArgumentsEl) consArgumentsEl.textContent = result.team_analysis.cons.arguments || '';
        }
    }

    // 주요 발언
    if (result.key_statements) {
        const prosStatement = result.key_statements.find(s => s.team === 'pros');
        const consStatement = result.key_statements.find(s => s.team === 'cons');

        if (prosStatement) {
            const prosTextEl = document.querySelector('#keyStatementPros .statement-text');
            if (prosTextEl) prosTextEl.textContent = prosStatement.statement || '';
        }
        if (consStatement) {
            const consTextEl = document.querySelector('#keyStatementCons .statement-text');
            if (consTextEl) consTextEl.textContent = consStatement.statement || '';
        }
    }

    // 참여자 개별 분석
    const participantsAnalysisEl = document.getElementById('participantsAnalysis');
    if (participantsAnalysisEl) {
        participantsAnalysisEl.innerHTML = '';

        if (result.participant_analysis && result.participant_analysis.length > 0) {
            result.participant_analysis.forEach(participant => {
                const participantBox = document.createElement('div');
                participantBox.className = 'participant-analysis-box';

                const teamBadgeClass = participant.team === 'pros' ? 'pros-badge' :
                                       participant.team === 'cons' ? 'cons-badge' : '';
                const teamLabel = participant.team === 'pros' ? '찬성 팀' :
                                  participant.team === 'cons' ? '반대 팀' : '중립';

                let contributionHtml = '';
                if (participant.key_contribution) {
                    contributionHtml = '<div class="contribution-highlight"><strong>핵심 기여 발언:</strong><br>"' +
                                       participant.key_contribution + '"</div>';
                }

                participantBox.innerHTML =
                    '<div class="participant-analysis-header">' +
                        '<span class="participant-name">' + participant.name + '</span>' +
                        '<span class="participant-team-badge ' + teamBadgeClass + '">' + teamLabel + '</span>' +
                    '</div>' +
                    '<div class="participant-analysis-content">' +
                        '<p><strong>개별 분석:</strong> ' + (participant.analysis || '') + '</p>' +
                        contributionHtml +
                    '</div>';

                participantsAnalysisEl.appendChild(participantBox);
            });
        }
    }
}

// 다시 분석하기 버튼
const reanalyzeBtn = document.getElementById('reanalyzeBtn');
if (reanalyzeBtn) {
    reanalyzeBtn.addEventListener('click', () => {
        // 뷰 초기화
        document.getElementById('analysis-result-view').style.display = 'none';
        document.getElementById('analysis-start-view').style.display = 'block';
        analysisResult = null;
    });
}

// PDF 다운로드 버튼
const downloadPdfBtn2 = document.getElementById('downloadPdfBtn2');
if (downloadPdfBtn2) {
    downloadPdfBtn2.addEventListener('click', async () => {
        if (!analysisResult) {
            alert('분석 결과가 없습니다.');
            return;
        }

        try {
            const response = await fetch('/api/generate-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    discussion_id: discussionId,
                    analysis: analysisResult
                })
            });

            if (!response.ok) {
                throw new Error('PDF 생성 실패');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'discussion-analysis-' + discussionId + '.pdf';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (error) {
            console.error('PDF 다운로드 오류:', error);
            alert('PDF 다운로드 중 오류가 발생했습니다.');
        }
    });
}
