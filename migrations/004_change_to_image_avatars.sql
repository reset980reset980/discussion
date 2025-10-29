-- 이모지를 이미지 URL로 변경

-- emoji_avatar를 avatar_image_url로 변경
ALTER TABLE participants RENAME COLUMN emoji_avatar TO avatar_image_url;
ALTER TABLE participants ALTER COLUMN avatar_image_url TYPE VARCHAR(255);

-- 아바타 배경색 컬럼 추가
ALTER TABLE participants ADD COLUMN IF NOT EXISTS avatar_color VARCHAR(20);

-- 기존 데이터 초기화 (이미지 URL과 배경색으로 업데이트 필요)
UPDATE participants SET avatar_image_url = 'https://cdn-icons-png.flaticon.com/512/742/742774.png' WHERE avatar_image_url IS NULL OR LENGTH(avatar_image_url) < 10;
UPDATE participants SET avatar_color = '#9333ea' WHERE avatar_color IS NULL;
