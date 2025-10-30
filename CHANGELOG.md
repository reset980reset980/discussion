# 변경 이력 (Changelog)

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
