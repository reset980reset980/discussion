# 🚀 Agora Insights 원본 분석 기반 개선 사항 보고서

## 📊 현재 구현 상태 vs 원본 비교

### ✅ 현재 구현된 기능
1. **토론방 생성/조회/삭제**
2. **의견 작성 시스템 (찬성/반대)**
3. **PostgreSQL 기반 영구 저장**
4. **비밀 토론방 (입장코드)**
5. **기본 필터링 (검색, 정렬)**
6. **Gemini API 연동 준비**

### ❌ 원본에는 있으나 현재 없는 핵심 기능

---

## 🎯 Priority 1: 즉시 구현 필요 (High Priority)

### 1. 실시간 채팅 시스템으로 전환
**현재 상태**: 정적 게시판 (의견 목록 형태)
**원본 방식**: 실시간 채팅방 (메신저 UI)

**필요한 변경사항**:
```
현재: [토론방 리스트] → [상세보기 모달] → [의견 추가 버튼] → [의견 목록]
목표: [토론방 리스트] → [채팅방 입장] → [실시간 채팅 UI] → [메시지 실시간 전송/수신]
```

**기술 스택**:
- Socket.io (WebSocket) 추가
- 채팅 메시지 테이블 생성
- 실시간 동기화 시스템

**예상 개발 기간**: 1-2주

---

### 2. 참여자 관리 시스템
**현재 상태**: 참여자 수만 표시
**원본 방식**: 실시간 참여자 목록 + 역할 표시

**필요한 UI 변경**:
```
[토론방 상세] 화면을 다음과 같이 재구성:

┌─────────────────────────────────────────────┐
│  [토론 제목]                    [닫기]      │
├──────────────────────────┬──────────────────┤
│                          │  📋 참여자 (5명) │
│  💬 실시간 채팅 영역     │  ─────────────── │
│                          │  👤 김철수 (찬성)│
│  [메시지들...]           │  👤 이영희 (반대)│
│                          │  🤖 GPT (중재자) │
│                          │  👤 박민수 (찬성)│
│  ────────────────────    │  👤 최지원 (반대)│
│  💭 메시지 입력창         │                  │
└──────────────────────────┴──────────────────┘
```

**데이터베이스 스키마 추가**:
```sql
CREATE TABLE participants (
    id SERIAL PRIMARY KEY,
    discussion_id INTEGER REFERENCES discussions(id),
    user_id VARCHAR(255),
    user_name VARCHAR(100),
    user_role VARCHAR(50),  -- '찬성', '반대', '중재자', 역할극 이름 등
    socket_id VARCHAR(100),
    is_online BOOLEAN DEFAULT true,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    discussion_id INTEGER REFERENCES discussions(id),
    participant_id INTEGER REFERENCES participants(id),
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'chat',  -- 'chat', 'ai_question', 'system'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**예상 개발 기간**: 1주

---

### 3. 4-Tab 구조로 UI 재설계
**원본 구조**:
```
[토론] [참여자] [AI 분석] [AI 질문]
```

**현재 구조**: 단일 모달

**변경 계획**:
```html
<!-- 토론 상세 모달을 Tabbed 구조로 변경 -->
<div id="discussionDetailModal" class="modal">
    <!-- Tab Header -->
    <div class="tab-header">
        <button class="tab active" data-tab="discussion">💬 토론</button>
        <button class="tab" data-tab="participants">👥 참여자</button>
        <button class="tab" data-tab="analysis">📊 AI 분석</button>
        <button class="tab" data-tab="questions">🤖 AI 질문</button>
    </div>

    <!-- Tab Content -->
    <div class="tab-content active" id="tab-discussion">
        <!-- 실시간 채팅 영역 -->
    </div>

    <div class="tab-content" id="tab-participants">
        <!-- 참여자 목록 및 통계 -->
    </div>

    <div class="tab-content" id="tab-analysis">
        <!-- AI 분석 결과 (요약, 그래프, 타임라인) -->
    </div>

    <div class="tab-content" id="tab-questions">
        <!-- AI가 생성한 질문 카드 -->
    </div>
