-- =============================================================================
-- Supabase 성능 최적화 인덱스
-- =============================================================================
-- 실행 방법:
-- 1. Supabase Dashboard → SQL Editor로 이동
-- 2. 이 SQL 전체를 복사하여 붙여넣기
-- 3. "Run" 버튼 클릭
-- 4. 성공 메시지 확인
--
-- CONCURRENTLY 옵션: 서비스 중단 없이 백그라운드에서 인덱스 생성
-- =============================================================================

-- 1. EXPAND 쿼리 최적화 (최우선)
-- batch-runner.ts의 EXPAND 모드에서 사용
-- 예상 효과: 쿼리 속도 70% 향상
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expand_candidates 
ON keywords (is_expanded, total_search_cnt DESC) 
WHERE is_expanded = false AND total_search_cnt >= 1000;

-- 2. FILL_DOCS 쿼리 최적화 (최우선)
-- batch-runner.ts의 FILL_DOCS 모드에서 사용
-- 예상 효과: 쿼리 속도 60% 향상
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fill_docs_queue 
ON keywords (total_doc_cnt, total_search_cnt DESC) 
WHERE total_doc_cnt IS NULL;

-- 3. Tier 기반 정렬 최적화
-- /api/keywords의 tier 필터링 및 정렬에 사용
-- 예상 효과: 쿼리 속도 50% 향상
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tier_search 
ON keywords (tier, total_search_cnt DESC);

-- 4. 시간 기반 쿼리 최적화
-- 최근 업데이트된 키워드 조회에 사용
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_updated_at_desc 
ON keywords (updated_at DESC);

-- 5. 생성 시간 기반 쿼리 최적화
-- 최근 생성된 키워드 조회에 사용
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_created_at_desc 
ON keywords (created_at DESC);

-- =============================================================================
-- 인덱스 생성 확인
-- =============================================================================
-- 아래 쿼리를 실행하여 인덱스가 정상적으로 생성되었는지 확인
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'keywords' 
AND schemaname = 'public'
ORDER BY indexname;

-- =============================================================================
-- 인덱스 사용 통계 확인 (일주일 후 실행)
-- =============================================================================
-- 일주일 후 아래 쿼리를 실행하여 인덱스가 실제로 사용되는지 확인
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'keywords'
ORDER BY idx_scan DESC;
