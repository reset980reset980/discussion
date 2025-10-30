/**
 * 간단한 URL 단축 테스트 (하드코딩된 설정)
 */

const { createShortener } = require('./services/url-shortener');

async function test() {
    try {
        console.log('🚀 URL 단축 서비스 테스트 시작...\n');

        // 하드코딩된 설정으로 테스트
        const shortener = await createShortener({
            baseUrl: 'https://discussion.keesdconsulting.uk',
            storage: {
                host: 'localhost',
                port: 5432,
                user: 'postgres',
                password: 'symphony99!',  // 하드코딩
                database: 'vibedb'
            },
            codeGenerator: {
                length: 6,
                charset: 'safe',
                strategy: 'random'
            },
            enableQR: true,
            enableAnalytics: true
        });

        console.log('✅ 초기화 완료!\n');

        // URL 단축 테스트
        console.log('📝 URL 단축 테스트...');
        const result = await shortener.shorten({
            url: 'https://example.com/very/long/url/path'
        });

        console.log('  ✅ 단축 완료!');
        console.log('  단축 코드:', result.shortCode);
        console.log('  단축 URL:', result.shortUrl);
        console.log('  원본 URL:', result.originalUrl);
        console.log('  QR 코드:', result.qrCode ? '생성됨 (길이: ' + result.qrCode.length + ')' : '없음');
        console.log('');

        // 통계 조회
        console.log('📊 통계 조회...');
        const stats = await shortener.getStats(result.shortCode);
        console.log('  클릭 수:', stats.clickCount);
        console.log('  생성 시간:', stats.createdAt);
        console.log('');

        // 전체 통계
        console.log('🌐 전체 통계...');
        const overallStats = await shortener.getOverallStats();
        console.log('  총 URL 수:', overallStats.totalUrls);
        console.log('  총 클릭 수:', overallStats.totalClicks);
        console.log('');

        console.log('🎉 모든 테스트 통과!');

        // 정리
        await shortener.storage.disconnect();

    } catch (error) {
        console.error('❌ 오류:', error.message);
        console.error(error.stack);
    }
}

test();
