// Global variables
let currentDiscussions = [];
let currentDiscussion = null;
let searchTimeout = null;
let currentStep = 1;
let isTeacher = false; // 교사 권한 플래그
let currentFilters = {
    search: '',
    sort: 'recent',
    type: ''
};

// 로컬 스토리지에 저장된 토론방 데이터
let localDiscussions = JSON.parse(localStorage.getItem('localDiscussions') || '[]');

// DOM Elements
const loadingOverlay = document.getElementById('loadingOverlay');
const discussionsGrid = document.getElementById('discussionsGrid');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const typeFilter = document.getElementById('typeFilter');
const newDiscussionModal = document.getElementById('newDiscussionModal');
const discussionDetailModal = document.getElementById('discussionDetailModal');
const toast = document.getElementById('toast');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    checkTeacherStatus();
});

// 교사 권한 확인
function checkTeacherStatus() {
    // localStorage에서 교사 권한 확인
    const teacherPassword = localStorage.getItem('teacherPassword');
    if (teacherPassword === 'teacher123') {
        isTeacher = true;
        addTeacherBadge();
    }
}

// 교사 배지 추가
function addTeacherBadge() {
    const header = document.querySelector('.app-header h1');
    if (header && !header.querySelector('.teacher-badge')) {
        const badge = document.createElement('span');
        badge.className = 'teacher-badge';
        badge.textContent = '교사';
        header.appendChild(badge);
    }
}

async function initializeApp() {
    showLoading();
    try {
        await loadDiscussions();
    } catch (error) {
        console.error('앱 초기화 오류:', error);
        showToast('앱을 초기화하는 중 오류가 발생했습니다.', 'error');
    } finally {
        hideLoading();
    }
}

function setupEventListeners() {
    // Search input
    searchInput.addEventListener('input', handleSearch);

    // Sort select
    sortSelect.addEventListener('change', handleSort);

    // Type filter
    const typeButtons = document.querySelectorAll('[data-type]');
    typeButtons.forEach(btn => {
        btn.addEventListener('click', handleTypeFilter);
    });

    // Modal forms
    const newDiscussionForm = document.getElementById('newDiscussionForm');
    if (newDiscussionForm) {
        newDiscussionForm.addEventListener('submit', handleNewDiscussion);
    }

    const opinionForm = document.getElementById('opinionForm');
    if (opinionForm) {
        opinionForm.addEventListener('submit', handleOpinionSubmit);
    }

    // Auto-refresh every 30 seconds
    setInterval(refreshDiscussions, 30000);
}

// 3단계 모달 네비게이션
function nextStep() {
    if (currentStep < 3) {
        // 현재 단계 유효성 검사
        if (!validateStep(currentStep)) {
            return;
        }

        document.getElementById(`step${currentStep}`).style.display = 'none';
        currentStep++;
        document.getElementById(`step${currentStep}`).style.display = 'block';

        updateStepIndicator();
        updateButtons();

        // Step 3에서 역할 미리보기 업데이트
        if (currentStep === 3) {
            updateRolePreview();
        }
    }
}

function previousStep() {
    if (currentStep > 1) {
        document.getElementById(`step${currentStep}`).style.display = 'none';
        currentStep--;
        document.getElementById(`step${currentStep}`).style.display = 'block';

        updateStepIndicator();
        updateButtons();
    }
}

function validateStep(step) {
    if (step === 1) {
        const title = document.getElementById('discussionTitle').value.trim();
        const author = document.getElementById('discussionAuthor').value.trim();
        const password = document.getElementById('discussionPassword').value.trim();

        if (!title || !author || !password) {
            showToast('모든 필수 항목을 입력해주세요.', 'error');
            return false;
        }
    }
    return true;
}

