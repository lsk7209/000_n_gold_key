-- =============================================================================
-- Supabase 스키마 마이그레이션: CTR 필드 추가
-- =============================================================================
-- 실행 방법:
-- 1. Supabase Dashboard → SQL Editor로 이동
-- 2. 이 SQL 전체를 복사하여 붙여넣기
-- 3. "Run" 버튼 클릭
-- =============================================================================

-- CTR 필드 추가
ALTER TABLE keywords ADD COLUMN IF NOT EXISTS pc_click_cnt int4 DEFAULT 0;
ALTER TABLE keywords ADD COLUMN IF NOT EXISTS mo_click_cnt int4 DEFAULT 0;
ALTER TABLE keywords ADD COLUMN IF NOT EXISTS total_ctr numeric DEFAULT 0;
ALTER TABLE keywords ADD COLUMN IF NOT EXISTS pc_ctr numeric DEFAULT 0;
ALTER TABLE keywords ADD COLUMN IF NOT EXISTS mo_ctr numeric DEFAULT 0;

-- 기존 ctr 컬럼을 total_ctr로 용도 변경 (옵션)
-- ALTER TABLE keywords RENAME COLUMN ctr TO total_ctr;

-- CTR 인덱스 추가 (정렬 최적화)
CREATE INDEX IF NOT EXISTS idx_ctr_desc ON keywords (total_ctr DESC);
CREATE INDEX IF NOT EXISTS idx_pc_ctr_desc ON keywords (pc_ctr DESC);
CREATE INDEX IF NOT EXISTS idx_mo_ctr_desc ON keywords (mo_ctr DESC);

-- 마이그레이션 확인
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'keywords' 
AND column_name IN ('pc_click_cnt', 'mo_click_cnt', 'total_ctr', 'pc_ctr', 'mo_ctr')
ORDER BY column_name;
