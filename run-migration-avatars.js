const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'symphony99!'
});

async function runMigration() {
    try {
        console.log('🔄 아바타 이미지 마이그레이션 실행 중...\n');

        const migrationPath = path.join(__dirname, 'migrations', '004_change_to_image_avatars.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        await pool.query(sql);

        console.log('✅ 아바타 이미지 컬럼 변경 완료!');
    } catch (error) {
        console.error('❌ 마이그레이션 오류:', error);
    } finally {
        await pool.end();
    }
}

runMigration();
