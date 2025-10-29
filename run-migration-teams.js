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
        console.log('🔄 팀명 컬럼 마이그레이션 실행 중...\n');

        const migrationPath = path.join(__dirname, 'migrations', '003_add_team_names.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        await pool.query(sql);

        console.log('✅ 팀명 컬럼 추가 완료!');
    } catch (error) {
        console.error('❌ 마이그레이션 오류:', error);
    } finally {
        await pool.end();
    }
}

runMigration();