function updateStepIndicator() {
    const steps = document.querySelectorAll('.step');
    const labels = document.querySelectorAll('.step-label');

    steps.forEach((step, index) => {
        if (index + 1 < currentStep) {
            step.classList.add('completed');
            step.classList.remove('active');
        } else if (index + 1 === currentStep) {
            step.classList.add('active');
            step.classList.remove('completed');
        } else {
            step.classList.remove('active', 'completed');
        }
    });

    labels.forEach((label, index) => {
        if (index + 1 === currentStep) {
            label.classList.add('active');
        } else {
            label.classList.remove('active');
        }
    });
}

function updateButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const submitBtn = document.getElementById('submitBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    if (currentStep === 1) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'block';
        submitBtn.style.display = 'none';
        cancelBtn.style.display = 'block';
    } else if (currentStep === 2) {
        prevBtn.style.display = 'block';
        nextBtn.style.display = 'block';
        submitBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
    } else if (currentStep === 3) {
        prevBtn.style.display = 'block';
        nextBtn.style.display = 'none';
        submitBtn.style.display = 'block';
        cancelBtn.style.display = 'none';
    }
}

// 모드 변경 처리
function handleModeChange() {
    const selectedMode = document.querySelector('input[name="discussionMode"]:checked').value;
    const prosConsExamples = document.getElementById('prosConsExamples');
    const roleListContainer = document.getElementById('roleListContainer');

    if (selectedMode === '팀전') {
        prosConsExamples.style.display = 'grid';
        roleListContainer.style.display = 'none';
    } else if (selectedMode === '역할극') {
        prosConsExamples.style.display = 'none';
        roleListContainer.style.display = 'block';
    } else {
        prosConsExamples.style.display = 'none';
        roleListContainer.style.display = 'none';
    }
}

// 역할 미리보기 업데이트
function updateRolePreview() {
    const selectedMode = document.querySelector('input[name="discussionMode"]:checked').value;
    const rolePreview = document.getElementById('rolePreview');

    if (selectedMode === '역할극') {
        const roleList = document.getElementById('roleList').value;
        if (roleList) {
            const roles = roleList.split(',').map(role => role.trim()).filter(role => role);
            rolePreview.innerHTML = roles.map(role => `<span class="role-tag">${role}</span>`).join('');
            rolePreview.style.display = 'block';
        } else {
            rolePreview.style.display = 'none';
        }
    } else {
        rolePreview.style.display = 'none';
    }
}

// AI 토론 상황 생성
async function generateAIDescription() {
    const title = document.getElementById('discussionTitle').value.trim();

    if (!title) {
        showToast('토론 제목을 먼저 입력해주세요.', 'warning');
        return;
    }

    const descriptionTextarea = document.getElementById('discussionDescription');

    // AI 생성 시뮬레이션 (실제로는 AI API 호출)
    const aiDescriptions = {
        '착한 사마리아인의 법은 필요한가?': `2024년, 대한민국. 한 거리에서 노인이 쓰러졌지만 아무도 돕지 않아 결국 사망하는 사건이 발생했습니다. 이를 계기로 "착한 사마리아인 법" 제정에 대한 논의가 활발해졌습니다.

찬성 측은 위험에 처한 사람을 도와야 할 도덕적 의무를 법으로 강제해야 한다고 주장합니다. 반대 측은 개인의 자유를 침해하고 오히려 더 큰 피해를 야기할 수 있다고 우려합니다.

이 토론에서는 개인의 자유와 사회적 책임 사이의 균형점을 찾아보고자 합니다.`,

        '인공지능이 인간의 일자리를 대체할 것인가?': `2030년까지 AI 기술의 발전으로 현재 직업의 30%가 사라질 것이라는 예측이 나왔습니다.

찬성 측은 단순 반복 작업뿐만 아니라 창의적 영역까지 AI가 대체할 것이라 주장합니다. 반대 측은 AI가 새로운 일자리를 창출하고 인간과 협업하는 도구가 될 것이라 반박합니다.

기술 발전과 고용 시장의 미래에 대해 깊이 있는 토론을 진행합니다.`,

        'default': `이 토론은 ${title}에 대한 다양한 관점과 의견을 나누는 공간입니다.

참여자들은 자유롭게 자신의 생각을 표현하고, 서로의 의견을 존중하며 건설적인 대화를 나눌 수 있습니다.

논리적 근거와 실제 사례를 바탕으로 깊이 있는 토론을 진행해 주시기 바랍니다.`
    };

    // AI 생성 애니메이션 효과
    descriptionTextarea.value = '토론 상황을 생성하는 중...';
    descriptionTextarea.disabled = true;

    setTimeout(() => {
        const description = aiDescriptions[title] || aiDescriptions.default;
        descriptionTextarea.value = description;
        descriptionTextarea.disabled = false;
        showToast('AI가 토론 상황을 생성했습니다. 수정이 가능합니다.', 'success');
    }, 1500);
}

