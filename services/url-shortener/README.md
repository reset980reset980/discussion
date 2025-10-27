# 🔗 URL Shortener Module

재사용 가능한 독립형 URL 단축 서비스 모듈

## ✨ 주요 기능

- ✅ **URL 단축** - 긴 URL을 짧은 코드로 변환
- 🎨 **QR 코드 자동 생성** - 단축 URL에 대한 QR 코드 생성
- 🔒 **입장 코드** - 비공개 링크 보호
- ⏰ **만료 기능** - 시간 제한 링크
- 📊 **분석 기능** - 클릭 수, 참조 사이트, 사용자 에이전트 추적
- 🎯 **커스텀 별칭** - 사용자 지정 단축 코드
- 🔄 **다중 DB 지원** - PostgreSQL, MySQL, SQLite (확장 가능)
- 🚀 **Express 통합** - 자동 라우트 생성
- 🛡️ **유효성 검증** - 포괄적인 입력 검증
- 📦 **모듈화** - 다른 프로젝트에 쉽게 통합

---

## 📦 설치

```bash
npm install qrcode pg express
```

---

## 🚀 빠른 시작

### 기본 사용법

```javascript
const { createShortener } = require('./services/url-shortener');

// URL 단축 서비스 초기화
const shortener = await createShortener({
    baseUrl: 'https://example.com',
    storage: {
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'your_password',
        database: 'your_database'
    }
});

// URL 단축
const result = await shortener.shorten({
    url: 'https://very-long-url-example.com/page?param=value'
});

console.log(result.shortUrl); // https://example.com/s/abc123
console.log(result.qrCode);   // data:image/png;base64,iVBORw0KGg...
```

### Express 통합

```javascript
const express = require('express');
const { createShortener } = require('./services/url-shortener');

const app = express();
app.use(express.json());

(async () => {
    const shortener = await createShortener({
        baseUrl: 'https://example.com',
        storage: {
            host: 'localhost',
            database: 'mydb'
        },
        enableQR: true,
        enableAnalytics: true
    });

    // 자동 라우트 생성
    app.use('/s', shortener.routes({
        enableCreate: true,
        enableRedirect: true,
        enableStats: true,
        enableDelete: false  // 보안을 위해 비활성화
    }));

    app.listen(3000, () => {
        console.log('Server running on http://localhost:3000');
    });
})();
```

---

## 📖 API 문서

### `createShortener(config)`

URL 단축 서비스 인스턴스 생성

**매개변수:**
```javascript
{
    // 필수
    baseUrl: 'https://example.com',  // 기본 도메인

    // 스토리지 설정
    storageType: 'postgresql',       // 기본값: 'postgresql'
    storage: {
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'password',
        database: 'dbname'
    },

    // 코드 생성 옵션
    codeGenerator: {
        length: 6,                   // 코드 길이 (기본: 6)
        charset: 'alphanumeric',     // 문자셋: alphanumeric, lowercase, safe
        strategy: 'random'           // 전략: random, sequential, timestamp
    },

    // QR 코드 옵션
    qr: {
        size: 300,                   // QR 크기 (기본: 300)
        margin: 4,                   // 여백 (기본: 4)
        errorCorrectionLevel: 'M',   // 오류 정정: L, M, Q, H
        color: {
            dark: '#000000',
            light: '#FFFFFF'
        }
    },

    // 기능 활성화
    enableQR: true,                  // QR 코드 자동 생성 (기본: true)
    enableAnalytics: true,           // 분석 기능 (기본: true)
    reuseExisting: false,            // 기존 URL 재사용 (기본: false)

    // 자동 정리
    autoCleanup: true,               // 만료된 URL 자동 삭제 (기본: false)
    cleanupInterval: 3600000         // 정리 간격 (기본: 1시간)
}
```

### ShortUrlService 메서드

#### `shorten(params)`

URL 단축

