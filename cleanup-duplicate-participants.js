/**
 * 중복 참여자 정리 스크립트
 * 같은 토론방의 같은 이름을 가진 중복 참여자 중 가장 최신 것만 남기고 삭제
 */

const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'vibedb',
    user: 'postgres',
    password: 'symphony99!'
});

async function cleanupDuplicateParticipants() {
    try {
        console.log('🔍 중복 참여자 확인 중...');

        // 중복 참여자 확인
        const duplicates = await pool.query(`
            SELECT discussion_id, user_name, COUNT(*) as count
            FROM participants
            GROUP BY discussion_id, user_name
            HAVING COUNT(*) > 1
        `);

        if (duplicates.rows.length === 0) {
            console.log('✅ 중복 참여자가 없습니다.');
            return;
        }

        console.log(`⚠️  ${duplicates.rows.length}개의 중복 참여자 발견`);
        duplicates.rows.forEach(row => {
            console.log(`   - 토론방 ${row.discussion_id}, 사용자 "${row.user_name}": ${row.count}개`);
        });

        // 각 중복 그룹에서 가장 최신 것(id가 가장 큰 것)만 남기고 삭제
        console.log('\n🧹 중복 참여자 삭제 중...');

        const deleteResult = await pool.query(`
            DELETE FROM participants
            WHERE id NOT IN (
                SELECT MAX(id)
                FROM participants
                GROUP BY discussion_id, user_name
            )
        `);

        console.log(`✅ ${deleteResult.rowCount}개의 중복 참여자를 삭제했습니다.`);

        // 최종 상태 확인
        const final = await pool.query(`
            SELECT discussion_id, user_name, user_role, is_online
            FROM participants
            ORDER BY discussion_id, user_name
        `);

        console.log(`\n📊 현재 참여자 목록 (총 ${final.rows.length}명):`);
        final.rows.forEach(row => {
            console.log(`   - 토론방 ${row.discussion_id}: ${row.user_name} (${row.user_role}) - ${row.is_online ? '온라인' : '오프라인'}`);
        });

    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await pool.end();
    }
}

cleanupDuplicateParticipants();
