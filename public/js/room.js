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
    const activeBtn = document.getElementById(`btn-${panelName}`);

    // 같은 메뉴를 다시 누르면 사이드바 닫기 (토글)
    if (activeBtn && activeBtn.classList.contains('active') && sidebar.classList.contains('active')) {
        closeSidebar();
        return;
    }

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

    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    // 사이드바 열기 (flex-basis transition 사용)
    sidebar.classList.add('active');

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
            voiceIcon.src = '/images/icons/mic-off.png';
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
            voiceIcon.src = '/images/icons/mic-on.png';
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

    // 토론 상황 토글
    const contextHeader = document.getElementById('contextHeader');
    const contextToggle = document.getElementById('contextToggle');
    const contextContent = document.getElementById('contextContent');

    if (contextHeader && contextToggle && contextContent) {
        contextHeader.addEventListener('click', () => {
            contextContent.classList.toggle('collapsed');
            contextToggle.classList.toggle('collapsed');
        });
    }

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

            // 토론 상황 표시
            const contextDescription = document.getElementById('contextDescription');
            const discussionContext = document.getElementById('discussionContext');
            if (data.description && data.description.trim()) {
                // 연속된 줄바꿈(3개 이상)을 2개로 줄이고, 제목 뒤의 빈 줄 제거
                let cleanedDescription = data.description.replace(/\n{3,}/g, '\n\n');
                // 이모지를 포함한 제목 뒤의 연속 줄바꿈을 하나로 줄이기
                cleanedDescription = cleanedDescription.replace(/(:)\n+/g, '$1\n');
                contextDescription.textContent = cleanedDescription;
                if (discussionContext) discussionContext.style.display = 'block';
            } else {
                contextDescription.textContent = '토론 상황이 설정되지 않았습니다.';
                if (discussionContext) discussionContext.style.display = 'none';
            }

            // 팀전이면 역할 선택 표시
            const roleSection = document.getElementById('joinRoleSection');
            const roleRadioGroup = document.getElementById('joinRoleRadioGroup');
            const roleDropdownSection = document.getElementById('joinRoleDropdownSection');
            const roleSelect = document.getElementById('joinRoleSelect');

            // 참여자 패널의 팀 통계 영역 제어
            const participantsStats = document.querySelector('.participants-stats');

            if (data.type === '팀전') {
                roleSection.style.display = 'flex';
                roleDropdownSection.style.display = 'none';
                const team1Name = data.team1_name || '찬성';
                const team2Name = data.team2_name || '반대';

                // 팀 통계 영역 표시
                if (participantsStats) participantsStats.style.display = 'block';

                // 참여자 패널의 팀 라벨 업데이트
                const team1Label = document.getElementById('team1Label');
                const team2Label = document.getElementById('team2Label');
                if (team1Label) team1Label.textContent = team1Name;
                if (team2Label) team2Label.textContent = team2Name;

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
                // 역할극 모드: 드롭다운으로 역할 선택
                roleSection.style.display = 'none';
                roleDropdownSection.style.display = 'flex';

                // 팀 통계 영역 숨기기
                if (participantsStats) participantsStats.style.display = 'none';

                // 역할 목록 파싱 (JSON 문자열 → 배열)
                let roles = [];
                if (data.roles) {
                    try {
                        roles = typeof data.roles === 'string' ? JSON.parse(data.roles) : data.roles;
                    } catch (error) {
                        console.error('역할 목록 파싱 오류:', error);
                        roles = [];
                    }
                }

                // 드롭다운 옵션 생성
                if (roles.length > 0) {
                    roleSelect.innerHTML = '<option value="">자신의 역할을 선택하세요</option>';
                    roles.forEach(role => {
                        const option = document.createElement('option');
                        option.value = role;
                        option.textContent = role;
                        roleSelect.appendChild(option);
                    });
                } else {
                    // 역할 목록이 없는 경우 기본값
                    roleSelect.innerHTML = '<option value="">역할 정보가 없습니다</option>';
                }
            } else {
                // 자유토론 모드
                roleSection.style.display = 'none';
                roleDropdownSection.style.display = 'none';

                // 팀 통계 영역 숨기기
                if (participantsStats) participantsStats.style.display = 'none';
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
        // 저장된 사용자 정보가 있으면 자동 입장
        currentUser.name = userData.name;
        currentUser.role = userData.role || '참여자';

        console.log('저장된 사용자 정보로 자동 입장:', currentUser);

        // Socket 초기화 및 입장
        initializeSocket();
        return;
    }

    // 저장된 정보가 없으면 입장 모달 표시
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
    const roleDropdownSection = document.getElementById('joinRoleDropdownSection');

    // 역할 모드: 드롭다운에서 역할 가져오기
    if (roleDropdownSection && roleDropdownSection.style.display === 'flex') {
        const roleSelect = document.getElementById('joinRoleSelect');
        if (roleSelect && roleSelect.value) {
            userRole = roleSelect.value;
        } else {
            alert('역할을 선택해주세요');
            return;
        }
    }
    // 팀전 모드: 라디오 버튼에서 역할 가져오기
    else if (roleSection && roleSection.style.display === 'flex') {
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
            <div class="message-avatar">
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
    // 실제 팀명 확인
    const team1Name = discussionInfo?.team1_name || '찬성';
    const team2Name = discussionInfo?.team2_name || '반대';

    // AI 분석 결과가 "찬성"/"반대"로 오는 경우 또는 실제 팀명과 비교
    if (role === '찬성' || role === team1Name) return 'role-pros';
    if (role === '반대' || role === team2Name) return 'role-cons';
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
        const roleClass = getRoleClass(p.user_role);
        return `
            <div class="participant-item">
                <div class="participant-avatar">
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

    // 역할별 통계 (팀1/팀2만 - 실제 팀명 기준)
    const team1Name = discussionInfo?.team1_name || '찬성';
    const team2Name = discussionInfo?.team2_name || '반대';

    const team1Count = participants.filter(p => p.user_role === team1Name).length;
    const team2Count = participants.filter(p => p.user_role === team2Name).length;

    if (document.getElementById('prosCount')) {
        document.getElementById('prosCount').textContent = team1Count;
        document.getElementById('consCount').textContent = team2Count;
    }
}

// ==========================================
// AI 분석 기능
// ==========================================
async function loadAnalysis() {
    console.log('AI 분석 패널 로드됨');
    // 분석 패널이 열렸을 때 필요한 초기화가 있다면 여기에 추가
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

    // 초기화
    document.getElementById('shareCustomSlug').value = '';
    document.getElementById('shareShortLink').value = window.location.href;

    // 입장 코드 섹션 표시 (비공개 토론방인 경우)
    const entryCodeSection = document.getElementById('shareEntryCodeSection');
    const entryCodeInput = document.getElementById('shareEntryCode');

    if (discussionInfo && discussionInfo.is_private && discussionInfo.entry_code) {
        entryCodeInput.value = discussionInfo.entry_code;
        entryCodeSection.style.display = 'block';
    } else {
        entryCodeSection.style.display = 'none';
    }

    // QR 코드 표시
    const qrDisplay = document.getElementById('shareQrCode');
    qrDisplay.innerHTML = '';

    // QRCode 라이브러리 사용
    new QRCode(qrDisplay, {
        text: window.location.href,
        width: 200,
        height: 200
    });
}

// 중복 확인
async function checkShareAliasAvailability() {
    const alias = document.getElementById('shareCustomSlug').value.trim();
    const domain = document.getElementById('shareDomainSelect').value;

    if (!alias) {
        showToast('사용자 지정 URL을 입력해주세요', 'error');
        return;
    }

    try {
        const response = await fetch(`/s/check?alias=${encodeURIComponent(alias)}&domain=${encodeURIComponent(domain)}`);
        const data = await response.json();

        if (data.available) {
            showToast('사용 가능한 주소입니다!', 'success');
        } else {
            showToast('이미 사용 중인 주소입니다. 다른 주소를 입력해주세요.', 'error');
        }
    } catch (error) {
        console.error('중복 확인 실패:', error);
        showToast('중복 확인 중 오류가 발생했습니다. 다시 시도해주세요.', 'error');
    }
}

function closeShareModal() {
    const modal = document.getElementById('shareModal');
    modal.classList.remove('active');
}

// 토론방 단축 URL 생성
async function generateRoomShortlink() {
    const customAlias = document.getElementById('shareCustomSlug').value.trim();
    const currentUrl = window.location.href;

    try {
        const response = await fetch('/s/shorten', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: currentUrl,
                customAlias: customAlias || undefined,
                generateQR: false // QR 코드는 클라이언트에서 생성
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '단축 URL 생성 실패');
        }

        const result = await response.json();
        const data = result.data; // API 응답 구조: { success: true, data: {...} }

        // 생성된 URL 표시
        document.getElementById('shareShortLink').value = data.shortUrl;

        // QR 코드 업데이트
        updateQRCode(data.shortUrl);

        showToast('단축 URL이 생성되었습니다!', 'success');

    } catch (error) {
        console.error('단축 URL 생성 실패:', error);
        showToast(error.message, 'error');
    }
}

// QR 코드 업데이트
function updateQRCode(url) {
    const qrDisplay = document.getElementById('shareQrCode');
    qrDisplay.innerHTML = '';

    // QRCode 라이브러리 사용
    new QRCode(qrDisplay, {
        text: url,
        width: 200,
        height: 200
    });
}

// 단축 URL 복사
function copyShareUrl() {
    const urlInput = document.getElementById('shareShortLink');
    urlInput.select();
    document.execCommand('copy');
    showToast('URL이 클립보드에 복사되었습니다!', 'success');
}

// 토론방 공유하기
function shareRoom() {
    const shortUrl = document.getElementById('shareShortLink').value;

    if (navigator.share) {
        navigator.share({
            title: '토론방 초대',
            text: '토론에 참여해보세요!',
            url: shortUrl
        }).catch(err => console.log('공유 실패:', err));
    } else {
        copyShareUrl();
    }
}

// 입장 코드 복사
function copyEntryCode() {
    const entryCodeInput = document.getElementById('shareEntryCode');
    entryCodeInput.select();
    document.execCommand('copy');
    showToast('입장 코드가 클립보드에 복사되었습니다!', 'success');
}

// 전역 함수로 등록
window.generateRoomShortlink = generateRoomShortlink;
window.copyShareUrl = copyShareUrl;
window.shareRoom = shareRoom;
window.copyEntryCode = copyEntryCode;

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
                    discussion_id: currentDiscussionId,
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
            console.log('📊 서버에 종합분석 PDF 생성 요청...');

            if (!analysisResult) {
                alert('종합분석 결과가 없습니다.');
                return;
            }

            // 서버 API 호출
            const response = await fetch(`/api/discussions/${currentDiscussionId}/generate-analysis-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    analysisData: analysisResult,
                    discussionTitle: discussionInfo?.title || '토론'
                })
            });

            if (!response.ok) {
                throw new Error('PDF 생성 실패');
            }

            // Blob으로 변환
            const blob = await response.blob();

            // 다운로드
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `analysis-${currentDiscussionId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            console.log('✅ 종합분석 PDF 다운로드 완료');

        } catch (error) {
            console.error('PDF 다운로드 오류:', error);
            alert('PDF 다운로드 중 오류가 발생했습니다: ' + error.message);
        }
    });
}

// 흐름 시각화 PDF 다운로드 버튼
const downloadFlowPdfBtn = document.getElementById('downloadFlowPdfBtn');
if (downloadFlowPdfBtn) {
    downloadFlowPdfBtn.addEventListener('click', async () => {
        if (!flowAnalysisResult) {
            alert('흐름 분석 결과가 없습니다.');
            return;
        }

        try {
            console.log('📊 서버에 흐름시각화 PDF 생성 요청...');

            // 차트 이미지들을 base64로 변환
            const chartImages = {};

            if (participantChartInstance) {
                chartImages.participantChart = participantChartInstance.toBase64Image();
            }

            if (teamChartInstance) {
                chartImages.teamChart = teamChartInstance.toBase64Image();
            }

            if (interactionChartInstance) {
                chartImages.interactionChart = interactionChartInstance.toBase64Image();
            }

            if (trendChartInstance) {
                chartImages.trendChart = trendChartInstance.toBase64Image();
            }

            if (keywordChartInstance) {
                chartImages.keywordChart = keywordChartInstance.toBase64Image();
            }

            // 서버 API 호출
            const response = await fetch(`/api/discussions/${currentDiscussionId}/generate-flow-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    flowData: flowAnalysisResult,
                    chartImages: chartImages,
                    discussionTitle: discussionInfo?.title || '토론'
                })
            });

            if (!response.ok) {
                throw new Error('PDF 생성 실패');
            }

            // Blob으로 변환
            const blob = await response.blob();

            // 다운로드
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `flow-${currentDiscussionId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            console.log('✅ 흐름시각화 PDF 다운로드 완료');

        } catch (error) {
            console.error('PDF 다운로드 오류:', error);
            alert('PDF 다운로드 중 오류가 발생했습니다: ' + error.message);
        }
    });
}

// ========================================== 흐름 시각화 탭 ==========================================

// Chart.js 인스턴스 저장
let participantChartInstance = null;
let teamChartInstance = null;
let interactionChartInstance = null;
let trendChartInstance = null;
let keywordChartInstance = null;
let flowAnalysisResult = null;

// 흐름 분석 시작 버튼
const startFlowBtn = document.getElementById('startFlowBtn');
if (startFlowBtn) {
    startFlowBtn.addEventListener('click', async () => {
        const messages = collectChatMessages();

        // 최소 10개 메시지 체크
        if (messages.length < 10) {
            alert('AI 흐름 분석을 실행하려면 최소 10개 이상의 메시지가 필요합니다.');
            return;
        }

        // 뷰 전환: 시작 -> 로딩
        document.getElementById('flow-start-view').style.display = 'none';
        document.getElementById('flow-loading-view').style.display = 'block';

        try {
            // Gemini API 호출
            const response = await fetch('/api/analyze-flow', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    discussion_id: currentDiscussionId,
                    messages: messages
                })
            });

            if (!response.ok) {
                throw new Error('흐름 분석 실패');
            }

            const result = await response.json();
            flowAnalysisResult = result;

            // 결과 렌더링
            renderFlowAnalysisResult(result);

            // 뷰 전환: 로딩 -> 결과
            document.getElementById('flow-loading-view').style.display = 'none';
            document.getElementById('flow-result-view').style.display = 'block';

        } catch (error) {
            console.error('AI 흐름 분석 오류:', error);
            alert('AI 흐름 분석 중 오류가 발생했습니다: ' + error.message);

            // 뷰 전환: 로딩 -> 시작
            document.getElementById('flow-loading-view').style.display = 'none';
            document.getElementById('flow-start-view').style.display = 'block';
        }
    });
}

// 다시 분석하기 버튼
const reanalyzeFlowBtn = document.getElementById('reanalyzeFlowBtn');
if (reanalyzeFlowBtn) {
    reanalyzeFlowBtn.addEventListener('click', () => {
        // 뷰 초기화
        document.getElementById('flow-result-view').style.display = 'none';
        document.getElementById('flow-start-view').style.display = 'block';
        flowAnalysisResult = null;

        // 차트 파괴
        if (participantChartInstance) participantChartInstance.destroy();
        if (teamChartInstance) teamChartInstance.destroy();
        if (interactionChartInstance) interactionChartInstance.destroy();
        if (trendChartInstance) trendChartInstance.destroy();
        if (keywordChartInstance) keywordChartInstance.destroy();
    });
}

// AI 흐름 분석 결과 렌더링
function renderFlowAnalysisResult(result) {
    // 1. 타임라인 렌더링
    if (result.timeline && Array.isArray(result.timeline)) {
        const timelineContainer = document.getElementById('flowTimeline');
        timelineContainer.innerHTML = '';

        result.timeline.forEach(moment => {
            const momentDiv = document.createElement('div');
            momentDiv.className = 'timeline-moment';
            momentDiv.innerHTML = `
                <div class="timeline-moment-time">${moment.time || '시간'}</div>
                <div class="timeline-moment-title">${moment.title}</div>
                <div class="timeline-moment-description">${moment.description}</div>
            `;
            timelineContainer.appendChild(momentDiv);
        });
    }

    // 2. 참여자별 발언 비중 차트
    if (result.participant_stats) {
        renderParticipantChartFromAI(result.participant_stats);
        // 2-1. 팀별 발언 비중 차트 (상대적 비중)
        renderTeamChartFromAI(result.participant_stats);
    }

    // 3. 참여자 상호작용 6각형 레이더 차트 (상위 5명 + 기타 학생들)
    if (result.participant_stats) {
        renderInteractionChartFromAI(result.participant_stats);
    }

    // 4. 토론 흐름 트렌드 차트
    if (result.trend_data) {
        renderTrendChartFromAI(result.trend_data);
    }

    // 5. 핵심 키워드 트렌드 차트 (데이터가 없어도 안내 메시지 표시)
    renderKeywordChartFromAI(result.keyword_data || {});
}

// 1. 참여자별 발언 비중 도넛 차트 (AI 데이터 사용)
function renderParticipantChartFromAI(participantStats) {
    const canvas = document.getElementById('participantChart');
    if (!canvas) return;

    const labels = participantStats.map(p => p.name);
    const data = participantStats.map(p => p.count);
    const colors = participantStats.map(p => {
        if (p.role === '찬성') return 'rgba(16, 185, 129, 0.8)';
        if (p.role === '반대') return 'rgba(239, 68, 68, 0.8)';
        return 'rgba(107, 114, 128, 0.8)';
    });

    // 기존 차트 파괴
    if (participantChartInstance) {
        participantChartInstance.destroy();
    }

    // 차트 생성
    participantChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: 'white',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value}회 (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// 1-1. 팀별 발언 비중 도넛 차트 (상대적 비중 계산 - 실제 팀명 사용)
function renderTeamChartFromAI(participantStats) {
    const canvas = document.getElementById('teamChart');
    if (!canvas) return;

    // 실제 팀명 가져오기
    const team1Name = discussionInfo?.team1_name || '찬성';
    const team2Name = discussionInfo?.team2_name || '반대';

    // 팀별 발언 횟수와 인원 수 계산
    const teamData = {};
    teamData[team1Name] = { count: 0, members: 0 };
    teamData[team2Name] = { count: 0, members: 0 };

    participantStats.forEach(p => {
        const role = p.role;
        // AI 분석 결과가 "찬성"/"반대"로 오는 경우 실제 팀명으로 매핑
        let actualTeam = role;
        if (role === '찬성') actualTeam = team1Name;
        if (role === '반대') actualTeam = team2Name;

        // 실제 팀명으로 집계
        if (teamData[actualTeam]) {
            teamData[actualTeam].count += p.count;
            teamData[actualTeam].members += 1;
        }
    });

    // 팀당 평균 발언 수 계산 (상대적 비중)
    const teamAverages = {};
    Object.keys(teamData).forEach(team => {
        if (teamData[team].members > 0) {
            teamAverages[team] = teamData[team].count / teamData[team].members;
        } else {
            teamAverages[team] = 0;
        }
    });

    // 차트 데이터 준비
    const labels = Object.keys(teamAverages).filter(team => teamAverages[team] > 0);
    const data = labels.map(team => teamAverages[team]);
    const colors = labels.map((team, idx) => {
        // 팀1은 초록색, 팀2는 빨간색
        return idx === 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)';
    });

    // 기존 차트 파괴
    if (teamChartInstance) {
        teamChartInstance.destroy();
    }

    // 차트 생성
    teamChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: 'white',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const team = context.label || '';
                            const avgValue = context.parsed || 0;
                            const teamInfo = teamData[team];
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((avgValue / total) * 100).toFixed(1);
                            return [
                                `${team}`,
                                `인원: ${teamInfo.members}명`,
                                `총 발언: ${teamInfo.count}회`,
                                `평균: ${avgValue.toFixed(1)}회/인 (${percentage}%)`
                            ];
                        }
                    }
                }
            }
        }
    });
}

// 2. 참여자 상호작용 6각형 레이더 차트 (상위 5명 + 기타 학생들)
function renderInteractionChartFromAI(participantStats) {
    const canvas = document.getElementById('interactionChart');
    if (!canvas) return;

    // 발언 횟수 기준으로 정렬
    const sorted = [...participantStats].sort((a, b) => (b.count || 0) - (a.count || 0));

    // 상위 5명 추출
    const top5 = sorted.slice(0, 5);

    // 나머지 참여자들의 발언 횟수 합산 (기타 학생들)
    const others = sorted.slice(5);
    const othersCount = others.reduce((sum, p) => sum + (p.count || 0), 0);

    // 6개 축 라벨 생성: 상위 5명 + "기타 학생들"
    const labels = top5.map(p => p.name);
    if (othersCount > 0) {
        labels.push('기타 학생들');
    }

    // 6개 축 데이터 생성
    const data = top5.map(p => p.count || 0);
    if (othersCount > 0) {
        data.push(othersCount);
    }

    // 기존 차트 파괴
    if (interactionChartInstance) {
        interactionChartInstance.destroy();
    }

    // 차트 생성
    interactionChartInstance = new Chart(canvas, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: '발언 횟수',
                data: data,
                backgroundColor: 'rgba(59, 130, 246, 0.3)',  // 파란색 반투명
                borderColor: 'rgba(59, 130, 246, 0.8)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(59, 130, 246, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: Math.max(...data) > 20 ? 5 : 2  // 동적 스케일
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.3)',  // 배경 라인 진하게
                        lineWidth: 1.5
                    },
                    angleLines: {
                        color: 'rgba(0, 0, 0, 0.3)',  // 각도 라인도 진하게
                        lineWidth: 1.5
                    }
                }
            },
            plugins: {
                legend: {
                    display: false  // 범례 숨김 (단일 데이터셋이므로)
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `발언 횟수: ${context.parsed.r}회`;
                        }
                    }
                }
            }
        }
    });
}

// 3. AI 기반 토론 흐름 트렌드 면적 그래프
function renderTrendChartFromAI(trendData) {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;

    // AI가 제공한 트렌드 데이터 사용
    // 예상 구조: {labels: ['#1', '#2', ...], pros: [1, 2, 3, ...], cons: [1, 1, 2, ...]}
    const labels = trendData.labels || [];
    const prosData = trendData.pros || [];
    const consData = trendData.cons || [];

    // 기존 차트 파괴
    if (trendChartInstance) {
        trendChartInstance.destroy();
    }

    // 차트 생성
    trendChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '찬성 발언',
                    data: prosData,
                    backgroundColor: 'rgba(16, 185, 129, 0.3)',
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: '반대 발언',
                    data: consData,
                    backgroundColor: 'rgba(239, 68, 68, 0.3)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: '메시지 순서'
                    },
                    ticks: {
                        maxTicksLimit: 10
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: '누적 발언 수'
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// 4. 핵심 키워드 트렌드 면적 그래프
function renderKeywordChartFromAI(keywordData) {
    const canvas = document.getElementById('keywordChart');
    if (!canvas) return;

    // AI가 제공한 키워드 트렌드 데이터 사용
    // 예상 구조: {keywords: ['초반', '유튜브', ...], phases: ['초반', '중반', '후반'], data: [[8,5,3], [7,6,4], ...]}
    const keywords = keywordData.keywords || [];
    const phases = keywordData.phases || ['초반', '중반', '후반'];
    const data = keywordData.data || [];

    // 데이터가 없으면 차트를 숨기고 안내 메시지 표시
    if (keywords.length === 0 || data.length === 0) {
        const wrapper = canvas.parentElement;
        wrapper.innerHTML = '<p style="text-align: center; padding: 4rem; color: #9ca3af;">AI 분석 중 키워드 데이터를 추출하지 못했습니다.<br>토론이 더 진행된 후 다시 분석해주세요.</p>';
        return;
    }

    // 데이터셋 생성 (각 키워드별로)
    const colors = [
        'rgba(239, 68, 68, 0.6)',     // 빨강
        'rgba(59, 130, 246, 0.6)',    // 파랑
        'rgba(16, 185, 129, 0.6)',    // 초록
        'rgba(245, 158, 11, 0.6)',    // 주황
        'rgba(139, 92, 246, 0.6)',    // 보라
        'rgba(236, 72, 153, 0.6)',    // 핑크
        'rgba(20, 184, 166, 0.6)'     // 청록
    ];

    const datasets = keywords.map((keyword, idx) => {
        const color = colors[idx % colors.length];
        return {
            label: keyword,
            data: data[idx] || [],
            backgroundColor: color,
            borderColor: color.replace('0.6', '1'),
            borderWidth: 2,
            fill: true,
            tension: 0.4
        };
    });

    // 기존 차트 파괴
    if (keywordChartInstance) {
        keywordChartInstance.destroy();
    }

    // 차트 생성
    keywordChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels: phases,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: '토론 진행 단계'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: '키워드 언급 빈도'
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',  // 하단에 키워드 목록 표시
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        },
                        usePointStyle: true,  // 박스 대신 점(원형)으로 표시
                        pointStyle: 'circle',  // 원형 점
                        generateLabels: function(chart) {
                            const data = chart.data;
                            if (data.datasets.length) {
                                return data.datasets.map((dataset, i) => {
                                    // 총 빈도수 계산
                                    const total = dataset.data.reduce((sum, val) => sum + val, 0);
                                    return {
                                        text: `${dataset.label}: ${total}`,
                                        fillStyle: dataset.backgroundColor,
                                        strokeStyle: dataset.borderColor,
                                        lineWidth: dataset.borderWidth,
                                        hidden: false,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// 2. 참여자 상호작용 레이더 차트 (기존 버전 - 사용 안 함)
function renderInteractionChart(messages) {
    const canvas = document.getElementById('interactionChart');
    if (!canvas) return;

    // 참여자별 상호작용 지표 계산
    const participants = {};
    messages.forEach((msg, index) => {
        const name = msg.author || 'Unknown';
        if (!participants[name]) {
            participants[name] = {
                messageCount: 0,
                avgLength: 0,
                totalLength: 0,
                responses: 0  // 다른 사람 메시지 이후 발언
            };
        }
        participants[name].messageCount++;
        participants[name].totalLength += (msg.message || '').length;

        // 응답 카운트 (이전 메시지가 다른 사람이면 응답으로 간주)
        if (index > 0 && messages[index - 1].author !== name) {
            participants[name].responses++;
        }
    });

    // 평균 길이 계산
    Object.keys(participants).forEach(name => {
        const p = participants[name];
        p.avgLength = p.totalLength / p.messageCount;
    });

    const labels = Object.keys(participants);
    const datasets = labels.map((name, idx) => {
        const p = participants[name];
        const msg = messages.find(m => m.author === name);
        let color = 'rgba(107, 114, 128, 0.6)';
        if (msg && msg.role === '찬성') color = 'rgba(16, 185, 129, 0.6)';
        if (msg && msg.role === '반대') color = 'rgba(239, 68, 68, 0.6)';

        return {
            label: name,
            data: [
                p.messageCount,              // 발언 횟수
                p.responses,                 // 응답 횟수
                p.avgLength / 10             // 평균 발언 길이 (스케일 조정)
            ],
            backgroundColor: color,
            borderColor: color.replace('0.6', '1'),
            borderWidth: 2
        };
    });

    // 기존 차트 파괴
    if (interactionChartInstance) {
        interactionChartInstance.destroy();
    }

    // 차트 생성
    interactionChartInstance = new Chart(canvas, {
        type: 'radar',
        data: {
            labels: ['발언 횟수', '응답 횟수', '평균 발언 길이'],
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 5
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

// 3. 토론 흐름 트렌드 면적 그래프
function renderTrendChart(messages) {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;

    // 시간 순서대로 찬성/반대 메시지 누적 카운트
    const prosCount = [];
    const consCount = [];
    const labels = [];

    let prosTotal = 0;
    let consTotal = 0;

    messages.forEach((msg, index) => {
        if (msg.role === '찬성') {
            prosTotal++;
        } else if (msg.role === '반대') {
            consTotal++;
        }

        prosCount.push(prosTotal);
        consCount.push(consTotal);
        labels.push(`#${index + 1}`);
    });

    // 기존 차트 파괴
    if (trendChartInstance) {
        trendChartInstance.destroy();
    }

    // 차트 생성
    trendChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '찬성 발언',
                    data: prosCount,
                    backgroundColor: 'rgba(16, 185, 129, 0.3)',
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: '반대 발언',
                    data: consCount,
                    backgroundColor: 'rgba(239, 68, 68, 0.3)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: '메시지 순서'
                    },
                    ticks: {
                        maxTicksLimit: 10
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: '누적 발언 수'
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// ========================================== AI 판결문 탭 ==========================================

let verdictResult = null;

// AI 판결문 생성 버튼
const startVerdictBtn = document.getElementById('startVerdictBtn');
if (startVerdictBtn) {
    startVerdictBtn.addEventListener('click', async () => {
        const messages = collectChatMessages();

        // 최소 10개 메시지 체크
        if (messages.length < 10) {
            alert('AI 판결문을 생성하려면 최소 10개 이상의 메시지가 필요합니다.');
            return;
        }

        // 뷰 전환: 시작 -> 로딩
        document.getElementById('verdict-start-view').style.display = 'none';
        document.getElementById('verdict-loading-view').style.display = 'block';

        try {
            // Gemini API 호출
            const response = await fetch('/api/generate-verdict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    discussion_id: currentDiscussionId,
                    messages: messages
                })
            });

            if (!response.ok) {
                throw new Error('판결문 생성 실패');
            }

            const result = await response.json();
            verdictResult = result;

            // 결과 렌더링
            renderVerdictResult(result);

            // 뷰 전환: 로딩 -> 결과
            document.getElementById('verdict-loading-view').style.display = 'none';
            document.getElementById('verdict-result-view').style.display = 'block';

        } catch (error) {
            console.error('AI 판결문 생성 오류:', error);
            alert('AI 판결문 생성 중 오류가 발생했습니다: ' + error.message);

            // 뷰 전환: 로딩 -> 시작
            document.getElementById('verdict-loading-view').style.display = 'none';
            document.getElementById('verdict-start-view').style.display = 'block';
        }
    });
}

