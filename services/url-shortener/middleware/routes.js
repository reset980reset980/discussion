/**
 * Express 라우트 미들웨어
 * URL 단축 서비스 API 엔드포인트 자동 생성
 */

const express = require('express');

/**
 * 라우트 생성 팩토리 함수
 * @param {ShortUrlService} service - URL 단축 서비스 인스턴스
 * @param {Object} options - 라우트 옵션
 * @returns {express.Router}
 */
function createRoutes(service, options = {}) {
    const router = express.Router();

    const {
        enableCreate = true,
        enableRedirect = true,
        enableStats = true,
        enableDelete = false, // 기본적으로 비활성화 (보안)
        enableUpdate = false, // 기본적으로 비활성화 (보안)
        enableList = false,   // 기본적으로 비활성화 (보안)
        requireAuth = null    // 인증 미들웨어 (선택사항)
    } = options;

    // 인증 미들웨어 래퍼
    const auth = requireAuth || ((req, res, next) => next());

    // ===== 공개 엔드포인트 =====

    /**
     * POST /shorten
     * URL 단축
     */
    if (enableCreate) {
        router.post('/shorten', async (req, res) => {
            try {
                const {
                    url,
                    customAlias,
                    expiresAt,
                    entryCode,
                    metadata,
                    generateQR
                } = req.body;

                if (!url) {
                    return res.status(400).json({
                        error: 'URL이 필요합니다.'
                    });
                }

                const result = await service.shorten({
                    url,
                    customAlias,
                    expiresAt,
                    entryCode,
                    metadata,
                    generateQR
                });

                res.status(201).json({
                    success: true,
                    data: result
                });

            } catch (error) {
                console.error('URL 단축 오류:', error);
                res.status(400).json({
                    error: error.message
                });
            }
        });
    }

    /**
     * GET /check
     * 커스텀 별칭 사용 가능 여부 확인
     */
    router.get('/check', async (req, res) => {
        try {
            const { alias, domain } = req.query;

            if (!alias) {
                return res.status(400).json({
                    error: 'alias 파라미터가 필요합니다.'
                });
            }

            // storage에서 직접 확인
            const existing = await service.storage.getByCode(alias);

            res.json({
                available: !existing,
                alias: alias
            });

        } catch (error) {
            console.error('별칭 확인 오류:', error);
            res.status(500).json({
                error: '별칭 확인 중 오류가 발생했습니다.'
            });
        }
    });

    /**
     * GET /:codeOrAlias
     * 단축 URL 리다이렉션
     */
    if (enableRedirect) {
        router.get('/:codeOrAlias', async (req, res) => {
            try {
                const { codeOrAlias } = req.params;

                // 분석 데이터 수집
                const analyticsData = {
                    referer: req.get('referer'),
                    userAgent: req.get('user-agent'),
                    ipAddress: req.ip || req.connection.remoteAddress
                };

                const result = await service.resolve(codeOrAlias, analyticsData);

                // 입장 코드가 설정된 경우 쿼리 파라미터로 확인
                if (result.entryCode) {
                    const providedCode = req.query.code || req.query.entryCode;

                    if (providedCode !== result.entryCode) {
                        return res.status(403).json({
                            error: '입장 코드가 필요합니다.',
                            requiresEntryCode: true
                        });
                    }
                }

                // 리다이렉션
                res.redirect(302, result.originalUrl);

            } catch (error) {
                console.error('리다이렉션 오류:', error);

                // 404 페이지로 리다이렉션 (옵션)
                if (options.notFoundRedirect) {
                    return res.redirect(options.notFoundRedirect);
                }

                res.status(404).json({
                    error: error.message
                });
            }
        });
    }

    // ===== 통계 엔드포인트 =====

    /**
     * GET /:codeOrAlias/stats
     * 통계 조회
     */
    if (enableStats) {
        router.get('/:codeOrAlias/stats', async (req, res) => {
            try {
                const { codeOrAlias } = req.params;

                const stats = await service.getStats(codeOrAlias);

                res.json({
                    success: true,
                    data: stats
                });

            } catch (error) {
                console.error('통계 조회 오류:', error);
                res.status(404).json({
                    error: error.message
                });
            }
        });
    }

    // ===== 관리 엔드포인트 (인증 필요) =====

    /**
     * GET /list
     * 목록 조회
     */
    if (enableList) {
        router.get('/list', auth, async (req, res) => {
            try {
                const {
                    page = 1,
                    limit = 20,
                    sortBy = 'created_at',
                    order = 'desc'
                } = req.query;

                const result = await service.list({
                    page: parseInt(page),
                    limit: parseInt(limit),
                    sortBy,
                    order
                });

                res.json({
                    success: true,
                    data: result
                });

            } catch (error) {
                console.error('목록 조회 오류:', error);
                res.status(500).json({
                    error: error.message
                });
            }
        });
    }

    /**
     * PATCH /:codeOrAlias
     * 단축 URL 업데이트
     */
    if (enableUpdate) {
        router.patch('/:codeOrAlias', auth, async (req, res) => {
            try {
                const { codeOrAlias } = req.params;
                const updates = req.body;

                const result = await service.update(codeOrAlias, updates);

                res.json({
                    success: true,
                    data: result
                });

            } catch (error) {
                console.error('업데이트 오류:', error);
                res.status(400).json({
                    error: error.message
                });
            }
        });
    }

    /**
     * DELETE /:codeOrAlias
     * 단축 URL 삭제
     */
    if (enableDelete) {
        router.delete('/:codeOrAlias', auth, async (req, res) => {
            try {
                const { codeOrAlias } = req.params;

                const success = await service.delete(codeOrAlias);

                res.json({
                    success,
                    message: success ? '삭제되었습니다.' : '삭제에 실패했습니다.'
                });

            } catch (error) {
                console.error('삭제 오류:', error);
                res.status(400).json({
                    error: error.message
                });
            }
        });
    }

    // ===== 시스템 엔드포인트 =====

    /**
     * GET /health
     * 헬스 체크
     */
    router.get('/health', async (req, res) => {
        try {
            const healthy = await service.healthCheck();

            res.status(healthy ? 200 : 503).json({
                status: healthy ? 'healthy' : 'unhealthy',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            res.status(503).json({
                status: 'unhealthy',
                error: error.message
            });
        }
    });

    /**
     * GET /stats/overall
     * 전체 통계 (인증 필요)
     */
    if (enableStats && enableList) {
        router.get('/stats/overall', auth, async (req, res) => {
            try {
                const stats = await service.getOverallStats();

                res.json({
                    success: true,
                    data: stats
                });

            } catch (error) {
                console.error('전체 통계 조회 오류:', error);
                res.status(500).json({
                    error: error.message
                });
            }
        });
    }

    return router;
}

module.exports = createRoutes;
