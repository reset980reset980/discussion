# 변경 이력 (Changelog)

## 2025-11-01

### 🎨 UI/UX 개선

#### 1. 로비와 토론방 모달 디자인 통일
- **변경사항**: 단축 링크 모달 UI를 로비와 토론방에서 완전히 통일
- **세부내용**:
  - 닫기 버튼: FontAwesome 아이콘 사용, 32x32px, 회색(#9ca3af)
  - 별칭 확인 버튼: 흰색 배경, 회색 아이콘, 노란색 호버
  - 복사 버튼: copy-outline.svg 사용, 체크 버튼과 동일한 스타일
  - 모든 버튼 색상: #5b8def로 통일
- **파일**:
  - `public/room.html` (FontAwesome CDN 추가, 아이콘 변경)
  - `public/css/room.css` (모달 스타일 통일)
  - `public/style.css` (버튼 색상 통일)
  - `public/index.html` (복사 버튼 아이콘 변경)

#### 2. QR 코드 실시간 업데이트 기능 추가
- **기능**: 로비 단축 링크 모달에서 QR 코드 실시간 업데이트
- **구현**:
  - 모달 열릴 때 샘플 QR 코드 표시 (https://example.com)
  - 원본 URL 입력 시 즉시 QR 코드 생성
- **파일**: `public/app.js` (lines 1442-1488)

#### 3. Toast 알림 시스템 추가
- **변경**: 브라우저 alert() 대신 하단 toast 알림 사용
- **파일**:
  - `public/css/room.css` (toast 스타일)
  - `public/js/room.js` (showToast 함수 사용)

### 🚀 배포 및 서버 설정

#### 1. 원격 서버 환경 설정
- **서버**: https://discussion.keesdconsulting.uk/
- **설정 파일**: `.env` 파일 생성
  - PostgreSQL 연결 정보 추가
  - Gemini API 키 설정
  - BASE_URL 설정
- **위치**: `/home/reset980/discussion-board/`

#### 2. PostgreSQL 데이터베이스 설정
- **데이터베이스**: vibedb
- **사용자**: vibe (비밀번호 설정 완료)
- **권한**: vibedb에 대한 모든 권한 부여

#### 3. 서버 시작 및 확인
- **프로세스**: PID 1758702
- **포트**: 3001
- **상태**: 정상 실행 중

### ✅ 기능 테스트

#### 1. 단축 URL 생성 기능
- **테스트 URL**: https://www.google.com → https://discussion.keesdconsulting.uk/s/4uqckm
- **결과**: 정상 생성 및 DB 저장 확인

#### 2. URL 리다이렉션 기능
- **테스트**: 단축 URL 접속 시 원본 URL로 리다이렉트
- **결과**: 정상 작동 확인

#### 3. QR 코드 기능
- **샘플 QR**: 모달 열 때 자동 표시
- **실시간 업데이트**: URL 입력 시 즉시 QR 코드 변경
- **결과**: 정상 작동 확인

## 2025-10-31

### 🐛 버그 수정

#### 1. 비밀글 잠금 아이콘 표시 문제 수정
- **문제**: 비밀글로 설정해도 토론 카드에 잠금 아이콘이 표시되지 않음
- **원인**: GET `/api/discussions` API에서 `is_private` 컬럼을 반환하지 않음
- **수정**: `server.js` line 102에 `is_private` 컬럼 추가
- **파일**: `server.js`

#### 2. 닉네임 자동 입장 기능 복구
- **문제**: 방을 나갔다가 다시 들어가면 닉네임을 다시 입력해야 함
- **원인**: localStorage에 저장된 사용자 정보를 확인만 하고 자동 입장 처리를 하지 않음
- **수정**: `showJoinModal()` 함수에 저장된 사용자 정보로 자동 입장하는 로직 추가
- **파일**: `public/js/room.js` (lines 382-400)

### ✨ 기능 개선

#### 1. 역할극 모드 역할 목록 표시 수정
- **문제**: 토론방 수정 시 역할 목록이 지워짐
- **원인**: GET `/api/discussions` API에서 `roles`, `team1_name`, `team2_name` 컬럼을 반환하지 않음
- **수정**: 필요한 컬럼들을 SELECT 쿼리에 추가
- **파일**: `server.js` (lines 98-105)

#### 2. 참여자 통계 영역 조건부 표시
- **문제**: 역할극/자유 모드에서도 "찬성 0, 반대 0" 통계가 표시됨
- **수정**: 팀전 모드에서만 참여자 통계 영역을 표시하도록 수정
- **파일**: `public/js/room.js` (lines 263-330)

#### 3. 토론 상황 섹션 추가
- **기능**: 토론방 입장 시 토론 상황을 확인할 수 있는 접을 수 있는 영역 추가
- **구현**:
  - HTML 구조 추가: `public/room.html` (lines 29-43)
  - CSS 스타일링: `public/css/room.css` (lines 83-153)
  - 토글 기능 및 description 로드: `public/js/room.js` (lines 229-278)
- **특징**:
  - 노란색 배경으로 구분
  - 클릭하여 접기/펼치기 가능
  - 최대 높이 300px, 스크롤 지원

### 🎨 UI/UX 개선

#### 1. 토론 생성 모달 여백 축소
- **변경사항**:
  - `.form-group` margin-bottom: 20px → 12px
  - label margin-bottom: 6px → 4px
  - input/textarea padding: 12px 16px → 8px 12px
  - textarea line-height: 1.3 추가
  - textarea rows: 8 → 5
- **파일**: `public/style.css`, `public/index.html`

#### 2. 토론 타입 배지 표시 개선
- **변경**: 타입 배지(자유/팀전/역할극)를 제목과 인라인으로 표시
- **수정**:
  - `app.js`: 배지를 `<h3>` 내부 `<span>`으로 이동 (lines 227-230)
  - `style.css`: absolute positioning 제거, inline-block으로 변경 (lines 234-244)
- **효과**: 비밀글 잠금 아이콘과 타입 배지가 제목과 같은 줄에 자연스럽게 표시

#### 3. 토론 상황 영역 여백 조정
- **변경**:
  - padding: 1rem → 0.5rem
  - line-height: 1.6 → 1.4
- **파일**: `public/css/room.css`

## 이전 변경사항 (요약)

### 2025-10-30
- PDF 다운로드 기능 추가 (서버 사이드 구현)
- 흐름 시각화 PDF 다운로드 버튼 추가
- 키워드 트렌드 차트 범례 개선 (원형 점으로 표시, 하단 배치)
- 중립 역할 필터링 및 키워드 데이터 생성 개선
