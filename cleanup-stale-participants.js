/**
 * 오래된 온라인 참여자 정리 스크립트
 * 실제로 연결이 끊어졌지만 is_online이 true로 남아있는 참여자들을 정리
 */

const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'vibedb',
    user: 'postgres',
    password: 'symphony99!'
});

async function cleanupStaleParticipants() {
    try {
        console.log('🔍 오래된 온라인 참여자 확인 중...\n');

        // 현재 온라인인 참여자 조회
        const onlineParticipants = await pool.query(`
            SELECT id, discussion_id, user_name, socket_id, last_seen
            FROM participants
            WHERE is_online = true
        `);

        console.log(`온라인 상태인 참여자: ${onlineParticipants.rows.length}명\n`);

        if (onlineParticipants.rows.length === 0) {
            console.log('✅ 정리할 참여자가 없습니다.');
            return;
        }

        onlineParticipants.rows.forEach(row => {
            console.log(`  - ${row.user_name} (토론방 ${row.discussion_id})`);
            console.log(`    Socket ID: ${row.socket_id}`);
            console.log(`    마지막 활동: ${row.last_seen}`);
        });

        console.log('\n⚠️  위 참여자들을 모두 오프라인으로 변경합니다.\n');

        // 모든 온라인 참여자를 오프라인으로 변경
        const result = await pool.query(`
            UPDATE participants
            SET is_online = false
            WHERE is_online = true
        `);

        console.log(`✅ ${result.rowCount}명의 참여자를 오프라인으로 변경했습니다.\n`);

        // 최종 상태 확인
        const finalCheck = await pool.query(`
            SELECT COUNT(*) as online_count
            FROM participants
            WHERE is_online = true
        `);

        console.log(`📊 현재 온라인 참여자: ${finalCheck.rows[0].online_count}명`);

    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await pool.end();
    }
}

cleanupStaleParticipants();