// 새 토론 생성 처리
async function handleNewDiscussion(e) {
    e.preventDefault();

    const formData = {
        title: document.getElementById('discussionTitle').value.trim(),
        type: document.querySelector('input[name="discussionMode"]:checked').value,
        author: document.getElementById('discussionAuthor').value.trim(),
        password: document.getElementById('discussionPassword').value.trim(),
        description: document.getElementById('discussionDescription').value.trim(),
        duration: parseInt(document.getElementById('discussionDuration').value) * 24, // 일 -> 시간
        prosName: document.getElementById('prosName')?.value || '찬성',
        consName: document.getElementById('consName')?.value || '반대',
        roleList: document.getElementById('roleList')?.value || ''
    };

    if (!formData.title || !formData.author || !formData.password) {
        showToast('필수 항목을 모두 입력해주세요.', 'error');
        return;
    }

    try {
        showLoading();

        // API를 통해 새 토론 생성
        try {
            const response = await fetch('/api/discussions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('API를 통해 토론 생성 성공:', result);

        } catch (apiError) {
            console.error('API 호출 실패, 로컬 스토리지 폴백:', apiError);

            // API 실패 시 로컬 스토리지 폴백
            const newDiscussion = {
                id: Date.now(),
                ...formData,
                participants: 0,
                created_at: new Date(),
                expires_at: new Date(Date.now() + formData.duration * 60 * 60 * 1000),
                pros: [],
                cons: []
            };

            // 로컬 스토리지에 저장
            localDiscussions.unshift(newDiscussion);
            localStorage.setItem('localDiscussions', JSON.stringify(localDiscussions));
        }

        closeNewDiscussionModal();
        showToast('새 토론이 생성되었습니다!', 'success');
        await loadDiscussions();

    } catch (error) {
        console.error('토론 생성 오류:', error);
        showToast('토론을 생성할 수 없습니다.', 'error');
    } finally {
        hideLoading();
    }
}

// 토론방 카드 렌더링
function renderDiscussionCard(discussion) {
    const card = document.createElement('div');
    card.className = 'discussion-card';
    card.innerHTML = `
        <div class="card-header">
            <h3>${escapeHtml(discussion.title)}</h3>
            <span class="type-badge type-${discussion.type}">${discussion.type}</span>
        </div>
        <div class="card-body">
            <p class="card-description">${escapeHtml(discussion.description || '토론 설명이 없습니다.')}</p>
            <div class="card-meta">
                <span><i class="fas fa-user"></i> ${escapeHtml(discussion.author)}</span>
                <span><i class="fas fa-users"></i> ${discussion.participants || 0}명</span>
                <span><i class="fas fa-clock"></i> ${discussion.timeRemaining || calculateTimeRemaining(discussion.expires_at)}</span>
            </div>
        </div>
        ${renderActionButtons(discussion)}
    `;

    // 카드 클릭 이벤트
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.action-buttons')) {
            openDiscussionDetail(discussion);
        }
    });

    return card;
}