</div>
```

**예상 개발 기간**: 3-5일

---

## 🚀 Priority 2: 단기 목표 (Medium Priority)

### 4. 동적 역할 선택 시스템
**현재**: 토론 생성 시 유형만 선택 (팀전/자유/역할극)
**원본**: 입장 시 AI가 생성한 역할 목록에서 선택

**구현 방법**:
```javascript
// 1. 토론 생성 시 AI가 역할 생성
async function generateRoles(topic, mode) {
    const prompt = `
    토론 주제: ${topic}
    토론 유형: ${mode}

    이 토론에 적합한 8가지 역할을 생성해주세요.
    (예: 법학 교수, 의사, 변호사, 시민단체 활동가, 학생 등)

    JSON 형식으로 반환:
    ["역할1", "역할2", "역할3", ...]
    `;

    const response = await callGeminiAPI(prompt);
    return JSON.parse(response);
}

// 2. 입장 시 역할 선택 모달 표시
function showRoleSelectionModal(roles, discussionId) {
    const modal = document.getElementById('roleSelectionModal');
    const roleList = document.getElementById('roleList');

    roleList.innerHTML = roles.map(role => `
        <div class="role-option" onclick="selectRole('${role}', ${discussionId})">
            <span class="role-name">${role}</span>
            <span class="role-count">2/5</span>
        </div>
    `).join('');

    modal.style.display = 'block';
}
```

**필요한 API 엔드포인트**:
```javascript
// server.js에 추가
app.post('/api/discussions/:id/generate-roles', async (req, res) => {
    const { topic, mode } = req.body;
    const roles = await generateRoles(topic, mode);

    // 역할 목록 DB 저장
    await query(
        'UPDATE discussions SET roles = $1 WHERE id = $2',
        [JSON.stringify(roles), req.params.id]
    );

    res.json({ roles });
});
```

**데이터베이스 변경**:
```sql
ALTER TABLE discussions ADD COLUMN roles JSONB;
```

**예상 개발 기간**: 1주

---

### 5. QR 코드 & 단축 URL 시스템
**원본 기능**:
- QR 코드 자동 생성
- 커스텀 단축 URL (예: discussion.keesdconsulting.uk/s/choco)
- 입장 코드와 연동

**필요한 패키지**:
```bash
npm install qrcode shortid
```

**구현 코드**:
```javascript
// QR 코드 생성
const QRCode = require('qrcode');
const shortid = require('shortid');

// 공유하기 버튼 클릭 시
async function generateShareLink(discussionId) {
    // 단축 URL 생성
    const shortCode = shortid.generate();
    const fullUrl = `https://discussion.keesdconsulting.uk/room/${discussionId}`;
    const shortUrl = `https://discussion.keesdconsulting.uk/s/${shortCode}`;

    // DB에 저장
    await query(
        'INSERT INTO short_urls (short_code, discussion_id, original_url) VALUES ($1, $2, $3)',
        [shortCode, discussionId, fullUrl]
    );

    // QR 코드 생성
    const qrCodeDataUrl = await QRCode.toDataURL(shortUrl);

    return {
        shortUrl,
        qrCode: qrCodeDataUrl,
        entryCode: discussion.entry_code
    };
}

// 공유 모달 UI
function showShareModal(shareData) {
    document.getElementById('qrCodeImage').src = shareData.qrCode;
    document.getElementById('shortUrl').value = shareData.shortUrl;
    document.getElementById('entryCode').textContent = shareData.entryCode;
    document.getElementById('shareModal').style.display = 'block';
}
```

**DB 스키마**:
```sql
CREATE TABLE short_urls (
    id SERIAL PRIMARY KEY,
    short_code VARCHAR(20) UNIQUE,
    discussion_id INTEGER REFERENCES discussions(id),
    original_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    click_count INTEGER DEFAULT 0
);

