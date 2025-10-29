-- 참여자 테이블에 이모지 아바타 컬럼 추가

ALTER TABLE participants ADD COLUMN IF NOT EXISTS emoji_avatar VARCHAR(10);

-- 기본 이모지 설정 (기존 데이터)
UPDATE participants SET emoji_avatar = '😊' WHERE emoji_avatar IS NULL;
