/**
 * URL 단축 서비스 핵심 비즈니스 로직
 */

const CodeGenerator = require('./utils/codeGenerator');
const Validator = require('./utils/validator');
const QRService = require('./QRService');

class ShortUrlService {
    /**
     * @param {Object} options
     * @param {Object} options.storage - 스토리지 어댑터
     * @param {string} options.baseUrl - 기본 URL (예: https://example.com)
     * @param {Object} options.codeGenerator - 코드 생성 옵션
     * @param {Object} options.qr - QR 코드 옵션
     * @param {boolean} options.enableQR - QR 코드 자동 생성 활성화
     * @param {boolean} options.enableAnalytics - 분석 기능 활성화
     * @param {boolean} options.reuseExisting - 같은 URL 재사용 여부
     */
    constructor(options = {}) {
        if (!options.storage) {
            throw new Error('Storage adapter is required');
        }

        if (!options.baseUrl) {
            throw new Error('Base URL is required');
        }

        this.storage = options.storage;
        this.baseUrl = options.baseUrl.replace(/\/$/, ''); // 마지막 슬래시 제거

        this.codeGenerator = new CodeGenerator(options.codeGenerator || {});
        this.qrService = new QRService(options.qr || {});

        this.enableQR = options.enableQR !== false; // 기본값: true
        this.enableAnalytics = options.enableAnalytics !== false; // 기본값: true
        this.reuseExisting = options.reuseExisting || false;

        this.maxRetries = options.maxRetries || 10; // 충돌 시 재시도 횟수
    }

    /**
     * URL 단축
     * @param {Object} params
     * @param {string} params.url - 원본 URL
     * @param {string} [params.customAlias] - 커스텀 별칭
     * @param {Date|number|string} [params.expiresAt] - 만료 시간
     * @param {string} [params.entryCode] - 입장 코드
     * @param {Object} [params.metadata] - 추가 메타데이터
     * @param {boolean} [params.generateQR] - QR 코드 생성 여부
     * @returns {Promise<Object>}
     */
    async shorten(params) {
        // 유효성 검증
        const validation = Validator.validateCreateOptions(params);
        if (!validation.valid) {
            throw new Error(validation.errors.join(', '));
        }

        // URL 정규화
        const urlValidation = Validator.validateUrl(params.url);
        const normalizedUrl = urlValidation.normalized;

        // 기존 URL 재사용 옵션이 활성화된 경우
        if (this.reuseExisting) {
            const existing = await this.storage.findByOriginalUrl(normalizedUrl);
            if (existing) {
                return this.formatResponse(existing);
            }
        }

        // 커스텀 별칭이 있는 경우 충돌 체크
        if (params.customAlias) {
            const existingAlias = await this.storage.findByAlias(params.customAlias);
            if (existingAlias) {
                throw new Error('이 별칭은 이미 사용 중입니다.');
            }
        }

        // 단축 코드 생성 (충돌 시 재시도)
        let shortCode;
        let retries = 0;

        while (retries < this.maxRetries) {
            shortCode = this.codeGenerator.generate();

            // 충돌 체크
            const existing = await this.storage.findByShortCode(shortCode);
            if (!existing) {
                break;
            }

            retries++;
        }

        if (retries >= this.maxRetries) {
            throw new Error('단축 코드 생성에 실패했습니다. 다시 시도해주세요.');
        }

        // QR 코드 생성
        let qrCode = null;
        if (this.enableQR && params.generateQR !== false) {
            const shortUrl = this.getShortUrl(shortCode);
            qrCode = await this.qrService.generateDataURL(shortUrl);
        }

        // 만료 시간 정규화
        let expiresAt = null;
        if (params.expiresAt) {
            const expirationValidation = Validator.validateExpiration(params.expiresAt);
            if (expirationValidation.valid) {
                expiresAt = expirationValidation.normalized;
            }
        }

        // 데이터베이스에 저장
        const data = {
            shortCode,
            originalUrl: normalizedUrl,
            customAlias: params.customAlias || null,
            expiresAt,
            entryCode: params.entryCode || null,
            metadata: params.metadata || null,
            qrCode
        };

        const created = await this.storage.create(data);

        return this.formatResponse(created);
    }

