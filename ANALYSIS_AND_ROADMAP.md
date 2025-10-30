# 원본 Agora Insights 분석 및 개발 로드맵

## 📋 프로젝트 개요

### 현재 프로젝트 vs 원본 사이트 비교 분석
- **현재**: 정적 토론 게시판 (게시글 형태)
- **원본**: 실시간 AI 기반 채팅형 토론 플랫폼

---

## 🔍 원본 사이트 핵심 기능 분석

### 1. 🎯 **실시간 채팅 기반 토론**
**현재 상태**: ❌ 없음
**원본 기능**:
- 실시간 메시지 전송/수신
- AI와 사용자 간 대화형 인터페이스
- 채팅 로그 실시간 업데이트

**기술 스택 요구사항**:
- WebSocket (Socket.io)
- 실시간 데이터베이스 동기화
- 메시지 큐 시스템

---

### 2. 👥 **참여자 관리 시스템**
**현재 상태**: ❌ 없음
**원본 기능**:
- 실시간 참여자 목록 (우측 사이드바)
- 참여자 수 실시간 표시
- AI(GPT)도 참여자로 표시
- 역할별 라벨 표시 (찬성/반대/역할명)

**구현 방법**:
```javascript
// WebSocket으로 참여자 관리
socket.on('user-joined', (userData) => {
  updateParticipantsList(userData);
});

socket.on('user-left', (userId) => {
  removeParticipant(userId);
});
```

---

### 3. 🎭 **동적 역할 선택 시스템**
**현재 상태**: ⚠️ 부분적 (토론 생성시에만)
**원본 기능**:
- 토론방 입장 시 역할 선택 모달
- AI가 주제에 맞는 역할 목록 자동 생성
- 역할별 구분된 UI 표시

**역할 생성 예시**:
```
착한 사마리아인 법 → 법학 교수, 응급의학과 의사, 심리학자, 변호사, 시민단체 활동가, 국회의원, 경찰관, 대학생
```

**API 설계**:
```javascript
POST /api/discussions/:id/generate-roles
{
  "topic": "착한 사마리아인 법 제정",
  "mode": "역할극"
}

Response:
{
  "roles": [
    "법학 교수", "응급의학과 의사", "심리학자",
    "변호사", "시민단체 활동가", "국회의원",
    "경찰관", "대학생 김민준"
  ]
}
```

---

### 4. 🔗 **고급 공유 시스템**
**현재 상태**: ❌ 없음
**원본 기능**:
- QR 코드 자동 생성
- 커스텀 단축 URL (.uzu.kr 도메인)
- 사용자 지정 별명 지원
- 입장 코드 시스템 (4자리)
- 원클릭 공유 기능

**구현 계획**:
```javascript
// QR 코드 생성
import QRCode from 'qrcode';

// 단축 URL 생성 API
POST /api/shorten
{
  "original_url": "https://discussion.keesdconsulting.uk/room/123",
  "custom_alias": "choco",
  "entry_code": "0831"
}

Response:
{
  "short_url": "https://discussion.keesdconsulting.uk/s/choco",
  "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "entry_code": "0831"
}
```

---

### 5. 🤖 **AI 질문 시스템**
**현재 상태**: ❌ 없음
**원본 기능**:
- 토론 시작 후 5분 카운트다운
- AI가 토론 흐름을 분석해서 적절한 질문 생성
- 독립된 질문 카드 UI (일반 채팅과 구분)
- 토론 침체시 자동 개입

**구현 방법**:
```javascript
// 5분 타이머 후 AI 질문 활성화
setTimeout(() => {
  generateAIQuestions(discussionId, chatHistory);
}, 5 * 60 * 1000);

// AI 질문 생성
async function generateAIQuestions(discussionId, chatHistory) {
  const prompt = `
    토론 내용: ${chatHistory}
    현재 토론 상황을 분석하고 토론을 활성화할 수 있는
    3가지 심화 질문을 생성하세요.
  `;

  const questions = await callGeminiAPI(prompt);
  broadcast('ai-questions', questions);
}
```

---

### 6. 📊 **AI 기반 토론 분석 시스템**
**현재 상태**: ❌ 없음
**원본 기능**:

#### 6.1 종합 분석
- 토론 내용 전체 요약
- 토론 품질 평가
- 주요 논점 정리

#### 6.2 참여자별 발언 비중
- 도넛 차트로 발언량 시각화
- 참여 균형도 분석

#### 6.3 토론 타임라인
- 시간순 주요 발언 정리
- 찬성/반대 논점 구분

#### 6.4 핵심 키워드 트렌드
- 시간대별 주요 키워드 변화
- 토론 흐름 시각화

#### 6.5 참여자 상호작용
- 레이더 차트로 토론 역학 분석
- 상호작용 패턴 시각화

#### 6.6 결과 리포트
- PDF 다운로드 기능
- 미해결 과제 및 제언
- 토론 결과 요약

**구현 기술 스택**:
```javascript
// 차트 라이브러리
import { Chart.js, D3.js } from 'chart-libraries';

// PDF 생성
import jsPDF from 'jspdf';

// 분석 API
POST /api/discussions/:id/analyze
Response: {
  "summary": "토론 요약",
  "participation": { "user1": 45, "user2": 55 },
  "timeline": [...],
  "keywords": [...],
  "insights": [...]
}
```

---

