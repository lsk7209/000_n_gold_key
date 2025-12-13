-- Enable pgcrypto for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE keywords (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword text UNIQUE NOT NULL, 
  
  -- 검색량
  total_search_cnt int4 DEFAULT 0,
  pc_search_cnt int4 DEFAULT 0,
  mo_search_cnt int4 DEFAULT 0,
  
  -- 클릭수
  click_cnt int4 DEFAULT 0,
  pc_click_cnt int4 DEFAULT 0,
  mo_click_cnt int4 DEFAULT 0,
  
  -- CTR (클릭률) - 새로 추가!
  total_ctr numeric DEFAULT 0,  -- 전체 평균 CTR
  pc_ctr numeric DEFAULT 0,     -- PC CTR
  mo_ctr numeric DEFAULT 0,     -- 모바일 CTR
  
  -- 경쟁도
  comp_idx text,
  pl_avg_depth int4 DEFAULT 0,
  
  -- 입찰가 (향후 추가 가능)
  avg_bid_price int4 DEFAULT 0,
  
  -- 문서 수 (Naver Search API)
  total_doc_cnt int4, -- NULL implies uncollected
  blog_doc_cnt int4 DEFAULT 0,
  cafe_doc_cnt int4 DEFAULT 0,
  web_doc_cnt int4 DEFAULT 0,
  news_doc_cnt int4 DEFAULT 0,
  
  -- 분석 결과
  tier text DEFAULT 'UNRANKED',
  golden_ratio numeric DEFAULT 0,
  
  -- 시스템
  is_expanded boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_keywords_tier_ratio ON keywords (tier, golden_ratio DESC);
CREATE INDEX idx_search_desc ON keywords (total_search_cnt DESC);
CREATE INDEX idx_cafe_opp ON keywords (cafe_doc_cnt ASC, total_search_cnt DESC);
CREATE INDEX idx_blog_opp ON keywords (blog_doc_cnt ASC, total_search_cnt DESC);
CREATE INDEX idx_web_opp ON keywords (web_doc_cnt ASC, total_search_cnt DESC);
CREATE INDEX idx_updated_at ON keywords (updated_at ASC);
CREATE INDEX idx_ctr_desc ON keywords (total_ctr DESC);  -- CTR 정렬용
