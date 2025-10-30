# PDF 잘림 문제 해결 가이드 (PDFKit 서버 사이드 구현)

## 📋 문제 상황

### 현재 방식
- **클라이언트 사이드**: html2canvas → jsPDF
- **문제**: 화면을 이미지로 캡처 후 여러 페이지로 나눌 때 텍스트가 중간에 잘림
- **파일**: `public/js/room.js` (라인 1124-1198, 2151-2219)

### 문제 예시
```
한국인의 식생활에서 중요한 위치를 차지한다. 본 토론은 이
━━━━━━━━━━━ 페이지 경계 ━━━━━━━━━━━
한국인의 식생활에서 중요한 위치를 차지한다. 본 토론은 이
두 음식을 비교 분석함으로써, 한국 음식 문화의 다양성을 살
```

## 🎯 해결 방법: PDFKit 서버 사이드 구현

### 핵심 원리 (웹 클로드 제안)

PDFKit의 `doc.text()`는 긴 텍스트를 자동으로 여러 줄로 나누지만, **렌더링 시작 후에는 중간에 멈출 수 없음**.

**필수 적용 사항:**

1. **텍스트 높이 미리 계산**: `doc.heightOfString()`
2. **페이지 넘김 사전 판단**: 공간 부족 시 `doc.addPage()` 먼저 호출
3. **문단 단위 분할**: 긴 텍스트를 섹션별로 작게 나눔
4. **continued 옵션**: `continued: false`로 텍스트 이어짐 방지

## 🔧 구현 단계

### 1단계: 서버 API 엔드포인트 추가

**파일**: `server.js`

```javascript
// PDF 생성 API 엔드포인트
app.post('/api/discussions/:id/generate-verdict-pdf', async (req, res) => {
    try {
        const discussionId = req.params.id;
        const { verdictData } = req.body;

        // PDF 생성
        const pdfBuffer = await generateVerdictPDF(verdictData, discussionId);

        // 응답 헤더 설정
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=verdict-${discussionId}.pdf`);

        res.send(pdfBuffer);
    } catch (error) {
        console.error('PDF 생성 오류:', error);
        res.status(500).json({ error: 'PDF 생성 실패' });
    }
});
```

### 2단계: PDFKit PDF 생성 함수

**파일**: `server.js` 또는 새 파일 `utils/pdfGenerator.js`

```javascript
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// 상수 정의
const PAGE_WIDTH = 595.28;  // A4 width in points
const PAGE_HEIGHT = 841.89; // A4 height in points
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

