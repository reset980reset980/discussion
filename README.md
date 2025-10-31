# AI 기반 토론 게시판 (Discussion Board with AI)

Gemini AI를 활용한 지능형 토론 게시판 애플리케이션입니다. 사용자가 토론 주제를 입력하면 AI가 자동으로 구체적인 토론 상황과 찬성/반대 의견을 생성해줍니다.

## 🌟 주요 기능

### 🤖 AI 토론 시나리오 생성
- **자동 상황 생성**: 토론 주제 입력 시 AI가 구체적인 배경 상황 자동 생성
- **구조화된 내용**: 상황 설명, 찬성 입장, 반대 입장으로 체계적 구성
- **실제적 시나리오**: 현실적이고 생생한 토론 상황 제시

### 📝 토론 모드
- **자유 토론**: 일반적인 자유 형식 토론
- **팀전**: 찬성/반대 팀으로 나누어 진행하는 토론
- **역할극**: AI 추천 기능이 포함된 역할 기반 토론

### 🔐 보안 기능
- **비밀번호 인증**: 토론방 생성 시 비밀번호 설정 및 삭제 시 인증
- **비밀 토론방**: 입장 코드가 필요한 프라이빗 토론방
- **작성자 보호**: 비밀번호만으로 간편한 삭제 인증

### ⏰ 토론 관리
- **자동 만료**: 설정된 기간(1일/3일/7일/사용자 지정) 후 자동 만료
- **실시간 카운트다운**: 남은 시간 실시간 표시
- **의견 추가**: 찬성/반대 의견을 자유롭게 추가

## 🛠️ 기술 스택

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Database**: SQLite (메모리 저장소 또는 파일)
- **AI**: Google Gemini 2.0 Flash API
- **UI/UX**: 반응형 디자인, 모달 인터페이스

## 📦 설치 및 실행

### 1. 저장소 클론
```bash
git clone https://github.com/reset980reset980/discussion.git
cd discussion
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
`.env.example`을 복사하여 `.env` 파일 생성 후 API 키 설정:
```bash
cp .env.example .env
```

`.env` 파일에서 Gemini API 키 설정:
```
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

### 4. 서버 실행
```bash
# 개발 환경 (기본 포트 3001)
node server.js

# 또는 포트 지정
PORT=3000 node server.js
```

### 5. 브라우저에서 접속
```
http://localhost:3001
```

## 🔑 Gemini API 키 발급

1. [Google AI Studio](https://aistudio.google.com/) 방문
2. Google 계정으로 로그인
3. "Get API Key" 클릭하여 새 API 키 생성
4. 생성된 키를 `.env` 파일에 설정

## 📖 사용법

### 새 토론 시작하기
1. **"새 토론 시작"** 버튼 클릭
2. **토론 제목** 입력 (예: "착한 사마리아인 법 제정")
3. **토론 모드** 선택:
   - 자유: 일반 토론
   - 팀전: 찬성/반대 팀명 설정
   - 역할극: **"✨ AI 추천"** 버튼으로 자동 시나리오 생성
4. **토론 기간** 설정 (1일/3일/7일/사용자 지정)
5. **비밀번호** 설정 (삭제 시 필요)
6. **비밀 토론방** 옵션 (선택사항)

### AI 추천 기능 사용하기
1. 역할극 모드 선택
2. 토론 제목 입력
3. **"✨ AI 추천"** 버튼 클릭
4. AI가 자동으로 생성하는 내용:
   - 📋 상황: 구체적인 배경 시나리오
   - ✅ 찬성: 핵심 찬성 논리
   - ❌ 반대: 핵심 반대 논리

### 토론 참여하기
1. 토론방 목록에서 참여할 토론 클릭
2. 비밀 토론방인 경우 입장 코드 입력
3. 찬성/반대 의견 작성 및 제출
4. 다른 참여자들의 의견 확인

## 🎨 UI/UX 특징

- **반응형 디자인**: 모바일/태블릿/데스크톱 최적화
- **직관적 인터페이스**: 명확한 아이콘과 색상 구분
- **실시간 피드백**: 토스트 메시지와 로딩 애니메이션
- **접근성**: 키보드 내비게이션 및 스크린 리더 지원

## 🚀 배포

### 원격 서버 접속
최종 완성본 배포용 원격 서버:
```bash
ssh -i C:\Users\KSD\.ssh\id_minipc -p 22 -t reset980@116.41.203.98
```

### 배포 절차
1. 원격 서버에 SSH로 접속
2. 프로젝트 디렉토리로 이동
3. 최신 코드 pull
4. 의존성 설치 및 서버 재시작

## 🔧 개발 정보

### 프로젝트 구조
```
discussion/
├── public/              # 프론트엔드 파일
│   ├── index.html      # 메인 HTML
│   ├── app.js          # 메인 JavaScript
│   └── style.css       # 스타일시트
├── server.js           # Express 서버
├── db.js              # 데이터베이스 로직
├── package.json       # 의존성 관리
├── .env.example       # 환경변수 템플릿
└── README.md         # 프로젝트 문서
```

### API 엔드포인트
- `GET /api/config` - 환경 설정 조회
- `GET /api/discussions` - 토론 목록 조회
- `POST /api/discussions` - 새 토론 생성
- `DELETE /api/discussions/:id` - 토론 삭제
- `POST /api/discussions/:id/verify-entry` - 입장 코드 검증
- `POST /api/opinions` - 의견 추가
- `POST /api/opinions/:id/like` - 의견 좋아요

### 데이터베이스 스키마
```sql
-- 토론 테이블
CREATE TABLE discussions (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    mode TEXT,
    duration INTEGER,
    expires_at DATETIME,
    password TEXT,
    is_private BOOLEAN,
    entry_code TEXT,
    pros_name TEXT,
    cons_name TEXT,
    role_list TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 의견 테이블
CREATE TABLE opinions (
    id INTEGER PRIMARY KEY,
    discussion_id INTEGER,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    opinion_type TEXT,
    likes INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🤝 기여하기

1. 이 저장소를 포크합니다
2. 새 기능 브랜치를 생성합니다 (`git checkout -b feature/amazing-feature`)
3. 변경사항을 커밋합니다 (`git commit -m 'Add amazing feature'`)
4. 브랜치에 푸시합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 생성합니다

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 🔗 관련 링크

- [Google Gemini AI](https://ai.google.dev/)
- [Node.js](https://nodejs.org/)
- [Express.js](https://expressjs.com/)
- [SQLite](https://www.sqlite.org/)

## 📞 지원

문제가 발생하거나 기능 요청이 있으시면 [GitHub Issues](https://github.com/reset980reset980/discussion/issues)에 등록해 주세요.

---

**Made with ❤️ and 🤖 AI**