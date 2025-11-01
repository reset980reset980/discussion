# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**Discussion Board V2** - Agora Insights 스타일의 실시간 토론 게시판

실시간 채팅, AI 질문 생성, 토론 분석, PDF 생성 등을 지원하는 풀스택 토론 플랫폼입니다. Socket.io를 통한 실시간 통신, Gemini AI 통합, PostgreSQL 데이터베이스, URL 단축 서비스를 포함합니다.

## 기술 스택

- **Backend**: Node.js, Express.js
- **Real-time**: Socket.io
- **Database**: PostgreSQL (with SQLite fallback)
- **AI**: Google Gemini API
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **PDF Generation**: PDFKit
- **QR Code**: qrcode library
- **Security**: dotenv, cors, helmet patterns

## 개발 명령어

```bash
# 개발 서버 시작 (nodemon - 자동 재시작)
npm run dev

# 프로덕션 서버 시작
npm start

# 보안 감사
npm run audit

# 보안 자동 수정
npm run audit:fix

# 보안 전체 점검 (감사 + 오래된 패키지)
npm run security:check
```

## 환경 변수 설정

`.env` 파일 생성 (`.env.example` 참고):
```env
# 필수
GEMINI_API_KEY=your_gemini_api_key_here
DB_PASSWORD=your_db_password

# 선택사항 (기본값 있음)
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_USER=vibe
DB_NAME=vibedb
BASE_URL=http://localhost:3001
```

## 프로젝트 구조

```
discussion-board-v2/
├── server.js              # 메인 서버 (Express + Socket.io)
├── db.js                  # PostgreSQL 연결 및 초기화
├── package.json           # 의존성 및 스크립트
├── .npmrc                 # npm 보안 설정
├── SECURITY.md            # 보안 가이드
│
├── public/                # 클라이언트 파일
│   ├── index.html         # 로비 페이지
│   ├── room.html          # 토론방 페이지
│   ├── app.js             # 로비 클라이언트 로직
│   ├── style.css          # 로비 스타일
│   ├── js/
│   │   └── room.js        # 토론방 클라이언트 로직 (Socket.io)
│   ├── css/
│   │   └── room.css       # 토론방 스타일
│   └── images/
│       ├── avatars/       # 사용자 아바타
│       └── icons/         # UI 아이콘
│
└── services/
    └── url-shortener/     # URL 단축 서비스 모듈
        ├── index.js       # 엔트리 포인트
        ├── ShortUrlService.js
        ├── QRService.js
        ├── storage/
        │   ├── BaseAdapter.js
        │   └── PostgreSQLAdapter.js
        ├── utils/
        │   ├── codeGenerator.js
        │   └── validator.js
        └── middleware/
            └── routes.js
```

## 핵심 아키텍처

### 1. 서버 아키텍처 (server.js)

**Express REST API + Socket.io 이벤트 기반 아키텍처**

```javascript
// Express 라우트
GET    /api/discussions              # 토론방 목록
POST   /api/discussions              # 토론방 생성
GET    /api/discussions/:id          # 토론방 정보
DELETE /api/discussions/:id          # 토론방 삭제
POST   /api/discussions/:id/verify   # 입장 코드 확인
GET    /api/discussions/:id/messages # 메시지 조회

// URL 단축 라우트
POST   /s/shorten                    # URL 단축
GET    /s/:code                      # 리다이렉션

// Socket.io 이벤트
join-room        # 토론방 입장
send-message     # 메시지 전송
send-ai-question # AI 질문 요청
heartbeat        # 연결 유지
disconnect       # 연결 해제
```

### 2. 데이터베이스 스키마 (PostgreSQL)

**discussions 테이블**
```sql
CREATE TABLE discussions (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(20) CHECK (type IN ('팀전', '자유', '역할극')),
    author VARCHAR(100) NOT NULL,
    participants INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_private BOOLEAN DEFAULT false,
    entry_code VARCHAR(20),
    password VARCHAR(255),
    team1_name VARCHAR(50) DEFAULT '찬성',
    team2_name VARCHAR(50) DEFAULT '반대',
    roles TEXT
);
```

