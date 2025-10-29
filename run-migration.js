/**
 * 데이터베이스 마이그레이션 실행 스크립트
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'symphony99!',
    database: process.env.DB_NAME || 'postgres'
});

async function runMigration() {
    try {
        console.log('🚀 Starting database migration...\n');

        // 마이그레이션 파일 읽기
        const migrationPath = path.join(__dirname, 'migrations', '001_add_realtime_tables.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Migration file loaded:', migrationPath);
        console.log('📊 Database:', process.env.DB_NAME || 'vibedb');
        console.log('');

        // SQL 실행
        await pool.query(sql);

        console.log('✅ Migration completed successfully!\n');
        console.log('Created tables:');
        console.log('  - messages (채팅 메시지)');
        console.log('  - participants (참여자)');
        console.log('  - analysis_results (AI 분석 결과)');
        console.log('  - ai_questions (AI 생성 질문)');
        console.log('');
        console.log('Updated tables:');
        console.log('  - discussions (새 컬럼 추가)');
        console.log('');
        console.log('Created views:');
        console.log('  - discussion_stats (통계 뷰)');
        console.log('');
        console.log('Created functions & triggers:');
        console.log('  - update_discussion_counts()');
        console.log('  - mark_inactive_participants_offline()');
        console.log('');

        // 테이블 확인
        const tableCheck = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('messages', 'participants', 'analysis_results', 'ai_questions')
            ORDER BY table_name;
        `);

        console.log('✅ Verified tables:');
        tableCheck.rows.forEach(row => {
            console.log(`  ✓ ${row.table_name}`);
        });

        await pool.end();
        console.log('\n🎉 Migration process complete!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error.stack);
        await pool.end();
        process.exit(1);
    }
}

runMigration();
