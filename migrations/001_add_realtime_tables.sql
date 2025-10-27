-- ==========================================
-- Migration: Real-time Chat System Tables
-- Created: 2025-10-27
-- Description: Add tables for real-time messaging, participants, and AI analysis
-- ==========================================

-- 1. 참여자 테이블 (먼저 생성)
CREATE TABLE IF NOT EXISTS participants (
    id SERIAL PRIMARY KEY,
    discussion_id INTEGER NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    user_id VARCHAR(255),
    user_name VARCHAR(100) NOT NULL,
    user_role VARCHAR(50),  -- '찬성', '반대', '중재자', 역할극 이름 등
    socket_id VARCHAR(100),
    is_online BOOLEAN DEFAULT true,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_participants_discussion_id ON participants(discussion_id);
CREATE INDEX IF NOT EXISTS idx_participants_socket_id ON participants(socket_id);
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON participants(user_id);

-- 2. 메시지 테이블 (채팅 내역)
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    discussion_id INTEGER NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    participant_id INTEGER REFERENCES participants(id),
    user_name VARCHAR(100) NOT NULL,
    user_role VARCHAR(50),
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'chat',  -- 'chat', 'ai_question', 'system', 'ai_response'
    is_ai BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_discussion_id ON messages(discussion_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_participant_id ON messages(participant_id);

-- 3. 단축 URL 테이블 (이미 별도 모듈로 구현됨, 여기서는 참조용)
-- short_urls 테이블은 services/url-shortener 모듈에서 관리

-- 4. AI 분석 결과 테이블
CREATE TABLE IF NOT EXISTS analysis_results (
    id SERIAL PRIMARY KEY,
    discussion_id INTEGER NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    analysis_type VARCHAR(50) NOT NULL,  -- 'summary', 'participation', 'timeline', 'keywords', 'quality'
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_analysis_discussion_id ON analysis_results(discussion_id);
CREATE INDEX IF NOT EXISTS idx_analysis_type ON analysis_results(analysis_type);
CREATE INDEX IF NOT EXISTS idx_analysis_created_at ON analysis_results(created_at);

-- 5. AI 생성 질문 테이블
CREATE TABLE IF NOT EXISTS ai_questions (
    id SERIAL PRIMARY KEY,
    discussion_id INTEGER NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    questions JSONB NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    message_count INTEGER DEFAULT 0,  -- 생성 시점의 메시지 수
    is_sent BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_ai_questions_discussion_id ON ai_questions(discussion_id);
CREATE INDEX IF NOT EXISTS idx_ai_questions_generated_at ON ai_questions(generated_at);

-- 6. 기존 discussions 테이블에 컬럼 추가
ALTER TABLE discussions
ADD COLUMN IF NOT EXISTS roles JSONB,  -- AI가 생성한 역할 목록
ADD COLUMN IF NOT EXISTS chat_mode BOOLEAN DEFAULT true,  -- 채팅 모드 활성화 (기본값 true로 변경)
ADD COLUMN IF NOT EXISTS ai_questions_enabled BOOLEAN DEFAULT true,  -- AI 질문 기능
ADD COLUMN IF NOT EXISTS ai_analysis_enabled BOOLEAN DEFAULT true,  -- AI 분석 기능
ADD COLUMN IF NOT EXISTS ai_intervention_interval INTEGER DEFAULT 300,  -- AI 개입 간격 (초, 기본 5분)
ADD COLUMN IF NOT EXISTS participant_count INTEGER DEFAULT 0,  -- 현재 참여자 수
ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0,  -- 총 메시지 수
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,  -- 토론 시작 시간
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP;  -- 토론 종료 시간

-- 7. 기존 opinions 테이블의 데이터를 messages 테이블로 마이그레이션
-- (하위 호환성을 위해 opinions 테이블은 유지)
-- 필요시 아래 주석 해제:
-- INSERT INTO messages (discussion_id, user_name, user_role, message, message_type, created_at)
-- SELECT discussion_id, '익명', opinion_type, content, 'chat', created_at
-- FROM opinions
-- WHERE NOT EXISTS (
--     SELECT 1 FROM messages WHERE discussion_id = opinions.discussion_id
-- );

-- 8. 통계 뷰 생성 (성능 최적화)
-- Note: 'mode' 컬럼 충돌 문제로 인해 뷰를 코드 레벨에서 구현
-- CREATE OR REPLACE VIEW discussion_stats AS
-- SELECT
--     d.id AS discussion_id,
--     d.title,
--     d.author,
--     d."mode",
--     COUNT(DISTINCT p.id) AS total_participants,
--     COUNT(DISTINCT CASE WHEN p.is_online THEN p.id END) AS online_participants,
--     COUNT(m.id) AS total_messages,
--     MAX(m.created_at) AS last_message_at,
--     d.created_at,
--     d.started_at,
--     d.ended_at
-- FROM discussions d
-- LEFT JOIN participants p ON d.id = p.discussion_id
-- LEFT JOIN messages m ON d.id = m.discussion_id
-- GROUP BY d.id, d.title, d.author, d."mode", d.created_at, d.started_at, d.ended_at;

-- 9. 자동 업데이트 트리거 (participant_count, message_count)
CREATE OR REPLACE FUNCTION update_discussion_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- 메시지 수 업데이트
    IF TG_TABLE_NAME = 'messages' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE discussions
            SET message_count = message_count + 1
            WHERE id = NEW.discussion_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE discussions
            SET message_count = message_count - 1
            WHERE id = OLD.discussion_id;
        END IF;
    END IF;

    -- 참여자 수 업데이트 (온라인 참여자만)
    IF TG_TABLE_NAME = 'participants' THEN
        UPDATE discussions
        SET participant_count = (
            SELECT COUNT(*) FROM participants
            WHERE discussion_id = NEW.discussion_id AND is_online = true
        )
        WHERE id = NEW.discussion_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 메시지 트리거
DROP TRIGGER IF EXISTS trigger_update_message_count ON messages;
CREATE TRIGGER trigger_update_message_count
AFTER INSERT OR DELETE ON messages
FOR EACH ROW
EXECUTE FUNCTION update_discussion_counts();

-- 참여자 트리거
DROP TRIGGER IF EXISTS trigger_update_participant_count ON participants;
CREATE TRIGGER trigger_update_participant_count
AFTER INSERT OR UPDATE ON participants
FOR EACH ROW
EXECUTE FUNCTION update_discussion_counts();

-- 10. 참여자 자동 오프라인 처리 함수 (5분 이상 활동 없으면)
CREATE OR REPLACE FUNCTION mark_inactive_participants_offline()
RETURNS void AS $$
BEGIN
    UPDATE participants
    SET is_online = false
    WHERE is_online = true
    AND last_seen < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- Migration Complete
-- ==========================================
-- 다음 단계:
-- 1. Socket.io 서버 구축
-- 2. 실시간 채팅 API 구현
-- 3. 참여자 관리 시스템 구현
-- 4. AI 질문/분석 시스템 구현
-- ==========================================