**messages 테이블**
```sql
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    discussion_id INTEGER NOT NULL,
    author VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    message_type VARCHAR(20) DEFAULT 'user',
    avatar VARCHAR(255),
    role VARCHAR(50),
    FOREIGN KEY (discussion_id) REFERENCES discussions(id) ON DELETE CASCADE
);
```

**participants 테이블**
```sql
CREATE TABLE participants (
    id SERIAL PRIMARY KEY,
    discussion_id INTEGER NOT NULL,
    username VARCHAR(100) NOT NULL,
    role VARCHAR(50),
    avatar VARCHAR(255),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (discussion_id) REFERENCES discussions(id) ON DELETE CASCADE
);
```

**URL 단축 테이블**
```sql
CREATE TABLE short_urls (
    id SERIAL PRIMARY KEY,
    short_code VARCHAR(20) UNIQUE NOT NULL,
    custom_alias VARCHAR(50) UNIQUE,
    original_url TEXT NOT NULL,
    qr_code TEXT,
    entry_code VARCHAR(20),
    metadata JSONB,
    click_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    last_accessed_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE url_clicks (
    id SERIAL PRIMARY KEY,
    short_code VARCHAR(20) NOT NULL,
    clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    referer TEXT,
    user_agent TEXT,
    ip_address VARCHAR(45),
    country VARCHAR(2),
    FOREIGN KEY (short_code) REFERENCES short_urls(short_code) ON DELETE CASCADE
);
```

### 3. Socket.io 실시간 통신

**서버 측 (server.js)**
```javascript
io.on('connection', (socket) => {
    // 토론방 입장
    socket.on('join-room', async (data) => {
        const { discussionId, username, role } = data;
        socket.join(`discussion-${discussionId}`);
        // 참여자 정보 DB 저장
        // 기존 메시지 로드
        // 입장 알림 브로드캐스트
    });

    // 메시지 전송
    socket.on('send-message', async (data) => {
        // 메시지 DB 저장
        // 같은 방의 모든 클라이언트에 브로드캐스트
        io.to(`discussion-${discussionId}`).emit('receive-message', message);
    });

    // AI 질문 생성 (Gemini API)
    socket.on('send-ai-question', async (data) => {
        // 최근 메시지 기반 AI 질문 생성
        // 쿨다운 30초 적용
    });
});
```

**클라이언트 측 (room.js)**
```javascript
// Socket.io 연결
socket = io();

// 토론방 입장
socket.emit('join-room', {
    discussionId: currentDiscussionId,
    username: currentUser.name,
    role: currentUser.role
});

// 메시지 수신
socket.on('receive-message', (data) => {
    appendMessage(data);
});

// AI 질문 수신
socket.on('ai-question-generated', (data) => {
    displayAIQuestion(data.question);
});
```

### 4. URL 단축 서비스 모듈

**독립형 모듈** - `services/url-shortener/`

```javascript
// 초기화
const { createShortener } = require('./services/url-shortener');

const shortener = await createShortener({
    baseUrl: 'http://localhost:3001',
    storage: { /* PostgreSQL config */ },
    codeGenerator: {
        length: 6,
        charset: 'safe',
        strategy: 'random'
    },
    enableQR: true,
    enableAnalytics: true
});

// Express 라우트 등록
app.use('/s', shortener.routes({
    enableCreate: true,
    enableRedirect: true,
    enableStats: false
}));
```

**사용 예시**:
```javascript
// URL 단축
const result = await shortener.shorten({
    url: 'https://example.com/very/long/url',
    customAlias: 'my-link',
    generateQR: true
});
// → { shortUrl, qrCode, shortCode, ... }

// URL 해석
const { originalUrl } = await shortener.resolve('abc123');
```

### 5. AI 질문 생성 (Gemini API)

```javascript
// 30초 쿨다운 적용
const lastAITime = aiQuestionTimers.get(discussionId) || 0;
const now = Date.now();
if (now - lastAITime < 30000) {
    return; // 쿨다운 중
}

// 최근 10개 메시지 기반 질문 생성
const prompt = `
다음은 토론방의 최근 대화 내용입니다:
${recentMessages}