// 수정/삭제 버튼 렌더링
function renderActionButtons(discussion) {
    // 교사이거나 작성자인 경우 버튼 표시
    const canEdit = isTeacher || checkOwnership(discussion);

    if (canEdit) {
        return `
            <div class="action-buttons">
                <button class="btn-edit" onclick="editDiscussion(${discussion.id}, event)">
                    <i class="fas fa-edit"></i> 수정
                </button>
                <button class="btn-delete" onclick="deleteDiscussion(${discussion.id}, event)">
                    <i class="fas fa-trash"></i> 삭제
                </button>
            </div>
        `;
    }
    return '';
}

// 소유권 확인
function checkOwnership(discussion) {
    const savedPassword = localStorage.getItem(`discussion_${discussion.id}_password`);
    return savedPassword === discussion.password;
}

// 토론 수정
async function editDiscussion(id, event) {
    event.stopPropagation();

    const discussion = currentDiscussions.find(d => d.id === id);
    if (!discussion) return;

    // 교사가 아닌 경우 비밀번호 확인
    if (!isTeacher) {
        const password = prompt('비밀번호를 입력하세요:');
        if (password !== discussion.password) {
            showToast('비밀번호가 일치하지 않습니다.', 'error');
            return;
        }
    }

    // 수정 모달 열기 (새 토론 모달 재사용)
    openNewDiscussionModal();

    // 기존 데이터로 폼 채우기
    document.getElementById('discussionTitle').value = discussion.title;
    document.getElementById('discussionAuthor').value = discussion.author;
    document.getElementById('discussionDescription').value = discussion.description || '';

    // 수정 모드로 변경
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.textContent = '수정';
    submitBtn.dataset.editId = id;
}

