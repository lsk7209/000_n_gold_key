
import { getServiceSupabase } from '@/utils/supabase';
import { processSeedKeyword } from '@/utils/mining-engine';
import { fetchDocumentCount } from '@/utils/naver-api';

export async function runMiningBatch() {
    const adminDb = getServiceSupabase();

    // 타임스탬프 로깅
    const start = Date.now();
    console.log('[Batch] Starting Parallel Mining Batch...');

    // 터보모드 확인 (API 키 최대 활용을 위한 배치 크기 조정)
    const { data: setting } = await adminDb
        .from('settings')
        .select('value')
        .eq('key', 'mining_mode')
        .maybeSingle();
    
    const isTurboMode = (setting as any)?.value === 'TURBO';
    
    // 터보모드: API 키 최대 활용 (검색광고 API 4개=10000호출, 문서수 API 9개)
    // 일반 모드: 안정적인 수집 (5분마다 GitHub Actions)
    const SEED_COUNT = isTurboMode ? 4 : 2; // 터보: 4개 시드, 일반: 2개 시드
    const FILL_DOCS_BATCH = isTurboMode ? 50 : 30; // 터보: 50개, 일반: 30개
    const MIN_SEARCH_VOLUME = isTurboMode ? 300 : 500; // 터보: 더 낮은 기준으로 더 많이 수집

    console.log(`[Batch] Mode: ${isTurboMode ? 'TURBO (Max API Usage)' : 'NORMAL'}, Seeds: ${SEED_COUNT}, FillDocs: ${FILL_DOCS_BATCH}`);

    // === Task 1: EXPAND (Keywords Expansion) ===
    const taskExpand = async () => {
        
        const { data: seedsData, error: seedError } = await adminDb
            .from('keywords')
            .select('id, keyword, total_search_cnt')
            .eq('is_expanded', false)
            .gte('total_search_cnt', MIN_SEARCH_VOLUME)
            .order('total_search_cnt', { ascending: false })
            .limit(isTurboMode ? 100 : 50) as { data: any[] | null, error: any }; // 터보: 더 많은 후보

        if (seedError || !seedsData || seedsData.length === 0) return null;

        // 검색량 상위 우선 선택 (랜덤 대신)
        const seeds = seedsData.slice(0, SEED_COUNT);

        console.log(`[Batch] EXPAND: Processing ${seeds.length} seeds (from top ${seedsData.length}, min: ${MIN_SEARCH_VOLUME})`);

        const expandResults = await Promise.all(
            seeds.map(async (seed) => {
                // Optimistic lock
                const { error: lockError } = await (adminDb as any)
                    .from('keywords')
                    .update({ is_expanded: true })
                    .eq('id', seed.id)
                    .eq('is_expanded', false);

                if (lockError) return { status: 'skipped', seed: seed.keyword };

                try {
                    const res = await processSeedKeyword(seed.keyword, 0, true, MIN_SEARCH_VOLUME);
                    // Mark confirmed
                    await (adminDb as any).from('keywords').update({ is_expanded: true }).eq('id', seed.id);
                    return { status: 'fulfilled', seed: seed.keyword, saved: res.saved };
                } catch (e: any) {
                    console.error(`[Batch] Seed Failed: ${seed.keyword} - ${e.message}`);
                    await (adminDb as any).from('keywords').update({ is_expanded: true }).eq('id', seed.id);
                    return { status: 'rejected', seed: seed.keyword, error: e.message };
                }
            })
        );

        const succeeded = expandResults.filter(r => r.status === 'fulfilled');
        return {
            processedSeeds: seeds.length,
            totalSaved: succeeded.reduce((sum, r: any) => (sum + (r.saved || 0)), 0),
            details: expandResults.map((r: any) =>
                r.status === 'fulfilled' ? `${r.seed} (+${r.saved})` : `${r.seed} (${r.status})`
            )
        };
    };

    // === Task 2: FILL_DOCS (Document Counts) ===
    const taskFillDocs = async () => {
        // 터보모드: API 키 최대 활용을 위해 배치 크기 증가
        const BATCH_SIZE = FILL_DOCS_BATCH;
        const CHUNK_SIZE = isTurboMode ? 30 : 25; // 터보: 더 큰 청크로 병렬 처리
        
        const { data: docsToFill, error: docsError } = await adminDb
            .from('keywords')
            .select('id, keyword, total_search_cnt')
            .is('total_doc_cnt', null)
            .order('total_search_cnt', { ascending: false })
            .limit(BATCH_SIZE) as { data: any[] | null, error: any };

        if (docsError || !docsToFill || docsToFill.length === 0) return null;

        console.log(`[Batch] FILL_DOCS: Processing ${docsToFill.length} items (Chunks of ${CHUNK_SIZE})`);
        let processedResults: any[] = [];

        for (let i = 0; i < docsToFill.length; i += CHUNK_SIZE) {
            const chunk = docsToFill.slice(i, i + CHUNK_SIZE);
            const chunkResults = await Promise.all(
                chunk.map(async (item) => {
                    try {
                        const counts = await fetchDocumentCount(item.keyword);
                        return { status: 'fulfilled', item, counts };
                    } catch (e: any) {
                        console.error(`[Batch] Error filling ${item.keyword}: ${e.message}`);
                        return { status: 'rejected', keyword: item.keyword, error: e.message };
                    }
                })
            );
            processedResults = [...processedResults, ...chunkResults];
        }

        const succeeded = processedResults.filter(r => r.status === 'fulfilled');
        const failed = processedResults.filter(r => r.status === 'rejected');

        // Bulk Upsert
        const updates = succeeded.map((res: any) => {
            const { item, counts } = res;
            const viewDocCnt = (counts.blog || 0) + (counts.cafe || 0) + (counts.web || 0);
            let ratio = 0;
            let tier = 'UNRANKED';

            if (viewDocCnt > 0) {
                ratio = item.total_search_cnt / viewDocCnt;
                if (viewDocCnt <= 100 && ratio > 5) tier = '1등급';
                else if (ratio > 10) tier = '2등급';
                else if (ratio > 5) tier = '3등급';
                else if (ratio > 1) tier = '4등급';
                else tier = '5등급';
            } else if (item.total_search_cnt > 0) {
                tier = '1등급';
                ratio = 99.99;
            }

            return {
                id: item.id,
                keyword: item.keyword,
                total_search_cnt: item.total_search_cnt,
                total_doc_cnt: counts.total,
                blog_doc_cnt: counts.blog,
                cafe_doc_cnt: counts.cafe,
                web_doc_cnt: counts.web,
                news_doc_cnt: counts.news,
                golden_ratio: ratio,
                tier: tier,
                updated_at: new Date().toISOString()
            };
        });

        if (updates.length > 0) {
            const { error: upsertError } = await (adminDb as any)
                .from('keywords')
                .upsert(updates, { onConflict: 'id' });

            if (upsertError) {
                console.error('[Batch] Bulk Upsert Error:', upsertError);
                return {
                    processed: 0,
                    failed: docsToFill.length,
                    errors: [`Bulk Save Failed: ${upsertError.message}`]
                };
            }
        }

        return {
            processed: updates.length,
            failed: failed.length,
            errors: failed.slice(0, 3).map((f: any) => `${f.keyword}: ${f.error}`)
        };
    };

    try {
        // Execute Both Tasks in Parallel
        const [expandResult, fillDocsResult] = await Promise.all([
            taskExpand(),
            taskFillDocs()
        ]);

        const duration = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`[Batch] Completed in ${duration}s`);

        return {
            success: true,
            expand: expandResult,
            fillDocs: fillDocsResult
        };

    } catch (e: any) {
        console.error('Batch Error:', e);
        return { success: false, error: e.message };
    }
}
