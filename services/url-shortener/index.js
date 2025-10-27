/**
 * URL Shortener Module
 * 재사용 가능한 독립형 URL 단축 서비스
 *
 * @module url-shortener
 * @version 1.0.0
 */

const ShortUrlService = require('./ShortUrlService');
const QRService = require('./QRService');
const CodeGenerator = require('./utils/codeGenerator');
const Validator = require('./utils/validator');
const createRoutes = require('./middleware/routes');

// Storage Adapters
const BaseAdapter = require('./storage/BaseAdapter');
const PostgreSQLAdapter = require('./storage/PostgreSQLAdapter');

/**
 * URL 단축 서비스 팩토리
 * @param {Object} config
 * @returns {Promise<ShortUrlService>}
 */
async function createShortener(config = {}) {
    // 필수 설정 확인
    if (!config.baseUrl) {
        throw new Error('baseUrl is required');
    }

    // 스토리지 어댑터 생성
    let storage;

    if (config.storage && typeof config.storage === 'object' && config.storage.connect) {
        // 커스텀 어댑터가 제공된 경우
        storage = config.storage;
    } else {
        // 기본 PostgreSQL 어댑터 사용
        const storageType = config.storageType || 'postgresql';

        switch (storageType.toLowerCase()) {
            case 'postgresql':
            case 'postgres':
            case 'pg':
                storage = new PostgreSQLAdapter(config.storage || {});
                break;

            // 추가 어댑터는 여기에 구현
            // case 'mysql':
            //     storage = new MySQLAdapter(config.storage || {});
            //     break;

            default:
                throw new Error(`Unsupported storage type: ${storageType}`);
        }
    }

    // 스토리지 연결
    await storage.connect();

    // 서비스 생성
    const service = new ShortUrlService({
        storage,
        baseUrl: config.baseUrl,
        codeGenerator: config.codeGenerator,
        qr: config.qr,
        enableQR: config.enableQR,
        enableAnalytics: config.enableAnalytics,
        reuseExisting: config.reuseExisting,
        maxRetries: config.maxRetries
    });

    // Express 라우트 생성 메서드 추가
    service.routes = function(routeOptions = {}) {
        return createRoutes(service, routeOptions);
    };

    // 만료된 URL 자동 정리 (옵션)
    if (config.autoCleanup) {
        const interval = config.cleanupInterval || 3600000; // 기본 1시간

        setInterval(async () => {
            try {
                const count = await service.cleanupExpired();
                if (count > 0) {
                    console.log(`Cleaned up ${count} expired URLs`);
                }
            } catch (error) {
                console.error('Auto cleanup error:', error);
            }
        }, interval);
    }

    return service;
}

// 클래스와 유틸리티 직접 export
module.exports = {
    // Factory function
    createShortener,

    // Classes
    ShortUrlService,
    QRService,
    CodeGenerator,
    Validator,

    // Storage Adapters
    BaseAdapter,
    PostgreSQLAdapter,

    // Middleware
    createRoutes
};