// 토론 삭제
async function deleteDiscussion(id, event) {
    event.stopPropagation();

    const discussion = currentDiscussions.find(d => d.id === id);
    if (!discussion) return;

    // 교사가 아닌 경우 비밀번호 확인
    if (!isTeacher) {
        const password = prompt('비밀번호를 입력하세요:');
        if (password !== discussion.password) {
            showToast('비밀번호가 일치하지 않습니다.', 'error');
            return;
        }
    }

    if (!confirm('정말 이 토론을 삭제하시겠습니까?')) {
        return;
    }

    try {
        // API를 통해 삭제
        const response = await fetch(`/api/discussions/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ author: discussion.author })
        });

        if (!response.ok) {
            throw new Error('삭제 실패');
        }

        showToast('토론이 삭제되었습니다.', 'success');
        await loadDiscussions();

    } catch (error) {
        console.error('삭제 오류:', error);

        // 로컬 스토리지 폴백
        const index = localDiscussions.findIndex(d => d.id === id);
        if (index > -1) {
            localDiscussions.splice(index, 1);
            localStorage.setItem('localDiscussions', JSON.stringify(localDiscussions));
            await loadDiscussions();
            showToast('토론이 삭제되었습니다.', 'success');
        } else {
            showToast('토론을 삭제할 수 없습니다.', 'error');
        }
    }
}

// 토론 목록 로드
async function loadDiscussions() {
    console.log('토론 목록 로드 시작...');

    try {
        // API로부터 데이터 로드
        const response = await fetch(`/api/discussions?search=${encodeURIComponent(currentFilters.search)}&sort=${currentFilters.sort}&type=${encodeURIComponent(currentFilters.type)}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const discussions = await response.json();
        currentDiscussions = discussions;

        console.log('API로부터 토론 목록 로드 완료, 총', discussions.length, '개의 토론방');
        renderDiscussions();

    } catch (error) {
        console.error('API 호출 실패, 로컬 스토리지 폴백:', error);

        // API 실패 시 로컬 스토리지 폴백
        localDiscussions = JSON.parse(localStorage.getItem('localDiscussions') || '[]');
        let discussions = [...localDiscussions];

        // 필터 적용
        if (currentFilters.search) {
            const searchLower = currentFilters.search.toLowerCase();
            discussions = discussions.filter(d =>
                d.title.toLowerCase().includes(searchLower) ||
                d.author.toLowerCase().includes(searchLower) ||
                d.type.toLowerCase().includes(searchLower)
            );
        }

        if (currentFilters.type) {
            discussions = discussions.filter(d => d.type === currentFilters.type);
        }

        // 정렬
        if (currentFilters.sort === 'participants') {
            discussions.sort((a, b) => b.participants - a.participants);
        } else {
            discussions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        currentDiscussions = discussions;
        console.log('로컬 스토리지로부터 토론 목록 로드 완료, 총', discussions.length, '개의 토론방');
        renderDiscussions();
    }
}

// 토론 목록 렌더링
function renderDiscussions() {
    console.log('토론방 렌더링 시작, 토론 수:', currentDiscussions.length);

    if (currentDiscussions.length === 0) {
        discussionsGrid.style.display = 'none';
        emptyState.style.display = 'flex';
    } else {
        discussionsGrid.style.display = 'grid';
        emptyState.style.display = 'none';

        discussionsGrid.innerHTML = '';
        currentDiscussions.forEach(discussion => {
            const card = renderDiscussionCard(discussion);
            discussionsGrid.appendChild(card);
        });
    }
}

// 시간 계산
function calculateTimeRemaining(expiresAt) {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires - now;

    if (diff <= 0) return '만료됨';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
        return `${days}일 ${hours}시간`;
    }
    return `${hours}시간`;
}

// 모달 관련 함수들
function openNewDiscussionModal() {
    newDiscussionModal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    currentStep = 1;
    updateStepIndicator();
    updateButtons();

    // 폼 초기화
    document.getElementById('newDiscussionForm').reset();
    document.getElementById('step1').style.display = 'block';
    document.getElementById('step2').style.display = 'none';
    document.getElementById('step3').style.display = 'none';
}

function closeNewDiscussionModal() {
    newDiscussionModal.style.display = 'none';
    document.body.style.overflow = '';

    // 수정 모드 초기화
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.textContent = '생성';
    delete submitBtn.dataset.editId;
}

function openDiscussionDetail(discussion) {
    currentDiscussion = discussion;

    // 상세 정보 설정
    document.getElementById('detailTitle').textContent = discussion.title;
    document.getElementById('detailAuthor').textContent = `작성자: ${discussion.author}`;
    document.getElementById('detailParticipants').textContent = `참여자: ${discussion.participants || 0}명`;
    document.getElementById('detailTimeRemaining').textContent = `남은 시간: ${calculateTimeRemaining(discussion.expires_at)}`;
    document.getElementById('detailType').textContent = discussion.type;
    document.getElementById('detailDescription').textContent = discussion.description || '토론 설명이 없습니다.';

    // 의견 로드
    loadOpinions(discussion.id);

    discussionDetailModal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeDiscussionDetailModal() {
    discussionDetailModal.style.display = 'none';
    document.body.style.overflow = '';
    currentDiscussion = null;
}

// 의견 로드
async function loadOpinions(discussionId) {
    try {
        const response = await fetch(`/api/discussions/${discussionId}`);
        if (response.ok) {
            const data = await response.json();
            renderOpinions(data.pros || [], data.cons || []);
        }
    } catch (error) {
        console.error('의견 로드 실패:', error);
        renderOpinions([], []);
    }
}

// 의견 렌더링
function renderOpinions(pros, cons) {
    const prosContainer = document.getElementById('prosOpinions');
    const consContainer = document.getElementById('consOpinions');
    const prosCount = document.getElementById('prosCount');
    const consCount = document.getElementById('consCount');

    // 찬성 의견
    prosCount.textContent = `${pros.length}개`;
    prosContainer.innerHTML = pros.length > 0 ? pros.map(opinion => `
        <div class="opinion-item">
            <div class="opinion-header">
                <span class="opinion-author">${escapeHtml(opinion.author)}</span>
                <span class="opinion-time">${formatTime(opinion.created_at)}</span>
            </div>
            <p class="opinion-content">${escapeHtml(opinion.content)}</p>
            <div class="opinion-footer">
                <button class="like-button" onclick="likeOpinion(${opinion.id})">
                    <i class="fas fa-thumbs-up"></i> ${opinion.likes_count || 0}
                </button>
            </div>
        </div>
    `).join('') : '<p class="no-opinions">아직 찬성 의견이 없습니다.</p>';

    // 반대 의견
    consCount.textContent = `${cons.length}개`;
    consContainer.innerHTML = cons.length > 0 ? cons.map(opinion => `
        <div class="opinion-item">
            <div class="opinion-header">
                <span class="opinion-author">${escapeHtml(opinion.author)}</span>
                <span class="opinion-time">${formatTime(opinion.created_at)}</span>
            </div>
            <p class="opinion-content">${escapeHtml(opinion.content)}</p>
            <div class="opinion-footer">
                <button class="like-button" onclick="likeOpinion(${opinion.id})">
                    <i class="fas fa-thumbs-up"></i> ${opinion.likes_count || 0}
                </button>
            </div>
        </div>
    `).join('') : '<p class="no-opinions">아직 반대 의견이 없습니다.</p>';
}

// 의견 제출
async function handleOpinionSubmit(e) {
    e.preventDefault();

    if (!currentDiscussion) return;

    const formData = {
        author: document.getElementById('opinionAuthor').value.trim(),
        content: document.getElementById('opinionContent').value.trim(),
        opinion_type: document.querySelector('input[name="opinionType"]:checked').value
    };

    if (!formData.author || !formData.content) {
        showToast('이름과 내용을 모두 입력해주세요.', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/discussions/${currentDiscussion.id}/opinions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            showToast('의견이 등록되었습니다!', 'success');
            document.getElementById('opinionForm').reset();
            await loadOpinions(currentDiscussion.id);
        } else {
            throw new Error('의견 등록 실패');
        }
    } catch (error) {
        console.error('의견 등록 오류:', error);
        showToast('의견을 등록할 수 없습니다.', 'error');
    }
}

// 좋아요
async function likeOpinion(opinionId) {
    try {
        const response = await fetch(`/api/opinions/${opinionId}/like`, {
            method: 'POST'
        });

        if (response.ok) {
            await loadOpinions(currentDiscussion.id);
        }
    } catch (error) {
        console.error('좋아요 오류:', error);
    }
}

// 검색 처리
function handleSearch(e) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        currentFilters.search = e.target.value;
        loadDiscussions();
    }, 300);
}

