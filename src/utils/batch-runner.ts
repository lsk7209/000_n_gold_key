
import { getServiceSupabase } from '@/utils/supabase';
import { processSeedKeyword } from '@/utils/mining-engine';
import { fetchDocumentCount } from '@/utils/naver-api';

export async function runMiningBatch() {
    const adminDb = getServiceSupabase();

    // 타임스탬프 로깅
    const start = Date.now();
    console.log('[Batch] Starting Parallel Mining Batch...');

    // === Task 1: EXPAND (Keywords Expansion) ===
    const taskExpand = async () => {
        const { data: seedsData, error: seedError } = await adminDb
            .from('keywords')
            .select('id, keyword, total_search_cnt')
            .eq('is_expanded', false)
            .gte('total_search_cnt', 100)
            .order('total_search_cnt', { ascending: false })
            .limit(50) as { data: any[] | null, error: any };

        if (seedError || !seedsData || seedsData.length === 0) return null;

        // Shuffle and pick 5 keys
        const shuffled = seedsData.sort(() => 0.5 - Math.random());
        const seeds = shuffled.slice(0, 5);

        console.log(`[Batch] EXPAND: Processing ${seeds.length} seeds (from top ${seedsData.length})`);

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
                    const res = await processSeedKeyword(seed.keyword, 0, true, 100);
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
        const BATCH_SIZE = 100;
        const { data: docsToFill, error: docsError } = await adminDb
            .from('keywords')
            .select('id, keyword, total_search_cnt')
            .is('total_doc_cnt', null)
            .order('total_search_cnt', { ascending: false })
            .limit(BATCH_SIZE) as { data: any[] | null, error: any };

        if (docsError || !docsToFill || docsToFill.length === 0) return null;

        console.log(`[Batch] FILL_DOCS: Processing ${docsToFill.length} items (Chunks of 25)`);

        const CHUNK_SIZE = 25;
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