-- 단축 URL 리다이렉션 API
app.get('/s/:shortCode', async (req, res) => {
    const result = await query(
        'SELECT original_url FROM short_urls WHERE short_code = $1',
        [req.params.shortCode]
    );

    if (result.length > 0) {
        // 클릭 수 증가
        await query(
            'UPDATE short_urls SET click_count = click_count + 1 WHERE short_code = $1',
            [req.params.shortCode]
        );

        res.redirect(result[0].original_url);
    } else {
        res.status(404).send('링크를 찾을 수 없습니다.');
    }
});
```

**예상 개발 기간**: 3-5일

---

## 🤖 Priority 3: AI 고도화 (Medium Priority)

### 6. AI 질문 생성 시스템
**원본 방식**: 토론 시작 후 5분 카운트다운 → AI가 질문 생성

**구현 방법**:
```javascript
// 토론 시작 시 타이머 설정
function startAIQuestionTimer(discussionId) {
    const FIVE_MINUTES = 5 * 60 * 1000;

    setTimeout(async () => {
        // 채팅 내역 수집
        const messages = await query(
            'SELECT * FROM messages WHERE discussion_id = $1 ORDER BY created_at ASC',
            [discussionId]
        );

        // AI에게 질문 생성 요청
        const questions = await generateAIQuestions(messages);

        // 질문을 채팅방에 전송 (특별한 UI 카드로 표시)
        io.to(`discussion-${discussionId}`).emit('ai-questions', questions);
    }, FIVE_MINUTES);
}

async function generateAIQuestions(messages) {
    const chatHistory = messages.map(m =>
        `${m.user_name}: ${m.message}`
    ).join('\n');

    const prompt = `
    다음은 토론방의 대화 내용입니다:

    ${chatHistory}

    토론을 활성화하고 심화시킬 수 있는 3가지 질문을 생성해주세요.
    각 질문은 토론 참여자들이 더 깊이 생각하게 만들어야 합니다.

    JSON 배열 형식으로 반환:
    [
        "질문 1",
        "질문 2",
        "질문 3"
    ]
    `;

    const response = await callGeminiAPI(prompt);
    return JSON.parse(response);
}
```

**UI 구현**:
```html
<!-- AI 질문 카드 (일반 채팅 메시지와 구분) -->
<div class="ai-question-card">
    <div class="ai-question-header">
        🤖 AI가 생성한 질문
    </div>
    <div class="ai-questions-list">
        <div class="question-item">
            <span class="question-number">Q1.</span>
            <span class="question-text">이 정책이 소외된 계층에 미칠 영향은 무엇일까요?</span>
        </div>
        <div class="question-item">
            <span class="question-number">Q2.</span>
            <span class="question-text">장기적 관점에서 어떤 부작용이 예상되나요?</span>
        </div>
        <div class="question-item">
            <span class="question-number">Q3.</span>
            <span class="question-text">해외 사례와 비교했을 때 어떤 차이가 있을까요?</span>
        </div>
    </div>