토론을 더 깊이 있게 만들 수 있는 통찰력 있는 질문을 1개만 생성해주세요.
`;

const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 }
    })
});
```

### 6. 토론방 타입별 동작

**팀전 (Team Debate)**
- 찬성팀 vs 반대팀 구조
- 팀명 커스터마이징 가능
- 역할 선택 필수
- 팀별 메시지 색상 구분

**자유 (Free Discussion)**
- 제한 없는 자유 토론
- 역할 선택 없음
- 누구나 참여 가능

**역할극 (Role Play)**
- 사용자 정의 역할 시스템
- 역할별 아바타 및 색상
- 역할 선택 필수

### 7. 보안 아키텍처

**입력 검증**
- 모든 사용자 입력 검증 (title, content, username 등)
- SQL 인젝션 방지 (파라미터화된 쿼리)
- XSS 방지 (HTML 이스케이프 - 클라이언트)

**인증/인가**
- 비공개 토론방: 입장 코드 검증
- Socket.io: 연결 시 사용자 정보 검증
- Rate Limiting: AI 질문 30초 쿨다운

**환경 변수 보안**
- `.env` 파일로 민감 정보 관리
- Git에서 제외 (`.gitignore`)
- 프로덕션 환경 분리 권장

**npm 보안** (`.npmrc`)
- 정확한 버전 고정 (`save-exact=true`)
- 라이프사이클 스크립트 비활성화 (`ignore-scripts=true`)
- 보안 감사 활성화 (`audit=true`)

## 주요 기능 구현 가이드

### 토론방 생성
1. 클라이언트: 폼 데이터 수집 (`index.html`)
2. 서버: `POST /api/discussions` → DB INSERT
3. 응답: 생성된 토론방 ID
4. 리다이렉트: `/room.html?id={id}`

### 실시간 채팅
1. 클라이언트: Socket.io 연결 및 `join-room` 이벤트
2. 서버: 참여자 DB 저장, 기존 메시지 로드
3. 메시지 전송: `send-message` → DB 저장 → 브로드캐스트
4. 수신: `receive-message` → DOM 업데이트

### URL 단축 (공유 기능)
1. 클라이언트: 공유 버튼 클릭 → 모달 열기
2. QR 코드: 현재 페이지 URL로 자동 생성
3. 단축 URL 생성: `POST /s/shorten` → DB 저장
4. QR 코드 업데이트: 단축 URL로 재생성
5. 복사/공유: Clipboard API 또는 Web Share API

### AI 질문 생성
1. 클라이언트: AI 버튼 클릭 (30초 쿨다운)
2. 서버: 최근 10개 메시지 조회
3. Gemini API 호출 (GEMINI_API_KEY 필요)
4. 응답: 생성된 질문
5. 브로드캐스트: `ai-question-generated`

## 개발 시 주의사항

### 데이터베이스
- **PostgreSQL 우선**: 프로덕션 환경
- **SQLite 폴백**: DB 연결 실패 시 메모리 내 저장
- **파라미터화된 쿼리 필수**: SQL 인젝션 방지
- **외래 키 ON DELETE CASCADE**: 관련 데이터 자동 삭제

### Socket.io
- **네임스페이스 불필요**: 단일 네임스페이스 사용
- **Room 기반 메시징**: `discussion-{id}` 형식
- **에러 핸들링**: `try-catch`로 모든 이벤트 핸들러 감싸기
- **메모리 누수 방지**: `disconnect` 이벤트에서 리소스 정리

### 프론트엔드
- **Vanilla JS**: 프레임워크 없음
- **ES6+ 문법**: async/await, 화살표 함수 등
- **DOM 직접 조작**: `document.getElementById` 등
- **CSS Flexbox/Grid**: 반응형 레이아웃

### URL 단축 모듈
- **독립 실행 가능**: 다른 프로젝트에도 재사용 가능
- **자세한 문서**: `services/url-shortener/README.md` 참고
- **QR 코드**: base64 인코딩 PNG 이미지
- **분석 기능**: `enableAnalytics: true`로 클릭 추적

