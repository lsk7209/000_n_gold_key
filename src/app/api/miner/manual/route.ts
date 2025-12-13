
import { NextRequest, NextResponse } from 'next/server';
import { processSeedKeyword } from '@/utils/mining-engine';

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('CRON_SECRET');
        const queryKey = req.nextUrl.searchParams.get('key');
        const secret = process.env.CRON_SECRET;

        if (!secret || (authHeader !== secret && queryKey !== secret)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { keywords } = await req.json();

        if (!keywords || !Array.isArray(keywords)) {
            return NextResponse.json({ error: 'Keywords must be an array' }, { status: 400 });
        }

        const seeds = keywords
            .map(k => k.trim())
            .filter(Boolean)
            .slice(0, 5); // Limit 5

        if (seeds.length === 0) {
            return NextResponse.json({ error: 'No valid keywords provided' }, { status: 400 });
        }

        const results = [];

        for (const seed of seeds) {
            try {
                // For manual collection, we want to fetch document counts as well.
                // keepvolume filter at 1000+
                // Increased limit to 100 for better coverage (was 50)
                const result = await processSeedKeyword(seed, 100, false);
                results.push({
                    seed,
                    success: true,
                    data: result.items,
                    stats: { processed: result.processed, saved: result.saved }
                });
            } catch (e: any) {
                results.push({
                    seed,
                    success: false,
                    error: e.message
                });
            }
        }

        return NextResponse.json({ results });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
