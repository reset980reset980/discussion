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

// ==========================================
// 초기화
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // URL에서 토론방 ID 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    currentDiscussionId = urlParams.get('id');

    if (!currentDiscussionId) {
        alert('토론방 ID가 없습니다');
        window.location.href = '/';
        return;
    }

    // 사용자 이름 가져오기 (localStorage에서 먼저 확인)
    let userName = localStorage.getItem('discussionUserName');

    if (!userName) {
        userName = prompt('이름을 입력하세요:');
        if (!userName) {
            window.location.href = '/';
            return;
        }
        // localStorage에 저장
        localStorage.setItem('discussionUserName', userName);
    }

    currentUser.name = userName;

    // 초기화
    initializeEventListeners();
    loadDiscussionInfo();
    initializeSocket();
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
                localStorage.setItem('discussionUserName', newName);
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

    document.getElementById('btn-questions').addEventListener('click', () => {
        openSidebar('questions', 'AI 질문');
    });

    document.getElementById('closeSidebarBtn').addEventListener('click', closeSidebar);

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
// 토론방 정보 로드
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
    } else {
        // 일반 메시지
        messageEl.className = 'message';
        messageEl.innerHTML = `
            <div class="message-avatar">${data.author.charAt(0)}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author">${data.author}</span>
                    <span class="message-role">${data.role}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-text">${escapeHtml(data.message)}</div>
            </div>
        `;
    }

    messageList.appendChild(messageEl);
    scrollToBottom();
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

    // 참여자 목록 HTML 생성
    participantsList.innerHTML = participants.map(p => `
        <div class="participant-item">
            <div class="participant-avatar">${p.user_name.charAt(0)}</div>
            <div class="participant-info">
                <div class="participant-name">${p.user_name}${p.user_name === currentUser.name ? ' (나)' : ''}</div>
                <div class="participant-role">${p.user_role || '참여자'}</div>
            </div>
            <div class="participant-status ${p.is_online ? '' : 'offline'}"></div>
        </div>
    `).join('');

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
// AI 질문 기능
// ==========================================
async function loadQuestions() {
    console.log('AI 질문 로드 중...');

    // 타이머 시작
    startQuestionTimer();

    // TODO: 실제 질문 데이터 로드
}

function startQuestionTimer() {
    let timeLeft = 300; // 5분 = 300초
    const timerEl = document.getElementById('timeRemaining');

    const interval = setInterval(() => {
        timeLeft--;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (timeLeft <= 0) {
            clearInterval(interval);
            // TODO: AI 질문 생성 요청
        }
    }, 1000);
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
// 기타
// ==========================================
function closeRoom() {
    if (confirm('토론방을 나가시겠습니까?')) {
        window.location.href = '/';
    }
}

// 전역 함수
window.closeShareModal = closeShareModal;
window.copyUrl = copyUrl;
