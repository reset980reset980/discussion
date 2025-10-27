const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL 연결 설정
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'vibe',
    password: process.env.DB_PASSWORD || 'vibe123',
    database: process.env.DB_NAME || 'vibedb',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

// 연결 풀 생성
const pool = new Pool(dbConfig);

// 데이터베이스 테이블 초기화
async function initializeDatabase() {
    try {
        // 토론방 테이블 생성
        await pool.query(`
            CREATE TABLE IF NOT EXISTS discussions (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                type VARCHAR(20) CHECK (type IN ('팀전', '자유', '역할극')) DEFAULT '자유',
                author VARCHAR(100) NOT NULL,
                participants INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
                description TEXT,
                is_active BOOLEAN DEFAULT true,
                is_private BOOLEAN DEFAULT false,
                entry_code VARCHAR(20)
            )
        `);

        // 비밀글 관련 컬럼 추가 (기존 테이블에)
        await pool.query(`
            ALTER TABLE discussions
            ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS entry_code VARCHAR(20)
        `);

        // 인덱스 생성
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_discussions_created_at ON discussions (created_at)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_discussions_expires_at ON discussions (expires_at)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_discussions_type ON discussions (type)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_discussions_is_active ON discussions (is_active)`);

        // 의견 테이블 생성
        await pool.query(`
            CREATE TABLE IF NOT EXISTS opinions (
                id SERIAL PRIMARY KEY,
                discussion_id INTEGER NOT NULL,
                author VARCHAR(100) NOT NULL,
                content TEXT NOT NULL,
                opinion_type VARCHAR(10) CHECK (opinion_type IN ('pros', 'cons')) NOT NULL,
                likes_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (discussion_id) REFERENCES discussions(id) ON DELETE CASCADE
            )
        `);

        // 인덱스 생성
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_opinions_discussion_id ON opinions (discussion_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_opinions_type ON opinions (opinion_type)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_opinions_created_at ON opinions (created_at)`);

        // 좋아요 테이블 생성 (중복 방지용)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS opinion_likes (
                id SERIAL PRIMARY KEY,
                opinion_id INTEGER NOT NULL,
                user_identifier VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (opinion_id) REFERENCES opinions(id) ON DELETE CASCADE,
                UNIQUE (opinion_id, user_identifier)
            )
        `);

        // 인덱스 생성
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_opinion_likes_opinion_id ON opinion_likes (opinion_id)`);

        // 참여자 추적 테이블 생성
        await pool.query(`
            CREATE TABLE IF NOT EXISTS discussion_participants (
                id SERIAL PRIMARY KEY,
                discussion_id INTEGER NOT NULL,
                user_identifier VARCHAR(255) NOT NULL,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (discussion_id) REFERENCES discussions(id) ON DELETE CASCADE,
                UNIQUE (discussion_id, user_identifier)
            )
        `);

        // 인덱스 생성
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_participants_discussion_id ON discussion_participants (discussion_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_participants_last_activity ON discussion_participants (last_activity)`);

        // 샘플 데이터 삽입 비활성화 (사용자 요청)
        // const result = await pool.query('SELECT COUNT(*) as count FROM discussions');
        // if (parseInt(result.rows[0].count) === 0) {
        //     await insertSampleData();
        // }

        console.log('PostgreSQL 데이터베이스 초기화 완료');

    } catch (error) {
        console.error('데이터베이스 초기화 오류:', error);
        // SQLite로 폴백
        return initializeSQLite();
    }
}

// SQLite 폴백 (MySQL 연결 실패 시)
async function initializeSQLite() {
    console.log('MySQL 연결 실패. SQLite로 폴백합니다.');

    // 간단한 메모리 기반 저장소 사용 - 빈 배열로 시작
    global.discussionsStore = [];
    global.opinionsStore = [];

    console.log('SQLite 메모리 저장소 초기화 완료');
}

// 샘플 데이터 삽입
async function insertSampleData() {
    const sampleDiscussions = [
        {
            title: "인공지능이 인간의 일자리를 완전히 대체할 것인가?",
            type: "자유",
            author: "김테크",
            description: "AI 기술의 급속한 발전으로 인한 노동시장의 변화에 대해 토론해봅시다."
        },
        {
            title: "기본소득제 도입, 찬성 vs 반대",
            type: "팀전",
            author: "이경제",
            description: "모든 국민에게 조건 없이 지급하는 기본소득제의 필요성을 팀전으로 토론합니다."
        },
        {
            title: "환경보호 vs 경제성장, 어떤 것이 우선인가?",
            type: "자유",
            author: "박환경",
            description: "지속가능한 발전을 위한 환경보호와 경제성장의 균형점을 찾아봅시다."
        }
    ];

    for (const discussion of sampleDiscussions) {
        await pool.query(
            'INSERT INTO discussions (title, type, author, description) VALUES ($1, $2, $3, $4)',
            [discussion.title, discussion.type, discussion.author, discussion.description]
        );
    }
}

// 데이터베이스 쿼리 실행 함수
async function query(sql, params = []) {
    try {
        if (global.discussionsStore) {
            // SQLite 폴백 모드
            return handleSQLiteQuery(sql, params);
        }

        const result = await pool.query(sql, params);
        return result.rows;
    } catch (error) {
        console.error('쿼리 실행 오류:', error);
        throw error;
    }
}

// SQLite 폴백 쿼리 처리
function handleSQLiteQuery(sql, params) {
    const lowerSql = sql.toLowerCase().trim();

    if (lowerSql.includes('select') && lowerSql.includes('discussions')) {
        // 특정 ID로 조회하는 경우
        if (lowerSql.includes('where id =') && params.length > 0) {
            const discussion = global.discussionsStore.find(d => d.id == params[0] && d.is_active);
            return discussion ? [discussion] : [];
        }
        // 전체 조회
        return global.discussionsStore.filter(d => d.is_active);
    }

    if (lowerSql.includes('select') && lowerSql.includes('opinions')) {
        return global.opinionsStore;
    }

    if (lowerSql.includes('insert') && lowerSql.includes('discussions')) {
        const newId = Math.max(...global.discussionsStore.map(d => d.id), 0) + 1;
        const newDiscussion = {
            id: newId,
            title: params[0],
            type: params[1],
            author: params[2],
            description: params[3],
            participants: 0,
            created_at: new Date(),
            expires_at: params[4] || new Date(Date.now() + 24 * 60 * 60 * 1000),
            is_active: true,
            is_private: params[5] || false,
            entry_code: params[6] || null,
            password: params[7] || null  // 비밀번호 추가
        };
        global.discussionsStore.push(newDiscussion);
        return [{ id: newId }]; // PostgreSQL 형식에 맞춤
    }

    if (lowerSql.includes('insert') && lowerSql.includes('opinions')) {
        const newId = Math.max(...global.opinionsStore.map(o => o.id), 0) + 1;
        const newOpinion = {
            id: newId,
            discussion_id: params[0],
            author: params[1],
            content: params[2],
            opinion_type: params[3],
            likes_count: 0,
            created_at: new Date()
        };
        global.opinionsStore.push(newOpinion);
        return { insertId: newId };
    }

    if (lowerSql.includes('delete') && lowerSql.includes('discussions')) {
        const id = params[0];
        const initialLength = global.discussionsStore.length;
        global.discussionsStore = global.discussionsStore.filter(d => d.id != id);
        const affectedRows = initialLength - global.discussionsStore.length;
        return { affectedRows: affectedRows };
    }

    if (lowerSql.includes('update') && lowerSql.includes('discussions') && lowerSql.includes('is_active')) {
        const id = params[1]; // UPDATE discussions SET is_active = $1 WHERE id = $2
        const isActive = params[0];
        const discussion = global.discussionsStore.find(d => d.id == id);
        if (discussion) {
            discussion.is_active = isActive;
            return { affectedRows: 1 };
        }
        return { affectedRows: 0 };
    }

    return [];
}

// 연결 종료
async function closeConnection() {
    if (pool) {
        await pool.end();
    }
}

module.exports = {
    initializeDatabase,
    query,
    closeConnection
};