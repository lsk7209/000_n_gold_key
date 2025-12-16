
import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/utils/supabase';
import { keyManager } from '@/utils/key-manager';

export const dynamic = 'force-dynamic';

export async function GET() {
    const db = getServiceSupabase();

    try {
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // 1. Total Keywords
        const { count: total, error: e1 } = await db.from('keywords').select('*', { count: 'exact', head: true });
        if (e1) throw e1;

        // 2. Pending Doc Count (Queue)
        const { count: qDoc, error: e2 } = await db.from('keywords').select('*', { count: 'exact', head: true }).is('total_doc_cnt', null);
        if (e2) throw e2;

        // 3. Pending Expansion (Seeds) - High Volume Only
        const { count: qSeed, error: e3 } = await db.from('keywords').select('*', { count: 'exact', head: true })
            .eq('is_expanded', false)
            .gte('total_search_cnt', 1000);
        if (e3) throw e3;

        // 3b. Last 24h throughput (approximate but reliable for current pipeline):
        // - new_keywords_24h: created rows in last 24h
        // - docs_filled_24h: rows updated by fill_docs (batch-runner sets updated_at when filling docs)
        const [
            { count: newKeywords24h, error: e4 },
            { count: docsFilled24h, error: e5 }
        ] = await Promise.all([
            db.from('keywords').select('*', { count: 'exact', head: true }).gte('created_at', since24h),
            db.from('keywords').select('*', { count: 'exact', head: true }).not('total_doc_cnt', 'is', null).gte('updated_at', since24h),
        ]);
        if (e4) throw e4;
        if (e5) throw e5;

        // 4. Last Active (Latest updated_at)
        const { data: lastActive } = await db
            .from('keywords')
            .select('updated_at')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        // 5. API Keys Status (based on in-memory cooldown tracking)
        const adStatus = keyManager.getStatusSummary('AD');
        const searchStatus = keyManager.getStatusSummary('SEARCH');
        const systemHealthy = adStatus.available > 0 && searchStatus.available > 0;

        return NextResponse.json({
            total_keywords: total || 0,
            pending_docs: qDoc || 0,
            pending_seeds: qSeed || 0,
            throughput_24h: {
                since: since24h,
                new_keywords: newKeywords24h || 0,
                docs_filled: docsFilled24h || 0,
                // helpful derived rates
                new_keywords_per_hour: Math.round(((newKeywords24h || 0) / 24) * 10) / 10,
                docs_filled_per_hour: Math.round(((docsFilled24h || 0) / 24) * 10) / 10,
            },
            last_activity: (lastActive as any)?.updated_at || null,
            api_keys: {
                ad: adStatus,
                search: searchStatus
            },
            status: systemHealthy ? 'HEALTHY' : 'DEGRADED'
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message, status: 'ERROR' }, { status: 500 });
    }
}