async function generateVerdictPDF(verdictData, discussionId) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margins: {
                top: MARGIN_TOP,
                bottom: MARGIN_BOTTOM,
                left: MARGIN_LEFT,
                right: MARGIN_RIGHT
            },
            bufferPages: true
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        try {
            // 한글 폰트 등록 (필수!)
            const fontPath = path.join(__dirname, 'fonts', 'NanumGothic.ttf');
            doc.registerFont('NanumGothic', fontPath);
            doc.font('NanumGothic');

            // PDF 내용 생성
            addPDFContent(doc, verdictData, discussionId);

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

// 핵심: 안전하게 텍스트 추가하는 헬퍼 함수
function addTextSafely(doc, text, options = {}) {
    const textHeight = doc.heightOfString(text, {
        width: CONTENT_WIDTH,
        ...options
    });

    // 페이지 넘김 체크
    if (doc.y + textHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
    }

    doc.text(text, {
        width: CONTENT_WIDTH,
        continued: false,
        lineBreak: true,
        ...options
    });
}

// 제목 추가
function addTitle(doc, title) {
    doc.fontSize(20).font('NanumGothic', 'bold');
    addTextSafely(doc, title);
    doc.moveDown(0.5);
    doc.fontSize(12).font('NanumGothic');
}

// 섹션 제목 추가
function addSectionTitle(doc, title) {
    doc.moveDown();
    doc.fontSize(16).font('NanumGothic', 'bold');
    addTextSafely(doc, title);
    doc.moveDown(0.3);
    doc.fontSize(12).font('NanumGothic');
}

// 본문 텍스트 추가
function addBodyText(doc, text) {
    doc.fontSize(12).font('NanumGothic');

    // 문단 단위로 분할
    const paragraphs = text.split('\n\n');

    paragraphs.forEach((paragraph, index) => {
        if (paragraph.trim()) {
            addTextSafely(doc, paragraph.trim());
            if (index < paragraphs.length - 1) {
                doc.moveDown(0.5);
            }
        }
    });
}

// 리스트 항목 추가
function addListItem(doc, text, indent = 0) {
    const bullet = '• ';
    const indentSpace = indent * 20;

    doc.fontSize(12).font('NanumGothic');

    const itemHeight = doc.heightOfString(bullet + text, {
        width: CONTENT_WIDTH - indentSpace - 15,
        indent: indentSpace + 15
    });

    if (doc.y + itemHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
    }

    doc.text(bullet + text, {
        width: CONTENT_WIDTH - indentSpace,
        indent: indentSpace + 15,
        continued: false,
        lineBreak: true
    });

    doc.moveDown(0.3);
}

// PDF 콘텐츠 생성
function addPDFContent(doc, verdictData, discussionId) {
    // 제목
    addTitle(doc, 'AI 판결문');

    // 토론 ID 및 날짜
    doc.fontSize(10).fillColor('#666666');
    addTextSafely(doc, `토론방 ID: ${discussionId}`);
    addTextSafely(doc, `생성일: ${new Date().toLocaleDateString('ko-KR')}`);
    doc.fillColor('#000000');
    doc.moveDown(1);

    // 개요
    addSectionTitle(doc, '개요');
    addBodyText(doc, verdictData.overview);

    // 배경
    addSectionTitle(doc, '배경');
    addBodyText(doc, verdictData.background);

    // 주요 쟁점
    addSectionTitle(doc, '주요 쟁점');
    if (verdictData.issues && verdictData.issues.length > 0) {
        verdictData.issues.forEach((issue, index) => {
            addListItem(doc, `${index + 1}. ${issue}`);
        });
    }

    // 쟁점별 분석
    if (verdictData.main_body && verdictData.main_body.length > 0) {
        verdictData.main_body.forEach((issue, index) => {
            addSectionTitle(doc, issue.issue_title);

            // 찬반 주장 요약
            doc.fontSize(14).font('NanumGothic', 'bold');
            addTextSafely(doc, '주장 요약');
            doc.fontSize(12).font('NanumGothic');
            doc.moveDown(0.3);

            // 찬성 측
            doc.fontSize(12).font('NanumGothic', 'bold');
            addTextSafely(doc, '찬성:');
            doc.font('NanumGothic');
            addBodyText(doc, issue.arguments_summary.pros);
            doc.moveDown(0.3);

            // 반대 측
            doc.fontSize(12).font('NanumGothic', 'bold');
            addTextSafely(doc, '반대:');
            doc.font('NanumGothic');
            addBodyText(doc, issue.arguments_summary.cons);
            doc.moveDown(0.3);

            // AI 의견
            doc.fontSize(12).font('NanumGothic', 'bold');
            addTextSafely(doc, 'AI 의견:');
            doc.font('NanumGothic');
            addBodyText(doc, issue.arguments_summary.ai);
            doc.moveDown(0.5);

            // 분석
            doc.fontSize(14).font('NanumGothic', 'bold');
            addTextSafely(doc, '분석');
            doc.fontSize(12).font('NanumGothic');
            doc.moveDown(0.3);
            addBodyText(doc, issue.analysis);
        });
    }

    // 인사이트
    if (verdictData.insights) {
        addSectionTitle(doc, '인사이트');
        addBodyText(doc, verdictData.insights);
    }

    // 요약
    addSectionTitle(doc, '요약');
    addBodyText(doc, verdictData.summary);

    // 권고사항
    if (verdictData.recommendations) {
        addSectionTitle(doc, '권고사항');
        addBodyText(doc, verdictData.recommendations);
    }

    // 의의
    if (verdictData.significance) {
        addSectionTitle(doc, '의의');
        addBodyText(doc, verdictData.significance);
    }
}

module.exports = { generateVerdictPDF };
```

### 3단계: 한글 폰트 추가

**필수!** PDFKit은 한글을 지원하지 않으므로 폰트 파일이 필요합니다.

1. 나눔고딕 폰트 다운로드:
   - https://hangeul.naver.com/font
   - 또는 Google Fonts에서 Noto Sans KR

2. 폰트 파일 위치:
   ```
   discussion/
   ├── fonts/
   │   └── NanumGothic.ttf
   └── server.js
   ```

3. `.gitignore`에 추가하지 말 것! (프로젝트에 포함되어야 함)

### 4단계: 클라이언트 코드 수정

**파일**: `public/js/room.js`

기존 PDF 다운로드 함수를 API 호출로 변경:

```javascript
// 판결문 PDF 다운로드 버튼 (서버 API 사용)
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
                    verdictData: verdictResult
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
            console.error('PDF 다운로드 오류:', error);
            alert('PDF 다운로드 중 오류가 발생했습니다: ' + error.message);
        }
    });
}
```

## ✅ 체크리스트

### 구현 전 확인사항
- [ ] PDFKit이 package.json에 설치되어 있는지 확인 (✅ 이미 설치됨: `"pdfkit": "^0.17.2"`)
- [ ] 한글 폰트 파일 준비 (NanumGothic.ttf 또는 NotoSansKR.ttf)
- [ ] 폰트 파일 경로 설정 (`fonts/` 폴더 생성)

### 구현 단계별 체크
- [ ] 1단계: 서버 API 엔드포인트 추가
- [ ] 2단계: PDF 생성 함수 구현
- [ ] 3단계: 한글 폰트 추가 및 등록
- [ ] 4단계: 클라이언트 코드 수정
- [ ] 테스트: 판결문 PDF 생성 및 다운로드

### PDFKit 핵심 원칙 (반드시 지킬 것!)
- [ ] `doc.heightOfString()`으로 텍스트 높이 **미리 계산**
- [ ] 페이지 넘김 전에 `doc.y + textHeight > PAGE_HEIGHT - MARGIN_BOTTOM` 체크
- [ ] 긴 텍스트는 **문단/섹션 단위로 분할**
- [ ] `continued: false` 옵션 사용
- [ ] 리스트/항목은 **개별적으로 처리**

## 🎯 예상 결과

### Before (현재)
```
한국인의 식생활에서 중요한 위치를 차지한다. 본 토론은 이
━━━━━━━━━━━ 페이지 경계 ━━━━━━━━━━━
한국인의 식생활에서 중요한 위치를 차지한다. 본 토론은 이
두 음식을 비교 분석함으로써...
```

### After (개선)
```
한국인의 식생활에서 중요한 위치를 차지한다.
━━━━━━━━━━━ 페이지 경계 ━━━━━━━━━━━
본 토론은 이 두 음식을 비교 분석함으로써, 한국 음식
문화의 다양성을 살펴보고...
```

## 📝 참고 사항

### 장점
- ✅ 텍스트가 절대 중간에 잘리지 않음
- ✅ PDF 파일 크기 작음 (이미지 방식보다 90% 이상 감소)
- ✅ 텍스트 선택 및 복사 가능
- ✅ 검색 가능한 PDF

### 주의사항
- ⚠️ 한글 폰트 파일 필수 (약 2-3MB)
- ⚠️ 서버 리소스 사용 (CPU, 메모리)
- ⚠️ 차트/이미지는 별도 처리 필요

### 차트 포함 시 추가 작업
판결문은 텍스트만 있지만, 흐름 시각화는 차트가 포함되므로:
1. 클라이언트에서 Chart.js를 canvas로 변환
2. `canvas.toDataURL()`로 이미지 데이터 생성
3. 서버로 이미지 데이터 전송
4. PDFKit의 `doc.image()`로 이미지 삽입

## 🔗 관련 파일

### 현재 코드 (백업용)
- `public/js/room.js` - 라인 2151-2219 (판결문 PDF 다운로드)
- `public/js/room.js` - 라인 1124-1198 (종합 분석 PDF 다운로드)
- `public/js/room.js` - 라인 1201-1272 (흐름 시각화 PDF 다운로드)

### 새로 생성할 파일
- `fonts/NanumGothic.ttf` - 한글 폰트
- `utils/pdfGenerator.js` (선택) - PDF 생성 유틸리티

### 수정할 파일
- `server.js` - API 엔드포인트 및 PDF 생성 함수
- `public/js/room.js` - PDF 다운로드 핸들러

## 📚 추가 자료

- PDFKit 공식 문서: http://pdfkit.org/
- PDFKit GitHub: https://github.com/foliojs/pdfkit
- 한글 폰트: https://hangeul.naver.com/font

---

**작성일**: 2025-10-30
**작성자**: Claude Code
**참고**: 웹 클로드의 PDFKit 텍스트 잘림 방지 제안
