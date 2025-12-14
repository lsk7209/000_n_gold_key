'use server';

import { runMiningBatch } from '@/utils/batch-runner';
import { getServiceSupabase } from '@/utils/supabase';

export async function triggerMining() {
    try {
        console.log('[Args] Triggering mining batch manually...');
        const result = await runMiningBatch();
        return result;
    } catch (e: any) {
        console.error('Manual Trigger Error:', e);
        return { success: false, error: e.message };
    }
}

export async function setMiningMode(mode: 'NORMAL' | 'TURBO') {
    try {
        const db = getServiceSupabase();
        const { error } = await db
            .from('settings' as any)
            .upsert({ key: 'mining_mode', value: mode } as any);

        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        console.error('Mode Update Error:', e);
        return { success: false, error: e.message };
    }
}

export async function getMiningMode() {
    try {
        const db = getServiceSupabase();
        const { data, error } = await db
            .from('settings')
            .select('value')
            .eq('key', 'mining_mode')
            .maybeSingle();

        if (error) throw error;
        const mode = (data as any)?.value || 'NORMAL';
        return { success: true, mode: mode as 'NORMAL' | 'TURBO' };
    } catch (e: any) {
        console.error('Mode Get Error:', e);
        return { success: false, mode: 'NORMAL' as const, error: e.message };
    }
}