/**
 * URL Shortener 기본 사용 예시
 */

const { createShortener } = require('../index');

async function main() {
    try {
        // 1. URL 단축 서비스 초기화
        console.log('🚀 URL 단축 서비스 초기화 중...\n');

        const shortener = await createShortener({
            baseUrl: 'https://discussion.keesdconsulting.uk',
            storage: {
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT) || 5432,
                user: process.env.DB_USER || 'postgres',
                password: String(process.env.DB_PASSWORD || ''),
                database: process.env.DB_NAME || 'vibedb'
            },
            codeGenerator: {
                length: 6,
                charset: 'safe',  // 혼동 방지 문자셋
                strategy: 'random'
            },
            enableQR: true,
            enableAnalytics: true,
            reuseExisting: false
        });

        console.log('✅ 초기화 완료\n');

        // 2. 기본 URL 단축
        console.log('📝 URL 단축 테스트...');
        const basic = await shortener.shorten({
            url: 'https://example.com/very/long/url/path/with/many/segments'
        });

        console.log('  단축 코드:', basic.shortCode);
        console.log('  단축 URL:', basic.shortUrl);
        console.log('  QR 코드:', basic.qrCode.substring(0, 50) + '...');
        console.log('');

        // 3. 커스텀 별칭 사용
        console.log('🎯 커스텀 별칭 테스트...');
        const customAlias = await shortener.shorten({
            url: 'https://example.com/custom-link',
            customAlias: 'my-custom-link'
        });

        console.log('  커스텀 별칭:', customAlias.customAlias);
        console.log('  단축 URL:', customAlias.shortUrl);
        console.log('');

        // 4. 만료 시간 설정
        console.log('⏰ 만료 시간 설정 테스트...');
        const expiringUrl = await shortener.shorten({
            url: 'https://example.com/temporary-link',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24시간 후
        });

        console.log('  단축 URL:', expiringUrl.shortUrl);
        console.log('  만료 시간:', expiringUrl.expiresAt);
        console.log('');

        // 5. 입장 코드 보호
        console.log('🔒 입장 코드 보호 테스트...');
        const protectedUrl = await shortener.shorten({
            url: 'https://example.com/protected-content',
            entryCode: '1234',
            customAlias: 'protected-link'
        });

        console.log('  단축 URL:', protectedUrl.shortUrl);
        console.log('  입장 코드:', protectedUrl.entryCode);
        console.log('');

        // 6. 메타데이터 포함
        console.log('📊 메타데이터 포함 테스트...');
        const withMetadata = await shortener.shorten({
            url: 'https://example.com/campaign-link',
            metadata: {
                campaign: 'summer-2025',
                source: 'email',
                userId: 12345
            }
        });

        console.log('  단축 URL:', withMetadata.shortUrl);
        console.log('  메타데이터:', JSON.stringify(withMetadata.metadata));
        console.log('');

        // 7. URL 해석 (리다이렉션 시뮬레이션)
        console.log('🔍 URL 해석 테스트...');
        const resolved = await shortener.resolve(basic.shortCode, {
            referer: 'https://google.com',
            userAgent: 'Mozilla/5.0...',
            ipAddress: '192.168.1.1'
        });

        console.log('  원본 URL:', resolved.originalUrl);
        console.log('');

        // 8. 통계 조회
        console.log('📈 통계 조회 테스트...');
        const stats = await shortener.getStats(basic.shortCode);

        console.log('  클릭 수:', stats.clickCount);
        console.log('  생성 시간:', stats.createdAt);
        console.log('  마지막 접속:', stats.lastAccessedAt);
        console.log('');

        // 9. 목록 조회
        console.log('📋 목록 조회 테스트...');
        const list = await shortener.list({
            page: 1,
            limit: 5,
            sortBy: 'created_at',
            order: 'desc'
        });

        console.log('  총 개수:', list.total);
        console.log('  페이지:', list.page + '/' + list.totalPages);
        console.log('  항목:');
        list.items.slice(0, 3).forEach(item => {
            console.log(`    - ${item.shortUrl} → ${item.originalUrl}`);
        });
        console.log('');

        // 10. 전체 통계
        console.log('🌐 전체 통계 조회...');
        const overallStats = await shortener.getOverallStats();

        console.log('  총 URL 수:', overallStats.totalUrls);
        console.log('  총 클릭 수:', overallStats.totalClicks);
        console.log('');

        // 11. 헬스 체크
        console.log('💚 헬스 체크...');
        const healthy = await shortener.healthCheck();

        console.log('  상태:', healthy ? '✅ 정상' : '❌ 비정상');
        console.log('');

        // 12. 삭제 (옵션)
        console.log('🗑️  삭제 테스트...');
        const deleted = await shortener.delete(basic.shortCode);

        console.log('  삭제 결과:', deleted ? '✅ 성공' : '❌ 실패');
        console.log('');

        console.log('🎉 모든 테스트 완료!');

        // 연결 종료
        await shortener.storage.disconnect();

    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
        console.error(error.stack);
    }
}

// 실행
if (require.main === module) {
    require('dotenv').config({ path: '../../../.env' });
    main();
}

module.exports = main;
