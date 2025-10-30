const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'vibedb',
    user: 'postgres',
    password: 'symphony99!'
});

async function checkAvatars() {
    try {
        console.log('🔍 토론방 9번 참여자 아바타 정보 확인...\n');

        const result = await pool.query(`
            SELECT
                id,
                user_name,
                user_role,
                avatar_image_url,
                avatar_color,
                is_online,
                created_at
            FROM participants
            WHERE discussion_id = 9
            ORDER BY created_at DESC
        `);

        console.log(`📊 총 ${result.length}명의 참여자:\n`);

        result.forEach((p, index) => {
            console.log(`${index + 1}. ${p.user_name} [${p.user_role}]`);
            console.log(`   아바타 이미지: ${p.avatar_image_url}`);
            console.log(`   배경 색상: ${p.avatar_color}`);
            console.log(`   온라인: ${p.is_online ? '✅' : '❌'}`);
            console.log(`   입장 시간: ${p.created_at}`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ 오류:', error.message);
    } finally {
        await pool.end();
    }
}

checkAvatars();
