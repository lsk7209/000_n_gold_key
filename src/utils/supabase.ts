import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co').trim();
const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key').trim();

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('⚠️ Warning: Missing Supabase environment variables. Using placeholder values for build.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Singleton 패턴으로 DB 연결 최적화
let serviceClient: ReturnType<typeof createClient> | null = null;

export const getServiceSupabase = () => {
    // 이미 생성된 클라이언트가 있으면 재사용
    if (serviceClient) return serviceClient;

    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

    // 새 클라이언트 생성 및 캐싱
    serviceClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    return serviceClient;
};