</div>
```

**예상 개발 기간**: 1주

---

### 7. AI 토론 분석 시스템
**원본 기능**:
1. **종합 요약**: 토론 내용 전체 요약
2. **참여도 그래프**: 도넛 차트로 발언 비중
3. **타임라인**: 시간순 주요 발언
4. **키워드 트렌드**: 시간대별 주요 키워드
5. **상호작용 분석**: 레이더 차트
6. **PDF 리포트**: 다운로드 기능

**필요한 패키지**:
```bash
npm install chart.js jspdf jspdf-autotable
```

**구현 단계**:

#### 7.1 토론 요약 생성
```javascript
async function analyzeDicussion(discussionId) {
    const messages = await query(
        'SELECT * FROM messages WHERE discussion_id = $1 ORDER BY created_at ASC',
        [discussionId]
    );

    const chatHistory = messages.map(m =>
        `[${m.created_at}] ${m.user_name} (${m.user_role}): ${m.message}`
    ).join('\n');

    const prompt = `
    다음 토론 내용을 분석하여 JSON 형식으로 반환해주세요:

    ${chatHistory}

    반환 형식:
    {
        "summary": "토론의 전체적인 흐름과 결론을 3-5문장으로 요약",
        "mainArguments": {
            "pros": ["찬성 논점 1", "찬성 논점 2"],
            "cons": ["반대 논점 1", "반대 논점 2"]
        },
        "keywords": ["키워드1", "키워드2", "키워드3"],
        "participationQuality": "토론 품질 평가 (상/중/하)",
        "insights": "토론에서 얻을 수 있는 통찰"
    }
    `;

    const response = await callGeminiAPI(prompt);
    return JSON.parse(response);
}
```

#### 7.2 참여도 차트
```javascript
function calculateParticipation(messages) {
    const participation = {};

    messages.forEach(msg => {
        if (!participation[msg.user_name]) {
            participation[msg.user_name] = 0;
        }
        participation[msg.user_name]++;
    });

    return participation;
}

function renderParticipationChart(participation) {
    const ctx = document.getElementById('participationChart').getContext('2d');

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(participation),
            datasets: [{
                data: Object.values(participation),
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                title: {
                    display: true,
                    text: '참여자별 발언 비중'
                }
            }
        }
    });
}
```

#### 7.3 타임라인 생성
```javascript
function generateTimeline(messages) {
    return messages.map(msg => ({
        time: new Date(msg.created_at).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
        }),
        author: msg.user_name,
        role: msg.user_role,
        message: msg.message,
        type: msg.user_role === '찬성' ? 'pros' : 'cons'
    }));
}

function renderTimeline(timeline) {
    const timelineHtml = timeline.map(item => `
        <div class="timeline-item ${item.type}">
            <div class="timeline-time">${item.time}</div>
            <div class="timeline-content">
                <div class="timeline-author">${item.author} (${item.role})</div>
                <div class="timeline-message">${item.message}</div>
            </div>
        </div>
    `).join('');

    document.getElementById('timeline-container').innerHTML = timelineHtml;
}
```

#### 7.4 PDF 리포트 생성
```javascript
const jsPDF = require('jspdf');
require('jspdf-autotable');