```javascript
const result = await shortener.shorten({
    url: 'https://example.com/very/long/url',
    customAlias: 'my-link',          // 선택사항
    expiresAt: new Date('2025-12-31'), // 선택사항
    entryCode: '1234',               // 선택사항 (4-10자)
    metadata: {                      // 선택사항
        userId: 123,
        campaign: 'summer-sale'
    },
    generateQR: true                 // 선택사항 (기본: true)
});

// 반환값
{
    shortCode: 'abc123',
    shortUrl: 'https://example.com/s/abc123',
    originalUrl: 'https://example.com/very/long/url',
    customAlias: 'my-link',
    qrCode: 'data:image/png;base64,...',
    entryCode: '1234',
    metadata: { userId: 123, campaign: 'summer-sale' },
    clickCount: 0,
    createdAt: '2025-10-27T12:00:00.000Z',
    expiresAt: '2025-12-31T00:00:00.000Z'
}
```

#### `resolve(codeOrAlias, analyticsData)`

단축 URL 해석 및 원본 URL 가져오기

```javascript
const result = await shortener.resolve('abc123', {
    referer: 'https://google.com',
    userAgent: 'Mozilla/5.0...',
    ipAddress: '192.168.1.1'
});

// 반환값
{
    originalUrl: 'https://example.com/very/long/url',
    entryCode: '1234',  // 있는 경우
    metadata: { ... }
}
```

#### `getStats(codeOrAlias)`

통계 조회

```javascript
const stats = await shortener.getStats('abc123');

// 반환값
{
    shortCode: 'abc123',
    shortUrl: 'https://example.com/s/abc123',
    originalUrl: 'https://example.com/very/long/url',
    clickCount: 150,
    totalClicks: 150,
    uniqueVisitors: 75,
    createdAt: '2025-10-27T12:00:00.000Z',
    lastAccessedAt: '2025-10-27T15:30:00.000Z',
    clicksOverTime: [
        { date: '2025-10-27', clicks: 50 },
        { date: '2025-10-26', clicks: 100 }
    ]
}
```

#### `delete(codeOrAlias)`

단축 URL 삭제

```javascript
const success = await shortener.delete('abc123');
// true 또는 false
```

#### `update(codeOrAlias, updates)`

단축 URL 업데이트

```javascript
const updated = await shortener.update('abc123', {
    url: 'https://new-url.com',
    expiresAt: new Date('2026-01-01'),
    metadata: { updated: true }
});
```

#### `list(options)`

단축 URL 목록 조회

```javascript
const result = await shortener.list({
    page: 1,
    limit: 20,
    sortBy: 'created_at',  // created_at, click_count, last_accessed_at
    order: 'desc'          // asc, desc
});

// 반환값
{
    items: [ /* 단축 URL 배열 */ ],
    total: 150,
    page: 1,
    limit: 20,
    totalPages: 8
}
```

#### `cleanupExpired()`

만료된 URL 삭제

```javascript
const deletedCount = await shortener.cleanupExpired();
console.log(`${deletedCount}개의 만료된 URL이 삭제되었습니다.`);
```

#### `getOverallStats()`

전체 통계

```javascript
const stats = await shortener.getOverallStats();

// 반환값
{
    totalUrls: 1000,
    totalClicks: 50000,
    recentUrls: [ /* 최근 10개 URL */ ]
}
```

---

## 🌐 Express 라우트

### 자동 생성 라우트

```javascript
app.use('/s', shortener.routes({
    enableCreate: true,     // POST /s/shorten
    enableRedirect: true,   // GET /s/:code
    enableStats: true,      // GET /s/:code/stats
    enableDelete: false,    // DELETE /s/:code (관리자 전용)
    enableUpdate: false,    // PATCH /s/:code (관리자 전용)
    enableList: false,      // GET /s/list (관리자 전용)
    requireAuth: authMiddleware  // 인증 미들웨어 (선택사항)
}));
```

### API 엔드포인트

