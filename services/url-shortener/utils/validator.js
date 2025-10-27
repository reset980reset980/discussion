/**
 * URL 및 입력 검증 유틸리티
 */

class Validator {
    /**
     * URL 유효성 검증
     * @param {string} url
     * @returns {Object} { valid: boolean, error?: string, normalized?: string }
     */
    static validateUrl(url) {
        // 빈 값 체크
        if (!url || typeof url !== 'string') {
            return { valid: false, error: 'URL이 제공되지 않았습니다.' };
        }

        // 공백 제거
        url = url.trim();

        // URL 길이 체크 (최대 2048자)
        if (url.length > 2048) {
            return { valid: false, error: 'URL이 너무 깁니다. (최대 2048자)' };
        }

        // 최소 길이 체크
        if (url.length < 10) {
            return { valid: false, error: 'URL이 너무 짧습니다.' };
        }

        // HTTP/HTTPS 프로토콜 확인 및 추가
        if (!url.match(/^https?:\/\//i)) {
            url = 'https://' + url;
        }

        // URL 파싱 시도
        try {
            const parsedUrl = new URL(url);

            // 로컬호스트 차단 (옵션)
            if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') {
                return { valid: false, error: '로컬호스트 URL은 단축할 수 없습니다.' };
            }

            // 허용된 프로토콜만 통과
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                return { valid: false, error: 'HTTP/HTTPS 프로토콜만 지원됩니다.' };
            }

            return {
                valid: true,
                normalized: parsedUrl.toString()
            };

        } catch (error) {
            return {
                valid: false,
                error: '올바른 URL 형식이 아닙니다.'
            };
        }
    }

    /**
     * 커스텀 별칭 검증
     * @param {string} alias
     * @param {Object} options
     * @returns {Object} { valid: boolean, error?: string }
     */
    static validateAlias(alias, options = {}) {
        const minLength = options.minLength || 3;
        const maxLength = options.maxLength || 30;
        const allowedPattern = options.allowedPattern || /^[a-zA-Z0-9_-]+$/;

        // 빈 값 체크
        if (!alias || typeof alias !== 'string') {
            return { valid: false, error: '별칭이 제공되지 않았습니다.' };
        }

        // 공백 제거
        alias = alias.trim();

        // 길이 체크
        if (alias.length < minLength) {
            return {
                valid: false,
                error: `별칭은 최소 ${minLength}자 이상이어야 합니다.`
            };
        }

        if (alias.length > maxLength) {
            return {
                valid: false,
                error: `별칭은 최대 ${maxLength}자까지 가능합니다.`
            };
        }

        // 패턴 검증 (영문, 숫자, 하이픈, 언더스코어만 허용)
        if (!allowedPattern.test(alias)) {
            return {
                valid: false,
                error: '별칭은 영문, 숫자, 하이픈(-), 언더스코어(_)만 사용할 수 있습니다.'
            };
        }

        // 예약어 체크
        const reservedWords = ['api', 'admin', 'analytics', 's', 'short', 'url', 'link'];
        if (reservedWords.includes(alias.toLowerCase())) {
            return {
                valid: false,
                error: '이 별칭은 예약된 단어입니다.'
            };
        }

        return { valid: true };
    }

    /**
     * 만료 시간 검증
     * @param {Date|number|string} expiresAt
     * @returns {Object} { valid: boolean, error?: string, normalized?: Date }
     */
    static validateExpiration(expiresAt) {
        if (!expiresAt) {
            return { valid: true, normalized: null }; // 만료 없음
        }

        let expirationDate;

        // Date 객체인 경우
        if (expiresAt instanceof Date) {
            expirationDate = expiresAt;
        }
        // 숫자인 경우 (타임스탬프)
        else if (typeof expiresAt === 'number') {
            expirationDate = new Date(expiresAt);
        }
        // 문자열인 경우
        else if (typeof expiresAt === 'string') {
            expirationDate = new Date(expiresAt);
        }
        else {
            return { valid: false, error: '올바른 만료 시간 형식이 아닙니다.' };
        }

        // 유효한 날짜인지 확인
        if (isNaN(expirationDate.getTime())) {
            return { valid: false, error: '올바른 날짜가 아닙니다.' };
        }

        // 과거 날짜인지 확인
        if (expirationDate <= new Date()) {
            return { valid: false, error: '만료 시간은 미래여야 합니다.' };
        }

        // 최대 만료 기간 확인 (예: 1년)
        const maxExpiration = new Date();
        maxExpiration.setFullYear(maxExpiration.getFullYear() + 1);

        if (expirationDate > maxExpiration) {
            return {
                valid: false,
                error: '만료 시간은 최대 1년까지 설정할 수 있습니다.'
            };
        }

        return {
            valid: true,
            normalized: expirationDate
        };
    }

    /**
     * 입장 코드 검증
     * @param {string} entryCode
     * @returns {Object} { valid: boolean, error?: string }
     */
    static validateEntryCode(entryCode) {
        if (!entryCode) {
            return { valid: true }; // 입장 코드 선택사항
        }

        if (typeof entryCode !== 'string') {
            return { valid: false, error: '입장 코드는 문자열이어야 합니다.' };
        }

        entryCode = entryCode.trim();

        // 길이 체크 (4-10자)
        if (entryCode.length < 4 || entryCode.length > 10) {
            return {
                valid: false,
                error: '입장 코드는 4-10자 사이여야 합니다.'
            };
        }

        // 숫자 또는 영문+숫자 조합만 허용
        if (!/^[a-zA-Z0-9]+$/.test(entryCode)) {
            return {
                valid: false,
                error: '입장 코드는 영문과 숫자만 사용할 수 있습니다.'
            };
        }

        return { valid: true };
    }

    /**
     * 메타데이터 검증
     * @param {Object} metadata
     * @returns {Object} { valid: boolean, error?: string }
     */
    static validateMetadata(metadata) {
        if (!metadata) {
            return { valid: true };
        }

        if (typeof metadata !== 'object' || Array.isArray(metadata)) {
            return {
                valid: false,
                error: '메타데이터는 객체 형식이어야 합니다.'
            };
        }

        // JSON으로 직렬화 가능한지 확인
        try {
            const serialized = JSON.stringify(metadata);

            // 크기 제한 (1MB)
            if (serialized.length > 1024 * 1024) {
                return {
                    valid: false,
                    error: '메타데이터가 너무 큽니다. (최대 1MB)'
                };
            }

            return { valid: true };

        } catch (error) {
            return {
                valid: false,
                error: '메타데이터를 JSON으로 변환할 수 없습니다.'
            };
        }
    }

    /**
     * 생성 옵션 전체 검증
     * @param {Object} options
     * @returns {Object} { valid: boolean, errors: Array<string> }
     */
    static validateCreateOptions(options) {
        const errors = [];

        // URL 검증
        const urlValidation = this.validateUrl(options.url);
        if (!urlValidation.valid) {
            errors.push(urlValidation.error);
        }

        // 커스텀 별칭 검증 (제공된 경우)
        if (options.customAlias) {
            const aliasValidation = this.validateAlias(options.customAlias);
            if (!aliasValidation.valid) {
                errors.push(aliasValidation.error);
            }
        }

        // 만료 시간 검증 (제공된 경우)
        if (options.expiresAt) {
            const expirationValidation = this.validateExpiration(options.expiresAt);
            if (!expirationValidation.valid) {
                errors.push(expirationValidation.error);
            }
        }

        // 입장 코드 검증 (제공된 경우)
        if (options.entryCode) {
            const entryCodeValidation = this.validateEntryCode(options.entryCode);
            if (!entryCodeValidation.valid) {
                errors.push(entryCodeValidation.error);
            }
        }

        // 메타데이터 검증 (제공된 경우)
        if (options.metadata) {
            const metadataValidation = this.validateMetadata(options.metadata);
            if (!metadataValidation.valid) {
                errors.push(metadataValidation.error);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

module.exports = Validator;
