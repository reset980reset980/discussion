const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'vibedb'
});

async function deleteSampleData() {
    try {
        console.log('샘플 데이터 삭제 중...');

        // 샘플 토론방 작성자 목록
        const sampleAuthors = ['김테크', '이경제', '박환경'];

        // 삭제할 토론방 확인
        const checkResult = await pool.query(
            'SELECT id, title, author FROM discussions WHERE author = ANY($1)',
            [sampleAuthors]
        );

        if (checkResult.rows.length === 0) {
            console.log('삭제할 샘플 데이터가 없습니다.');
        } else {
            console.log(`\n발견된 샘플 토론방 (${checkResult.rows.length}개):`);
            checkResult.rows.forEach(row => {
                console.log(`  - [ID: ${row.id}] ${row.title} (작성자: ${row.author})`);
            });

            // 샘플 데이터 삭제
            const deleteResult = await pool.query(
                'DELETE FROM discussions WHERE author = ANY($1)',
                [sampleAuthors]
            );

            console.log(`\n✅ ${deleteResult.rowCount}개의 샘플 토론방이 삭제되었습니다.`);
        }

    } catch (error) {
        console.error('❌ 샘플 데이터 삭제 중 오류:', error.message);
    } finally {
        await pool.end();
        console.log('\n작업 완료');
    }
}

deleteSampleData();
