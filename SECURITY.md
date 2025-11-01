# 🔒 보안 가이드

이 문서는 Discussion Board 프로젝트의 보안 모범 사례를 설명합니다.

## 📋 현재 적용된 보안 설정

### 1. NPM 보안 설정 (.npmrc)
- ✅ **정확한 버전 고정** (`save-exact=true`) - 자동 업데이트 방지
- ✅ **라이프사이클 스크립트 비활성화** (`ignore-scripts=true`) - 악성 스크립트 실행 방지
- ✅ **보안 감사 활성화** (`audit=true`) - 패키지 설치 시 자동 취약점 검사
- ✅ **엄격한 SSL 검증** (`strict-ssl=true`) - 중간자 공격 방지

### 2. 의존성 관리
- ✅ `package-lock.json` 커밋 및 관리
- ✅ 정기적인 보안 감사 (`npm audit`)
- ⚠️ **권장**: 의존성 버전 고정 (현재 `^` 버전 사용 중)

### 3. 환경 변수 보안
- ✅ `.env` 파일 gitignore 처리
- ✅ `.env.example` 템플릿 제공
- ✅ 민감한 정보 (API 키, DB 비밀번호) 환경 변수로 관리

### 4. Git 보안
- ✅ 민감한 파일 `.gitignore`에 포함:
  - 환경 변수 파일 (.env*)
  - 인증서 파일 (*.pem, *.key, *.cert)
  - 비밀 정보 디렉토리 (secrets/)

## 🚀 보안 명령어

```bash
# 보안 취약점 검사
npm run audit

# 자동 수정 가능한 취약점 수정
npm run audit:fix

# 취약점 검사 + 오래된 패키지 확인
npm run security:check

# 패키지 업데이트 확인
npm outdated
```

## 📝 개발 시 보안 체크리스트

### 의존성 추가 시
- [ ] 패키지 신뢰성 확인 (다운로드 수, 유지보수 상태)
- [ ] 최소 릴리스 나이 확인 (24시간 이상 경과)
- [ ] 라이선스 확인
- [ ] 보안 취약점 확인 (`npm audit`)

### 코드 작성 시
- [ ] 사용자 입력 검증 및 새니타이징
- [ ] SQL 인젝션 방지 (파라미터화된 쿼리)
- [ ] XSS 공격 방지 (HTML 이스케이프)
- [ ] 인증/인가 검증
- [ ] 에러 메시지에 민감한 정보 포함 금지

### 배포 전
- [ ] `npm audit` 실행 및 취약점 해결
- [ ] 환경 변수 설정 확인
- [ ] HTTPS 사용 확인
- [ ] CORS 설정 검토
- [ ] Rate Limiting 적용

## 🛡️ 추가 보안 권장사항

### 1. 의존성 버전 고정
현재 package.json의 모든 의존성이 `^` (캐럿) 버전을 사용하고 있어 자동 업데이트가 가능합니다.

**현재 상태:**
```json
{
  "dependencies": {
    "express": "^4.18.2",  // 4.x.x의 모든 버전 허용
    "socket.io": "^4.8.1"  // 4.x.x의 모든 버전 허용
  }
}
```

**권장 방법:**
```bash
# 새 패키지 설치 시 정확한 버전으로 저장 (자동 적용됨)
npm install express

# 또는 기존 package.json의 ^ 제거
# "express": "4.18.2" (^ 없이)
```

### 2. 정기적인 보안 점검
```bash
# 주간 보안 점검 (권장)
npm audit
npm outdated

# 월간 의존성 업데이트 (신중히)
npm update
npm audit fix
```

### 3. CI/CD 보안
```yaml
# GitHub Actions 예시
- name: Security Audit
  run: |
    npm audit --audit-level=moderate
    npm run security:check
```

### 4. 프로덕션 환경 변수
```env
# .env.production
NODE_ENV=production
DB_PASSWORD=<강력한_비밀번호>
GEMINI_API_KEY=<실제_API_키>

# 보안 헤더
HELMET_ENABLED=true
RATE_LIMIT_ENABLED=true
```

### 5. 데이터베이스 보안
- [ ] 최소 권한 원칙 적용 (DB 사용자 권한 제한)
- [ ] 파라미터화된 쿼리 사용 (SQL 인젝션 방지)
- [ ] 민감한 데이터 암호화
- [ ] 정기적인 백업

### 6. 네트워크 보안
- [ ] HTTPS/TLS 사용
- [ ] CORS 정책 엄격히 설정
- [ ] Rate Limiting 적용
- [ ] Helmet.js로 보안 헤더 설정

## 🔐 보안 취약점 발견 시

보안 취약점을 발견하신 경우:
1. GitHub Issues에 비공개로 보고
2. 심각한 취약점은 직접 이메일 연락
3. 패치 전까지 공개하지 않음

## 📚 참고 자료

- [NPM Security Best Practices](https://github.com/bodadotsh/npm-security-best-practices)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

---

**마지막 업데이트:** 2025-11-01
