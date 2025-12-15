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
        // JSONB 컬럼에 문자열 저장 (Supabase가 자동으로 JSONB로 변환)
        const { error } = await db
            .from('settings' as any)
            .upsert({ key: 'mining_mode', value: mode } as any);

        if (error) {
            console.error('[setMiningMode] DB Error:', error);
            throw error;
        }
        
        console.log('[setMiningMode] Successfully set mode to:', mode);
        return { success: true };
    } catch (e: any) {
        console.error('[setMiningMode] Error:', e);
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

        if (error) {
            console.error('[getMiningMode] DB Error:', error);
            throw error;
        }

        // JSONB 값 처리: Supabase가 자동으로 파싱하지만, 문자열로 저장된 경우도 처리
        let mode: 'NORMAL' | 'TURBO' = 'TURBO';
        
        if (data) {
            const rawValue = (data as any)?.value;
            
            // JSONB가 이미 파싱된 경우 (문자열)
            if (typeof rawValue === 'string') {
                // 따옴표 제거 (JSON 문자열인 경우: "TURBO" -> TURBO)
                mode = rawValue.replace(/^"|"$/g, '').toUpperCase() as 'NORMAL' | 'TURBO';
            } else {
                // 이미 객체로 파싱된 경우
                mode = String(rawValue).toUpperCase() as 'NORMAL' | 'TURBO';
            }
            
            // 유효성 검사
            if (mode !== 'NORMAL' && mode !== 'TURBO') {
                console.warn('[getMiningMode] Invalid mode value:', mode, 'defaulting to TURBO');
                mode = 'TURBO';
            }
        }

        console.log('[getMiningMode] Retrieved mode:', mode, 'from DB:', data);
        return { success: true, mode };
    } catch (e: any) {
        console.error('[getMiningMode] Error:', e);
        return { success: false, mode: 'TURBO' as const, error: e.message };
    }
}