    /**
     * 단축 URL로 리다이렉션
     * @param {string} codeOrAlias - 단축 코드 또는 커스텀 별칭
     * @param {Object} analyticsData - 분석용 데이터
     * @returns {Promise<Object>}
     */
    async resolve(codeOrAlias, analyticsData = {}) {
        // 코드 또는 별칭으로 조회
        let urlData = await this.storage.findByShortCode(codeOrAlias);

        if (!urlData) {
            urlData = await this.storage.findByAlias(codeOrAlias);
        }

        if (!urlData) {
            throw new Error('단축 URL을 찾을 수 없습니다.');
        }

        // 만료 체크
        if (urlData.expiresAt && new Date(urlData.expiresAt) < new Date()) {
            throw new Error('이 단축 URL은 만료되었습니다.');
        }

        // 클릭 수 증가
        await this.storage.incrementClickCount(urlData.shortCode);

        // 분석 데이터 기록
        if (this.enableAnalytics) {
            await this.storage.recordClick({
                shortCode: urlData.shortCode,
                ...analyticsData
            });
        }

        return {
            originalUrl: urlData.originalUrl,
            entryCode: urlData.entryCode,
            metadata: urlData.metadata
        };
    }

    /**
     * 통계 조회
     * @param {string} codeOrAlias
     * @returns {Promise<Object>}
     */
    async getStats(codeOrAlias) {
        let urlData = await this.storage.findByShortCode(codeOrAlias);

        if (!urlData) {
            urlData = await this.storage.findByAlias(codeOrAlias);
        }

        if (!urlData) {
            throw new Error('단축 URL을 찾을 수 없습니다.');
        }

        const stats = await this.storage.getStats(urlData.shortCode);

        return {
            ...stats,
            shortUrl: this.getShortUrl(urlData.shortCode)
        };
    }

    /**
     * 단축 URL 삭제
     * @param {string} codeOrAlias
     * @returns {Promise<boolean>}
     */
    async delete(codeOrAlias) {
        let urlData = await this.storage.findByShortCode(codeOrAlias);

        if (!urlData) {
            urlData = await this.storage.findByAlias(codeOrAlias);
        }

        if (!urlData) {
            throw new Error('단축 URL을 찾을 수 없습니다.');
        }

        return await this.storage.delete(urlData.shortCode);
    }

    /**
     * 단축 URL 업데이트
     * @param {string} codeOrAlias
     * @param {Object} updates
     * @returns {Promise<Object>}
     */
    async update(codeOrAlias, updates) {
        let urlData = await this.storage.findByShortCode(codeOrAlias);

        if (!urlData) {
            urlData = await this.storage.findByAlias(codeOrAlias);
        }

        if (!urlData) {
            throw new Error('단축 URL을 찾을 수 없습니다.');
        }

        // 업데이트 검증
        if (updates.url) {
            const urlValidation = Validator.validateUrl(updates.url);
            if (!urlValidation.valid) {
                throw new Error(urlValidation.error);
            }
            updates.originalUrl = urlValidation.normalized;
            delete updates.url;
        }

        if (updates.expiresAt) {
            const expirationValidation = Validator.validateExpiration(updates.expiresAt);
            if (!expirationValidation.valid) {
                throw new Error(expirationValidation.error);
            }
            updates.expiresAt = expirationValidation.normalized;
        }

        const updated = await this.storage.update(urlData.shortCode, updates);

        return this.formatResponse(updated);
    }

    /**
     * 목록 조회
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async list(options = {}) {
        const result = await this.storage.list(options);

        return {
            ...result,
            items: result.items.map(item => this.formatResponse(item))
        };
    }

    /**
     * 만료된 URL 정리
     * @returns {Promise<number>} 삭제된 개수
     */
    async cleanupExpired() {
        return await this.storage.deleteExpired();
    }

    /**
     * 전체 통계
     * @returns {Promise<Object>}
     */
    async getOverallStats() {
        return await this.storage.getOverallStats();
    }

    /**
     * 헬스 체크
     * @returns {Promise<boolean>}
     */
    async healthCheck() {
        return await this.storage.healthCheck();
    }

    /**
     * 완전한 단축 URL 생성
     * @param {string} shortCode
     * @returns {string}
     */
    getShortUrl(shortCode) {
        return `${this.baseUrl}/s/${shortCode}`;
    }

    /**
     * 응답 포맷팅
     * @param {Object} data
     * @returns {Object}
     */
    formatResponse(data) {
        return {
            shortCode: data.shortCode,
            shortUrl: this.getShortUrl(data.shortCode),
            originalUrl: data.originalUrl,
            customAlias: data.customAlias,
            qrCode: data.qrCode,
            entryCode: data.entryCode,
            metadata: data.metadata,
            clickCount: data.clickCount,
            createdAt: data.createdAt,
            expiresAt: data.expiresAt,
            lastAccessedAt: data.lastAccessedAt
        };
    }
}

module.exports = ShortUrlService;