// 정렬 처리
function handleSort(e) {
    currentFilters.sort = e.target.value;
    loadDiscussions();
}

// 타입 필터
function handleTypeFilter(e) {
    const type = e.target.dataset.type;

    // 활성 상태 토글
    document.querySelectorAll('[data-type]').forEach(btn => {
        btn.classList.remove('active');
    });

    if (currentFilters.type === type) {
        currentFilters.type = '';
    } else {
        currentFilters.type = type;
        e.target.classList.add('active');
    }

    loadDiscussions();
}

// 자동 새로고침
async function refreshDiscussions() {
    if (document.hidden) return;
    await loadDiscussions();
}

// 유틸리티 함수들
function showLoading() {
    loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
}

function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast toast-${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function formatTime(date) {
    const now = new Date();
    const time = new Date(date);
    const diff = now - time;

    if (diff < 60000) return '방금 전';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
    return `${Math.floor(diff / 86400000)}일 전`;
}

// 교사 로그인 (개발자 콘솔에서 사용)
window.teacherLogin = function(password) {
    if (password === 'teacher123') {
        localStorage.setItem('teacherPassword', password);
        isTeacher = true;
        addTeacherBadge();
        loadDiscussions();
        showToast('교사 권한이 활성화되었습니다.', 'success');
        return true;
    }
    return false;
};

// 교사 로그아웃
window.teacherLogout = function() {
    localStorage.removeItem('teacherPassword');
    isTeacher = false;
    location.reload();
};