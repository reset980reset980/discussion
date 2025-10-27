/**
 * 추상 스토리지 어댑터 베이스 클래스
 * 다양한 데이터베이스 구현을 위한 인터페이스 정의
 */

class BaseAdapter {
    /**
     * @param {Object} options - 어댑터별 설정 옵션
     */
    constructor(options = {}) {
        this.options = options;
        this.connected = false;
    }

    /**
     * 데이터베이스 연결 초기화
     * @abstract
     * @returns {Promise<void>}
     */
    async connect() {
        throw new Error('connect() must be implemented by subclass');
    }

    /**
     * 데이터베이스 연결 종료
     * @abstract
     * @returns {Promise<void>}
     */
    async disconnect() {
        throw new Error('disconnect() must be implemented by subclass');
    }

    /**
     * 단축 URL 생성
     * @abstract
     * @param {Object} data
     * @param {string} data.shortCode - 생성된 단축 코드
     * @param {string} data.originalUrl - 원본 URL
     * @param {string} [data.customAlias] - 커스텀 별칭
     * @param {Date} [data.expiresAt] - 만료 시간
     * @param {string} [data.entryCode] - 입장 코드
     * @param {Object} [data.metadata] - 추가 메타데이터
     * @param {string} [data.qrCode] - QR 코드 데이터 (Base64)
     * @returns {Promise<Object>} 생성된 단축 URL 정보
     */
    async create(data) {
        throw new Error('create() must be implemented by subclass');
    }

    /**
     * 단축 코드로 원본 URL 조회
     * @abstract
     * @param {string} shortCode - 단축 코드
     * @returns {Promise<Object|null>} 단축 URL 정보 또는 null
     */
    async findByShortCode(shortCode) {
        throw new Error('findByShortCode() must be implemented by subclass');
    }

    /**
     * 커스텀 별칭으로 조회
     * @abstract
     * @param {string} alias - 커스텀 별칭
     * @returns {Promise<Object|null>}
     */
    async findByAlias(alias) {
        throw new Error('findByAlias() must be implemented by subclass');
    }

    /**
     * 원본 URL로 기존 단축 URL 조회
     * @abstract
     * @param {string} originalUrl - 원본 URL
     * @returns {Promise<Object|null>}
     */
    async findByOriginalUrl(originalUrl) {
        throw new Error('findByOriginalUrl() must be implemented by subclass');
    }

    /**
     * 클릭 수 증가
     * @abstract
     * @param {string} shortCode - 단축 코드
     * @returns {Promise<void>}
     */
    async incrementClickCount(shortCode) {
        throw new Error('incrementClickCount() must be implemented by subclass');
    }

    /**
     * 클릭 기록 추가 (분석용)
     * @abstract
     * @param {Object} data
     * @param {string} data.shortCode - 단축 코드
     * @param {string} [data.referer] - 리퍼러
     * @param {string} [data.userAgent] - 사용자 에이전트
     * @param {string} [data.ipAddress] - IP 주소
     * @returns {Promise<void>}
     */
    async recordClick(data) {
        throw new Error('recordClick() must be implemented by subclass');
    }

    /**
     * 만료된 URL 삭제
     * @abstract
     * @returns {Promise<number>} 삭제된 개수
     */
    async deleteExpired() {
        throw new Error('deleteExpired() must be implemented by subclass');
    }

    /**
     * 단축 URL 삭제
     * @abstract
     * @param {string} shortCode - 단축 코드
     * @returns {Promise<boolean>} 삭제 성공 여부
     */
    async delete(shortCode) {
        throw new Error('delete() must be implemented by subclass');
    }

    /**
     * 단축 URL 업데이트
     * @abstract
     * @param {string} shortCode - 단축 코드
     * @param {Object} updates - 업데이트할 필드
     * @returns {Promise<Object>} 업데이트된 정보
     */
    async update(shortCode, updates) {
        throw new Error('update() must be implemented by subclass');
    }

    /**
     * 통계 정보 조회
     * @abstract
     * @param {string} shortCode - 단축 코드
     * @returns {Promise<Object>} 통계 정보
     */
    async getStats(shortCode) {
        throw new Error('getStats() must be implemented by subclass');
    }

    /**
     * 전체 통계 조회
     * @abstract
     * @returns {Promise<Object>} 전체 통계
     */
    async getOverallStats() {
        throw new Error('getOverallStats() must be implemented by subclass');
    }

    /**
     * 단축 URL 목록 조회 (페이징)
     * @abstract
     * @param {Object} options
     * @param {number} [options.page] - 페이지 번호
     * @param {number} [options.limit] - 페이지당 항목 수
     * @param {string} [options.sortBy] - 정렬 기준 (created_at, click_count 등)
     * @param {string} [options.order] - 정렬 순서 (asc, desc)
     * @returns {Promise<Object>} { items: Array, total: number, page: number, limit: number }
     */
    async list(options = {}) {
        throw new Error('list() must be implemented by subclass');
    }

    /**
     * 헬스 체크
     * @abstract
     * @returns {Promise<boolean>} 연결 상태
     */
    async healthCheck() {
        throw new Error('healthCheck() must be implemented by subclass');
    }
}

module.exports = BaseAdapter;