## 배포 정보

### 웹서버 접속

**SSH 접속**:
```bash
ssh -i C:\Users\KSD\.ssh\id_minipc -p 22 -t reset980@116.41.203.98
```

**배포 대상 디렉토리**:
```bash
~/discussion-board-v2/
```

### 배포 프로세스

1. **로컬에서 변경사항 푸시**:
```bash
git add .
git commit -m "커밋 메시지"
git push origin main
```

2. **서버 접속 및 업데이트**:
```bash
ssh -i C:\Users\KSD\.ssh\id_minipc -p 22 -t reset980@116.41.203.98
cd discussion-board-v2
git pull origin main
npm install --production
npm run start
```

3. **프로세스 관리 (PM2 권장)**:
```bash
# PM2 설치 (최초 1회)
npm install -g pm2

# 앱 시작
pm2 start server.js --name discussion-board

# 재시작
pm2 restart discussion-board

# 로그 확인
pm2 logs discussion-board

# 자동 시작 설정
pm2 startup
pm2 save
```

4. **환경 변수 설정**:
서버에 `.env` 파일 생성:
```bash
cd ~/discussion-board-v2
nano .env
```

```env
GEMINI_API_KEY=실제_API_키
DB_HOST=localhost
DB_PORT=5432
DB_USER=vibe
DB_PASSWORD=실제_비밀번호
DB_NAME=vibedb
PORT=3001
BASE_URL=http://116.41.203.98:3001
```

5. **PostgreSQL 설정** (최초 배포):
```bash
# PostgreSQL 설치
sudo apt update
sudo apt install postgresql postgresql-contrib

# 데이터베이스 생성
sudo -u postgres psql
CREATE DATABASE vibedb;
CREATE USER vibe WITH PASSWORD '실제_비밀번호';
GRANT ALL PRIVILEGES ON DATABASE vibedb TO vibe;
\q
```

6. **방화벽 설정**:
```bash
# 포트 3001 열기
sudo ufw allow 3001/tcp
sudo ufw reload
```

### 배포 체크리스트

- [ ] Git 저장소 최신화 (`git pull`)
- [ ] 의존성 설치 (`npm install --production`)
- [ ] 환경 변수 설정 (`.env` 파일)
- [ ] PostgreSQL 연결 확인
- [ ] 보안 감사 실행 (`npm run audit`)
- [ ] 서버 시작 (`pm2 start` 또는 `npm start`)
- [ ] 포트 접근 확인 (3001)
- [ ] 로그 모니터링 (`pm2 logs`)

## 트러블슈팅

### 데이터베이스 연결 실패
```javascript
// server.js는 자동으로 SQLite 폴백 모드로 전환
// 로그 확인: "PostgreSQL 연결 실패, SQLite 폴백 모드 사용"
```

**해결 방법**:
1. `.env` 파일 DB 정보 확인
2. PostgreSQL 서비스 실행 상태 확인
3. 방화벽 설정 확인

### Socket.io 연결 끊김
**증상**: 실시간 메시지가 전송되지 않음
**해결**:
1. 클라이언트 콘솔 에러 확인
2. CORS 설정 확인 (`server.js`)
3. 포트 충돌 확인

### AI 질문 생성 실패
**증상**: AI 버튼 클릭해도 반응 없음
**해결**:
1. `GEMINI_API_KEY` 환경 변수 확인
2. API 키 할당량 확인
3. 쿨다운 시간 (30초) 확인

### URL 단축 오류
**증상**: 단축 URL 생성 실패
**해결**:
1. `short_urls` 테이블 존재 확인
2. 커스텀 별칭 중복 확인
3. PostgreSQL 연결 상태 확인

## 참고 문서

- **보안 가이드**: `SECURITY.md`
- **URL 단축 모듈**: `services/url-shortener/README.md`
- **환경 변수 예시**: `.env.example`
- **npm 보안 설정**: `.npmrc`

## 추가 정보

**라이선스**: MIT
**작성자**: reset980
**저장소**: https://github.com/reset980reset980/discussion
**배포 서버**: 116.41.203.98:3001