// 판결문 결과 렌더링
function renderVerdictResult(result) {
    // 서론 - 토론 개요
    if (result.overview) {
        document.getElementById('verdictOverview').textContent = result.overview;
    }

    // 서론 - 논의 배경
    if (result.background) {
        document.getElementById('verdictBackground').textContent = result.background;
    }

    // 서론 - 주요 쟁점
    if (result.issues && Array.isArray(result.issues)) {
        const issuesContainer = document.getElementById('verdictIssues');
        issuesContainer.innerHTML = '';
        result.issues.forEach((issue, index) => {
            const issueP = document.createElement('p');
            issueP.textContent = `${index + 1}. ${issue}`;
            issueP.style.marginBottom = '0.5rem';
            issuesContainer.appendChild(issueP);
        });
    }

    // 본론 - 쟁점별 분석
    if (result.main_body && Array.isArray(result.main_body)) {
        const mainBodyContainer = document.getElementById('verdictMainBody');
        mainBodyContainer.innerHTML = '';

        result.main_body.forEach((issueData, index) => {
            // 쟁점 섹션
            const issueSection = document.createElement('div');
            issueSection.className = 'verdict-section';

            // 쟁점 제목
            const issueTitle = document.createElement('h4');
            issueTitle.textContent = issueData.issue_title;
            issueSection.appendChild(issueTitle);

            // 주요 주장 요약
            if (issueData.arguments_summary) {
                const summaryTitle = document.createElement('h5');
                summaryTitle.textContent = '주요 주장 요약';
                summaryTitle.style.fontSize = '1rem';
                summaryTitle.style.fontWeight = '600';
                summaryTitle.style.color = '#6b7280';
                summaryTitle.style.marginTop = '1rem';
                summaryTitle.style.marginBottom = '0.75rem';
                issueSection.appendChild(summaryTitle);

                // 찬성 측
                if (issueData.arguments_summary.pros) {
                    const prosP = document.createElement('p');
                    prosP.innerHTML = `<strong>찬성 측:</strong> ${issueData.arguments_summary.pros}`;
                    prosP.style.marginBottom = '0.75rem';
                    issueSection.appendChild(prosP);
                }

                // 반대 측
                if (issueData.arguments_summary.cons) {
                    const consP = document.createElement('p');
                    consP.innerHTML = `<strong>반대 측:</strong> ${issueData.arguments_summary.cons}`;
                    consP.style.marginBottom = '0.75rem';
                    issueSection.appendChild(consP);
                }

                // AI 조언자
                if (issueData.arguments_summary.ai) {
                    const aiP = document.createElement('p');
                    aiP.innerHTML = `<strong>AI 조언자:</strong> ${issueData.arguments_summary.ai}`;
                    aiP.style.marginBottom = '0.75rem';
                    issueSection.appendChild(aiP);
                }
            }

            // 논거 및 반박 분석
            if (issueData.analysis) {
                const analysisTitle = document.createElement('h5');
                analysisTitle.textContent = '논거 및 반박 분석';
                analysisTitle.style.fontSize = '1rem';
                analysisTitle.style.fontWeight = '600';
                analysisTitle.style.color = '#6b7280';
                analysisTitle.style.marginTop = '1rem';
                analysisTitle.style.marginBottom = '0.75rem';
                issueSection.appendChild(analysisTitle);

                const analysisP = document.createElement('p');
                analysisP.textContent = issueData.analysis;
                issueSection.appendChild(analysisP);
            }

            mainBodyContainer.appendChild(issueSection);
        });
    }

    // 특이점 및 인사이트
    if (result.insights) {
        document.getElementById('verdictInsights').textContent = result.insights;
    }

    // 결론 - 토론 결과 요약
    if (result.summary) {
        document.getElementById('verdictSummary').textContent = result.summary;
    }

    // 결론 - 미해결 과제 및 제언
    if (result.recommendations) {
        document.getElementById('verdictRecommendations').textContent = result.recommendations;
    }

    // 결론 - 토론의 의의
    if (result.significance) {
        document.getElementById('verdictSignificance').textContent = result.significance;
    }
}

