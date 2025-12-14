
import { NextRequest, NextResponse } from 'next/server';
import { runMiningBatch } from '@/utils/batch-runner';
import { getServiceSupabase } from '@/utils/supabase';

// Set Vercel Function config
export const maxDuration = 60; // 60 seconds strict
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    // 1. Auth Check
    const authHeader = req.headers.get('Authorization'); // Support Bearer
    const cronHeader = req.headers.get('CRON_SECRET');
    const queryKey = req.nextUrl.searchParams.get('key');
    const secret = process.env.CRON_SECRET || 'manual-override-key';

    // Flexible Auth: Cron Header, Query Param, or Bearer Token (if we add it later)
    const isAuthorized = (cronHeader === secret) || (queryKey === secret) || (authHeader === `Bearer ${secret}`);

    if (!isAuthorized) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 2. Execute Batch
        const result = await runMiningBatch();

        // 3. Check for Turbo Mode (Background Recursion)
        const db = getServiceSupabase();
        const { data: setting } = await db
            .from('settings')
            .select('value')
            .eq('key', 'mining_mode')
            .single();

        const mode = (setting as any)?.value; // "TURBO" or "NORMAL" (JSONB string usually includes quotes if not parsed, Supabase returns parsed JSON for JSONB?)
        // Supabase JS library parses JSONB automatically. So "TURBO" string.

        if (mode === 'TURBO') {
            // Check for Stop Conditions (Quota Exhaustion or System Failure)
            const fillErrors = result.fillDocs?.errors || [];
            const expandErrors = result.expand?.details?.filter((d: string) => d.includes('rejected') || d.includes('error')) || [];
            const allErrors = [...fillErrors, ...expandErrors];
            
            // 검색 API 키 소진 체크
            const isSearchKeyExhausted = allErrors.some((e: string) => 
                e.includes('No SEARCH keys') || 
                e.includes('All SEARCH keys are rate limited')
            );
            
            // 검색광고 API 키 소진 체크
            const isAdKeyExhausted = allErrors.some((e: string) => 
                e.includes('No AD keys') || 
                e.includes('All AD keys are rate limited') ||
                e.includes('Failed to fetch related keywords')
            );

            const totalTried = (result.fillDocs?.processed || 0) + (result.fillDocs?.failed || 0);
            const isTotalFailure = totalTried > 0 && (result.fillDocs?.processed || 0) === 0;

            // API 키 모두 소진 또는 연속 실패 시 자동 중지
            if (isSearchKeyExhausted || isAdKeyExhausted || (isTotalFailure && allErrors.length > 5)) {
                const reason = isSearchKeyExhausted ? 'Search API Keys Exhausted' 
                    : isAdKeyExhausted ? 'Ad API Keys Exhausted'
                    : 'High Failure Rate';
                
                console.warn(`[Miner] TURBO STOP: ${reason}. Auto-switching to NORMAL mode.`);

                // Disable Turbo Mode in DB (자동으로 일반 모드로 변경)
                await db.from('settings' as any).upsert({ key: 'mining_mode', value: 'NORMAL' } as any);

                return NextResponse.json({
                    ...result,
                    info: `Turbo Mode Automatically Stopped (${reason}). Switched to NORMAL mode.`
                });
            }

            const selfUrl = `${req.nextUrl.origin}/api/miner/execute?key=${secret}`;
            console.log(`[Miner] Turbo Mode Active. Spawning next batch: ${selfUrl}`);

            // Spawn next run asynchronously
            try {
                await fetch(selfUrl, {
                    method: 'GET',
                    headers: { 'CRON_SECRET': secret }
                });
            } catch (err) {
                console.error('[Miner] Failed to spawn next recursion:', err);
            }
        }

        return NextResponse.json(result);
    } catch (e: any) {
        console.error('[Miner] Execution Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
