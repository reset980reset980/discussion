/**
 * 참여자 목록 확인 스크립트
 */

const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'vibedb',
    user: 'postgres',
    password: 'symphony99!'
});

async function checkParticipants() {
    try {
        console.log('📊 현재 participants 테이블 상태:\n');

        // 모든 참여자 조회
        const allParticipants = await pool.query(`
            SELECT id, discussion_id, user_name, user_role, socket_id, is_online, joined_at, last_seen
            FROM participants
            ORDER BY discussion_id, joined_at DESC
        `);

        console.log(`총 ${allParticipants.rows.length}개의 참여자 레코드:\n`);

        allParticipants.rows.forEach(row => {
            console.log(`ID: ${row.id}`);
            console.log(`  토론방: ${row.discussion_id}`);
            console.log(`  이름: ${row.user_name}`);
            console.log(`  역할: ${row.user_role}`);
            console.log(`  Socket ID: ${row.socket_id}`);
            console.log(`  온라인: ${row.is_online ? '✅ 온라인' : '❌ 오프라인'}`);
            console.log(`  입장: ${row.joined_at}`);
            console.log(`  마지막 활동: ${row.last_seen}`);
            console.log('---');
        });

        // 온라인 참여자만
        console.log('\n\n🟢 온라인 참여자만:\n');
        const onlineParticipants = await pool.query(`
            SELECT id, discussion_id, user_name, user_role, is_online
            FROM participants
            WHERE is_online = true
            ORDER BY discussion_id
        `);

        if (onlineParticipants.rows.length === 0) {
            console.log('  현재 온라인 참여자가 없습니다.');
        } else {
            onlineParticipants.rows.forEach(row => {
                console.log(`  토론방 ${row.discussion_id}: ${row.user_name} (${row.user_role})`);
            });
        }

    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await pool.end();
    }
}

checkParticipants();