// 다시 작성하기 버튼
const rewriteVerdictBtn = document.getElementById('rewriteVerdictBtn');
if (rewriteVerdictBtn) {
    rewriteVerdictBtn.addEventListener('click', () => {
        // 뷰 초기화
        document.getElementById('verdict-result-view').style.display = 'none';
        document.getElementById('verdict-start-view').style.display = 'block';
        verdictResult = null;
    });
}

// 판결문 PDF 다운로드 버튼 (서버 API 사용 - PDFKit)
const downloadVerdictPdfBtn = document.getElementById('downloadVerdictPdfBtn');
if (downloadVerdictPdfBtn) {
    downloadVerdictPdfBtn.addEventListener('click', async () => {
        if (!verdictResult) {
            alert('판결문이 없습니다.');
            return;
        }

        try {
            console.log('📄 서버에 PDF 생성 요청...');

            // 서버 API 호출
            const response = await fetch(`/api/discussions/${currentDiscussionId}/generate-verdict-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    verdictData: verdictResult,
                    discussionTitle: discussionInfo?.title || '토론'
                })
            });

            if (!response.ok) {
                throw new Error('PDF 생성 실패');
            }

            // Blob으로 변환
            const blob = await response.blob();

            // 다운로드
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `verdict-${currentDiscussionId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            console.log('✅ PDF 다운로드 완료');

        } catch (error) {
            console.error('판결문 PDF 다운로드 오류:', error);
            alert('판결문 PDF 다운로드 중 오류가 발생했습니다: ' + error.message);
        }
    });
}

// Toast notification 함수
function showToast(message, type = 'info') {
    // Toast 컨테이너가 없으면 생성
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        toast.innerHTML = `
            <i class="toast-icon"></i>
            <span class="toast-message"></span>
        `;
        document.body.appendChild(toast);
    }

    const toastIcon = toast.querySelector('.toast-icon');
    const toastMessage = toast.querySelector('.toast-message');

    // Reset classes
    toast.className = 'toast';

    // Set icon based on type
    switch (type) {
        case 'success':
            toastIcon.className = 'toast-icon fas fa-check-circle';
            toast.classList.add('success');
            break;
        case 'error':
            toastIcon.className = 'toast-icon fas fa-exclamation-circle';
            toast.classList.add('error');
            break;
        case 'info':
        default:
            toastIcon.className = 'toast-icon fas fa-info-circle';
            toast.classList.add('info');
            break;
    }

    toastMessage.textContent = message;
    toast.classList.add('show');

    // Auto hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
