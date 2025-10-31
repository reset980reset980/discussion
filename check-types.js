const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: 'symphony99!',
    port: 5432,
});

async function checkTypes() {
    try {
        const result = await pool.query(`
            SELECT id, title, description,
                   LENGTH(description) as desc_length
            FROM discussions
            WHERE type = '역할극'
            ORDER BY created_at DESC
            LIMIT 1
        `);

        console.log('=== 역할극 토론방 Description 확인 ===\n');
        result.rows.forEach(row => {
            console.log(`ID: ${row.id}`);
            console.log(`제목: ${row.title}`);
            console.log(`Description 길이: ${row.desc_length}`);
            console.log(`\nDescription 내용:\n${row.description}`);
            console.log(`\n=== 줄바꿈 문자 분석 ===`);
            console.log(`\\n 개수: ${(row.description.match(/\n/g) || []).length}`);
            console.log(`연속 \\n\\n 개수: ${(row.description.match(/\n\n/g) || []).length}`);
            console.log(`연속 \\n\\n\\n 개수: ${(row.description.match(/\n\n\n/g) || []).length}`);
            console.log(`연속 \\n\\n\\n\\n 개수: ${(row.description.match(/\n\n\n\n/g) || []).length}`);
        });

        await pool.end();
    } catch (err) {
        console.error('오류:', err);
        process.exit(1);
    }
}

checkTypes();
