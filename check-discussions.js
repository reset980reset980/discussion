const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'symphony99!',
    database: 'vibedb'
});

async function checkDiscussions() {
    try {
        const result = await pool.query('SELECT id, title, author FROM discussions ORDER BY id LIMIT 5');

        console.log('\n토론방 목록:');
        if (result.rows.length === 0) {
            console.log('토론방이 없습니다.');
        } else {
            result.rows.forEach(row => {
                console.log(`- ID: ${row.id}, 제목: ${row.title}, 작성자: ${row.author}`);
            });
        }

        await pool.end();
    } catch (error) {
        console.error('오류:', error.message);
        await pool.end();
        process.exit(1);
    }
}

checkDiscussions();
