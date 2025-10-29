-- 토론방 테이블에 팀명 컬럼 추가

ALTER TABLE discussions ADD COLUMN IF NOT EXISTS team1_name VARCHAR(50);
ALTER TABLE discussions ADD COLUMN IF NOT EXISTS team2_name VARCHAR(50);

-- 기본 팀명 설정 (팀전 모드인 경우)
UPDATE discussions SET team1_name = '찬성' WHERE team1_name IS NULL AND type = '팀전';
UPDATE discussions SET team2_name = '반대' WHERE team2_name IS NULL AND type = '팀전';