async function generatePDFReport(discussionId) {
    const discussion = await getDiscussionDetails(discussionId);
    const analysis = await analyzeDicussion(discussionId);
    const messages = await getMessages(discussionId);

    const doc = new jsPDF();

    // 제목
    doc.setFontSize(20);
    doc.text('토론 분석 리포트', 20, 20);

    // 토론 정보
    doc.setFontSize(12);
    doc.text(`토론 주제: ${discussion.title}`, 20, 40);
    doc.text(`작성자: ${discussion.author}`, 20, 50);
    doc.text(`일시: ${new Date(discussion.created_at).toLocaleString('ko-KR')}`, 20, 60);

    // 종합 요약
    doc.setFontSize(14);
    doc.text('📊 종합 요약', 20, 80);
    doc.setFontSize(10);
    doc.text(analysis.summary, 20, 90, { maxWidth: 170 });

    // 주요 논점
    doc.setFontSize(14);
    doc.text('💡 주요 논점', 20, 120);
    doc.setFontSize(10);

    doc.text('찬성:', 20, 130);
    analysis.mainArguments.pros.forEach((arg, i) => {
        doc.text(`  ${i + 1}. ${arg}`, 20, 140 + (i * 10));
    });

    doc.text('반대:', 20, 170);
    analysis.mainArguments.cons.forEach((arg, i) => {
        doc.text(`  ${i + 1}. ${arg}`, 20, 180 + (i * 10));
    });

    // 참여도 테이블
    doc.addPage();
    doc.setFontSize(14);
    doc.text('👥 참여자별 발언 현황', 20, 20);

    const participation = calculateParticipation(messages);
    const tableData = Object.entries(participation).map(([name, count]) => [
        name,
        count,
        `${((count / messages.length) * 100).toFixed(1)}%`
    ]);

    doc.autoTable({
        startY: 30,
        head: [['참여자', '발언 수', '비중']],
        body: tableData
    });

    // PDF 저장
    doc.save(`토론_분석_${discussionId}_${Date.now()}.pdf`);
}
```

**예상 개발 기간**: 2-3주

---

## 📁 데이터베이스 마이그레이션 계획

### 새로 추가할 테이블

```sql
-- 1. 메시지 테이블 (채팅 내역)
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    discussion_id INTEGER REFERENCES discussions(id) ON DELETE CASCADE,
    participant_id INTEGER REFERENCES participants(id),
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'chat',  -- 'chat', 'ai_question', 'system'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_discussion_id ON messages(discussion_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- 2. 참여자 테이블
CREATE TABLE participants (
    id SERIAL PRIMARY KEY,
    discussion_id INTEGER REFERENCES discussions(id) ON DELETE CASCADE,
    user_id VARCHAR(255),
    user_name VARCHAR(100) NOT NULL,
    user_role VARCHAR(50),  -- '찬성', '반대', '중재자', 역할극 이름
    socket_id VARCHAR(100),
    is_online BOOLEAN DEFAULT true,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_participants_discussion_id ON participants(discussion_id);
CREATE INDEX idx_participants_socket_id ON participants(socket_id);

-- 3. 단축 URL 테이블
CREATE TABLE short_urls (
    id SERIAL PRIMARY KEY,
    short_code VARCHAR(20) UNIQUE NOT NULL,
    discussion_id INTEGER REFERENCES discussions(id) ON DELETE CASCADE,
    original_url TEXT NOT NULL,
    qr_code_data TEXT,  -- Base64 encoded QR code image
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    click_count INTEGER DEFAULT 0
);

CREATE INDEX idx_short_urls_short_code ON short_urls(short_code);

-- 4. AI 분석 결과 테이블
CREATE TABLE analysis_results (
    id SERIAL PRIMARY KEY,
    discussion_id INTEGER REFERENCES discussions(id) ON DELETE CASCADE,
    analysis_type VARCHAR(50),  -- 'summary', 'participation', 'timeline', 'keywords'
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analysis_discussion_id ON analysis_results(discussion_id);

-- 5. AI 생성 질문 테이블
CREATE TABLE ai_questions (
    id SERIAL PRIMARY KEY,
    discussion_id INTEGER REFERENCES discussions(id) ON DELETE CASCADE,
    questions JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 기존 테이블 수정

```sql
-- discussions 테이블에 컬럼 추가
ALTER TABLE discussions
ADD COLUMN roles JSONB,  -- AI가 생성한 역할 목록
ADD COLUMN chat_mode BOOLEAN DEFAULT false,  -- 채팅 모드 활성화 여부
ADD COLUMN ai_questions_enabled BOOLEAN DEFAULT true,  -- AI 질문 기능 활성화
ADD COLUMN analysis_enabled BOOLEAN DEFAULT true;  -- AI 분석 기능 활성화
```

---

## 🔧 기술 스택 추가 사항

### 추가 필요 NPM 패키지
```bash
# 실시간 통신
npm install socket.io

# QR 코드 생성
npm install qrcode

# 단축 URL
npm install shortid

# 차트 생성
npm install chart.js

# PDF 생성
npm install jspdf jspdf-autotable

# 날짜 처리
npm install moment
```

### package.json 업데이트
```json
{
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "express": "^4.18.2",
    "pg": "^8.11.0",
    "socket.io": "^4.6.1",
    "qrcode": "^1.5.3",
    "shortid": "^2.2.16",
    "chart.js": "^4.4.0",
    "jspdf": "^2.5.1",
    "jspdf-autotable": "^3.8.0",
    "moment": "^2.29.4"
  }
}
```

---

## 📅 전체 개발 타임라인

### Week 1-2: 기반 전환
- [ ] Socket.io 서버 구축
- [ ] 실시간 채팅 UI 개발
- [ ] 메시지 테이블 생성 및 연동
- [ ] 기존 "의견" → "채팅 메시지"로 전환

### Week 3-4: 참여자 시스템
- [ ] 참여자 관리 테이블 생성
- [ ] 실시간 참여자 목록 UI
- [ ] 역할 선택 시스템
- [ ] 4-Tab 구조로 UI 재설계

### Week 5-6: 공유 기능
- [ ] QR 코드 생성 기능
- [ ] 단축 URL 시스템
- [ ] 공유 모달 UI
- [ ] 소셜 공유 버튼

### Week 7-8: AI 고도화
- [ ] 동적 역할 생성 (Gemini API)
- [ ] 5분 타이머 기반 AI 질문
- [ ] AI 질문 카드 UI

### Week 9-12: 분석 시스템
- [ ] 토론 요약 AI
- [ ] 차트 라이브러리 연동
- [ ] 타임라인 생성
- [ ] PDF 리포트 생성

---

## 🎯 최종 목표 구조

### 완성된 프로젝트 구조
```
discussion/
├── public/
│   ├── index.html          (토론방 리스트)
│   ├── room.html           (채팅방 - 4-Tab 구조)
│   ├── css/
│   │   ├── main.css
│   │   ├── chat.css        (새로 추가)
│   │   └── charts.css      (새로 추가)
│   └── js/
│       ├── app.js          (기존 - 리스트 관리)
│       ├── chat.js         (새로 추가 - 실시간 채팅)
│       ├── analysis.js     (새로 추가 - AI 분석)
│       └── socket-client.js (새로 추가 - Socket.io 클라이언트)
├── server.js               (Express + Socket.io)
├── db.js                   (PostgreSQL 연결)
├── controllers/
│   ├── chatController.js   (새로 추가)
│   ├── aiController.js     (새로 추가)
│   └── shareController.js  (새로 추가)
├── services/
│   ├── geminiService.js    (Gemini API 통합)
│   ├── qrService.js        (QR 코드 생성)
│   └── pdfService.js       (PDF 리포트)
└── package.json
```

---

## 💡 주요 개선 포인트 요약

### 사용자 경험 개선
1. **정적 → 실시간**: 게시판에서 채팅방으로 전환
2. **단순 → 풍부**: 4-Tab 구조로 다양한 정보 제공
3. **수동 → 자동**: AI가 역할, 질문, 분석 자동 생성

### 기술적 개선
1. **RESTful API → WebSocket**: 실시간 양방향 통신
2. **단순 CRUD → 복합 시스템**: 채팅 + 분석 + 공유
3. **기본 AI → 고도화**: 생성, 질문, 분석 3단계 활용

### 비즈니스 가치
1. **공유 편의성**: QR 코드 + 단축 URL
2. **데이터 인사이트**: 토론 분석 리포트
3. **교육 활용**: 역할극 모드 + AI 개입

---

## 🚨 주의사항 및 고려사항

### 1. 하위 호환성
- 기존 opinions 테이블 데이터 마이그레이션 필요
- 점진적 전환으로 서비스 중단 최소화

### 2. 성능 최적화
- WebSocket 연결 수 제한 (최대 동시 접속자)
- 메시지 페이징 (무한 스크롤)
- AI API 호출 제한 (Rate Limiting)

### 3. 보안
- WebSocket 인증 메커니즘
- XSS 방지 (채팅 메시지 sanitization)
- CSRF 토큰 적용

### 4. 비용 관리
- Gemini API 사용량 모니터링
- PostgreSQL 스토리지 관리
- CDN 고려 (정적 파일 서빙)

---

**작성일**: 2025-10-27
**분석 기준**: Agora Insights 원본 사이트 스크린샷 13장 + 분석 문서 3개