## 🛣️ 개발 로드맵

### Phase 1: 실시간 채팅 기반 전환 (Priority: High)
- [ ] WebSocket 서버 구축 (Socket.io)
- [ ] 실시간 메시지 송수신 시스템
- [ ] 채팅 UI 개발
- [ ] 메시지 저장/로드 시스템

### Phase 2: 참여자 관리 시스템 (Priority: High)
- [ ] 실시간 참여자 목록
- [ ] 참여자 상태 관리
- [ ] 역할별 UI 구분
- [ ] 입장/퇴장 알림

### Phase 3: 고급 공유 시스템 (Priority: Medium)
- [ ] QR 코드 생성 기능
- [ ] 단축 URL 서비스 구축
- [ ] 커스텀 별명 시스템
- [ ] 소셜 공유 기능

### Phase 4: AI 고도화 (Priority: Medium)
- [ ] 동적 역할 생성 시스템
- [ ] 시간 기반 AI 질문 시스템
- [ ] 토론 흐름 분석 AI
- [ ] 맥락적 개입 시스템

### Phase 5: 분석 시스템 (Priority: Low)
- [ ] 실시간 토론 분석
- [ ] 데이터 시각화 (Chart.js/D3.js)
- [ ] 리포트 생성 시스템
- [ ] PDF 내보내기 기능

---

## 🏗️ 기술 아키텍처 설계

### Frontend
```
React/Vue.js + Socket.io-client
├── Components/
│   ├── ChatRoom/
│   ├── ParticipantList/
│   ├── ShareModal/
│   ├── AnalysisPanel/
│   └── QRCodeGenerator/
├── Services/
│   ├── SocketService.js
│   ├── AIService.js
│   └── AnalyticsService.js
└── Utils/
    ├── QRCodeUtils.js
    └── ChartUtils.js
```

### Backend
```
Node.js + Express + Socket.io
├── Controllers/
│   ├── ChatController.js
│   ├── ParticipantController.js
│   ├── ShareController.js
│   └── AnalysisController.js
├── Services/
│   ├── AIService.js
│   ├── AnalyticsService.js
│   └── URLShortenerService.js
├── Models/
│   ├── Message.js
│   ├── Participant.js
│   └── Analysis.js
└── Utils/
    ├── QRGenerator.js
    └── PDFGenerator.js
```

### Database Schema
```sql
-- 메시지 테이블
CREATE TABLE messages (
    id INTEGER PRIMARY KEY,
    discussion_id INTEGER,
    user_id TEXT,
    user_name TEXT,
    user_role TEXT,
    message TEXT,
    message_type TEXT, -- 'chat', 'ai_question', 'system'
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 참여자 테이블
CREATE TABLE participants (
    id INTEGER PRIMARY KEY,
    discussion_id INTEGER,
    user_id TEXT,
    user_name TEXT,
    user_role TEXT,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    left_at DATETIME,
    is_active BOOLEAN DEFAULT TRUE
);

-- 단축 URL 테이블
CREATE TABLE short_urls (
    id INTEGER PRIMARY KEY,
    short_code TEXT UNIQUE,
    original_url TEXT,
    custom_alias TEXT,
    entry_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
);

-- 분석 데이터 테이블
CREATE TABLE analysis_data (
    id INTEGER PRIMARY KEY,
    discussion_id INTEGER,
    analysis_type TEXT,
    data JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🎯 주요 차별화 포인트

### 현재 프로젝트 장점
- ✅ 간단하고 직관적인 UI
- ✅ 빠른 토론 생성
- ✅ 명확한 찬성/반대 구조
- ✅ 비밀번호 기반 보안

### 원본 사이트 장점
- 🚀 실시간 상호작용
- 🤖 고도화된 AI 시스템
- 📊 풍부한 분석 기능
- 🔗 강력한 공유 시스템

### 목표: 두 장점의 결합
- 간단한 시작 + 강력한 기능
- 정적 토론 + 실시간 채팅 옵션
- 기본 AI + 고급 분석 시스템

---

## 📈 우선순위 및 예상 개발 기간

### 즉시 시작 가능 (1-2주)
1. **실시간 채팅 시스템** - WebSocket 기반
2. **참여자 관리** - 실시간 목록 표시

### 단기 목표 (2-4주)
3. **QR 코드 & 단축 URL** - 공유 기능 강화
4. **동적 역할 선택** - AI 기반 역할 생성

### 중기 목표 (1-2개월)
5. **AI 질문 시스템** - 시간 기반 개입
6. **기본 분석 기능** - 참여도, 요약 등

### 장기 목표 (2-3개월)
7. **고급 분석 시스템** - 차트, 리포트
8. **PDF 내보내기** - 결과 문서화

---

## 🚀 Next Steps

1. **현재 프로젝트 백업 및 브랜치 생성**
2. **WebSocket 서버 구축 시작**
3. **실시간 채팅 프로토타입 개발**
4. **단계별 기능 추가 및 테스트**

---

## 📝 참고 사항

- 기존 게시판 형태도 유지하여 선택적 사용 가능
- 점진적 마이그레이션으로 기존 사용자 경험 보존
- 모바일 최적화 고려 (QR 코드 활용)
- 교육 환경에서의 활용도 고려

---

**마지막 업데이트**: 2025-10-26
**분석 대상**: https://studio--agora-insights-bypo9.us-central1.hosted.app/