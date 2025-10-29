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
                        <input type="radio" id="roleTeam1" name="userRole" value="team1" checked>
                        <label for="roleTeam1">${team1Name}</label>
                    </div>
                    <div class="join-modal-radio-item">
                        <input type="radio" id="roleTeam2" name="userRole" value="team2">
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
        // AI 질문 메시지
        messageEl.className = 'message ai-message';
        messageEl.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author">${data.author}</span>
                    <span class="message-role">${data.role}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-text">${escapeHtml(data.message)}</div>
            </div>
        `;
    } else {
        // 일반 메시지 (이모지 + 이름 [역할] 형식)
        const emoji = data.emoji_avatar || '😊';
        const roleClass = getRoleClass(data.role);

        messageEl.className = 'message';
        messageEl.innerHTML = `
            <div class="message-avatar">${emoji}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author">${escapeHtml(data.author)} <span class="message-role ${roleClass}">[${escapeHtml(data.role)}]</span></span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-text">${escapeHtml(data.message)}</div>
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

    // 참여자 목록 HTML 생성 (이모지 + 이름 [역할] 형식)
    participantsList.innerHTML = participants.map(p => {
        const emoji = p.emoji_avatar || '😊';
        const roleClass = getRoleClass(p.user_role);
        return `
            <div class="participant-item">
                <div class="participant-avatar">${emoji}</div>
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

// 최초 5분 타이머 - AI 질문 버튼 활성화 대기
function startInitialTimer() {
    let timeLeft = 300; // 5분 = 300초
    const btnQuestions = document.getElementById('btn-questions');
    const timerBadge = document.getElementById('aiQuestionTimer');

    // 타이머 뱃지 표시
    timerBadge.style.display = 'block';

    // 버튼 비활성화
    btnQuestions.disabled = true;
    btnQuestions.style.opacity = '0.5';
    btnQuestions.style.cursor = 'not-allowed';

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

// AI 질문 생성 및 채팅창 전송
async function generateAndSendQuestion() {
    if (!isAIQuestionReady) {
        alert('토론이 충분히 진행된 후 AI 질문을 생성할 수 있습니다.');
        return;
    }

    const btnQuestions = document.getElementById('btn-questions');
    const originalText = btnQuestions.querySelector('.btn-label').textContent;

    try {
        // 버튼 로딩 상태
        btnQuestions.disabled = true;
        btnQuestions.querySelector('.btn-label').textContent = '생성 중...';

        const response = await fetch(`/api/discussions/${currentDiscussionId}/generate-questions`, {
            method: 'POST'
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log('✨ AI 질문 생성 완료:', data.questions);

            // Socket.io로 AI 질문 메시지 전송 요청
            if (socket && socket.connected) {
                data.questions.forEach((q, index) => {
                    socket.emit('send-ai-question', {
                        discussionId: currentDiscussionId,
                        question: q.question,
                        category: q.category,
                        questionNumber: index + 1
                    });
                });
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
window.generateQuestions = generateQuestions;