#### `POST /s/shorten` - URL 단축

```bash
curl -X POST http://localhost:3000/s/shorten \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/very/long/url",
    "customAlias": "my-link",
    "expiresAt": "2025-12-31",
    "entryCode": "1234"
  }'
```

#### `GET /s/:code` - 리다이렉션

```bash
curl http://localhost:3000/s/abc123
# → 302 Redirect to original URL

# 입장 코드가 필요한 경우
curl http://localhost:3000/s/abc123?code=1234
```

#### `GET /s/:code/stats` - 통계 조회

```bash
curl http://localhost:3000/s/abc123/stats
```

#### `GET /s/health` - 헬스 체크

```bash
curl http://localhost:3000/s/health
```

---

## 🔧 고급 사용법

### 커스텀 코드 생성 전략

```javascript
const shortener = await createShortener({
    baseUrl: 'https://example.com',
    codeGenerator: {
        length: 8,
        charset: 'safe',     // 혼동 방지 (i,l,o,0,1 제외)
        strategy: 'timestamp'  // 타임스탬프 기반 생성
    }
});
```

### 커스텀 스토리지 어댑터

```javascript
const { BaseAdapter } = require('./services/url-shortener');

class MySQLAdapter extends BaseAdapter {
    async connect() {
        // MySQL 연결 로직
    }

    async create(data) {
        // 생성 로직
    }

    // ... 다른 메서드 구현
}

const shortener = await createShortener({
    baseUrl: 'https://example.com',
    storage: new MySQLAdapter({
        host: 'localhost',
        database: 'mydb'
    })
});
```

### 인증 미들웨어 통합

```javascript
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization;

    if (!token || token !== 'Bearer my-secret-token') {
        return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    next();
};

app.use('/s', shortener.routes({
    enableDelete: true,
    enableUpdate: true,
    enableList: true,
    requireAuth: authMiddleware
}));
```

---

## 📊 데이터베이스 스키마

### `short_urls` 테이블

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
```

### `url_clicks` 테이블 (분석용)

```sql
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

---

## 🎯 사용 예시

### 토론 플랫폼 통합

```javascript
// 토론방 공유 링크 생성
const shareLink = await shortener.shorten({
    url: `https://discussion.example.com/room/${discussionId}`,
    customAlias: `discuss-${discussionId}`,
    entryCode: discussion.entry_code,
    metadata: {
        discussionId,
        createdBy: discussion.author
    }
});

// 결과를 클라이언트에 전송
res.json({
    shortUrl: shareLink.shortUrl,
    qrCode: shareLink.qrCode,
    entryCode: shareLink.entryCode
});
```

### 마케팅 캠페인

```javascript
// 캠페인 링크 생성
const campaignLink = await shortener.shorten({
    url: 'https://shop.example.com/sale',
    customAlias: 'summer-sale',
    expiresAt: new Date('2025-08-31'),
    metadata: {
        campaign: 'summer-2025',
        source: 'email',
        medium: 'newsletter'
    }
});

// 통계 확인
const stats = await shortener.getStats('summer-sale');
console.log(`${stats.clickCount}번 클릭됨`);
```

---

## 🛡️ 보안 고려사항

1. **관리 엔드포인트 보호**: `enableDelete`, `enableUpdate`, `enableList`는 기본적으로 비활성화됨
2. **인증 미들웨어 사용**: 민감한 작업에는 반드시 인증 적용
3. **Rate Limiting**: 남용 방지를 위해 Rate Limiting 구현 권장
4. **입력 검증**: 모든 입력은 Validator를 통해 검증됨
5. **SQL 인젝션 방지**: 파라미터화된 쿼리 사용

---

## 📝 라이센스

MIT License

---

## 🤝 기여

기여는 언제나 환영합니다! Pull Request를 보내주세요.

---

## 📧 문의

프로젝트에 대한 질문이나 제안 사항이 있으시면 이슈를 등록해주세요.
