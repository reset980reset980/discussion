const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'vibedb',
    user: 'postgres',
    password: 'symphony99!'
});

async function runMigration() {
    try {
        console.log('🔄 이모지 아바타 마이그레이션 실행 중...\n');

        const migrationPath = path.join(__dirname, 'migrations', '002_add_emoji_avatar.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        await pool.query(sql);

        console.log('✅ 이모지 아바타 컬럼 추가 완료!');
    } catch (error) {
        console.error('❌ 마이그레이션 오류:', error);
    } finally {
        await pool.end();
    }
}

runMigration();
