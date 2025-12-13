'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    LayoutDashboard,
    RefreshCw,
    Crown,
    Target,
    BookOpen,
    ArrowRight
} from 'lucide-react';

// Fetcher
const fetchTopKeywords = async (sort: string, limit: number = 4) => {
    const res = await fetch(`/api/keywords?cursor=0&limit=${limit}&sort=${sort}`);
    if (!res.ok) throw new Error('Failed to fetch');
    const json = await res.json();
    return json.data || [];
};

// Sub-component for Keyword Card
function KeywordCard({ item }: { item: any }) {
    return (
        <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-100 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
            {/* Badge */}
            <div className="absolute top-0 right-0 p-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold 
                    ${item.tier?.includes('1') || item.tier === 'PLATINUM' ? 'bg-cyan-100 text-cyan-700' :
                        item.tier?.includes('2') || item.tier === 'GOLD' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-emerald-50 text-emerald-700'}`}>
                    {item.tier || 'UNRANKED'}
                </span>
            </div>

            <h4 className="font-bold text-lg mb-1 truncate pr-16 text-zinc-900 dark:text-white" title={item.keyword}>
                {item.keyword}
            </h4>

            <div className="flex items-end gap-1 mb-4">
                <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {item.total_search_cnt.toLocaleString()}
                </span>
                <span className="text-xs text-zinc-500 mb-1.5">검색/월</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-lg">
                <div>
                    <div className="mb-1 text-zinc-400">문서수</div>
                    <div className="font-medium text-zinc-700 dark:text-zinc-300">
                        {item.total_doc_cnt?.toLocaleString() || '-'}
                    </div>
                </div>
                <div>
                    <div className="mb-1 text-zinc-400">황금비율</div>
                    <div className="font-bold text-emerald-600">
                        {item.golden_ratio?.toFixed(2)}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Insight Section Component
function InsightSection({ title, icon: Icon, sort, description, color }: any) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['keywords', 'insight', sort],
        queryFn: () => fetchTopKeywords(sort, 4),
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    if (isLoading) return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <div key={i} className="animate-pulse h-40 bg-zinc-100 dark:bg-zinc-800 rounded-xl"></div>)}</div>;
    if (error) return <div className="text-red-500 text-sm">로드 실패</div>;
    if (!data || data.length === 0) return null;

    return (
        <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded-lg bg-${color}-100 dark:bg-${color}-900/20 text-${color}-600`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
                    <p className="text-xs text-zinc-500">{description}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {data.map((item: any) => (
                    <KeywordCard key={item.id} item={item} />
                ))}
            </div>
        </section>
    );
}

export default function InsightPage() {
    const queryClient = useQueryClient();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await queryClient.invalidateQueries({ queryKey: ['keywords', 'insight'] });
        setTimeout(() => setIsRefreshing(false), 1000);
    };

    return (
        <main className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 p-4 md:p-8 font-sans">
            <div className="max-w-7xl mx-auto space-y-10">

                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            <LayoutDashboard className="w-8 h-8 text-indigo-600" />
                            인사이트 발견
                        </h1>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-2 max-w-2xl">
                            수집된 빅데이터 중에서 가장 가치 있는 키워드만 선별하여 보여드립니다.
                            <br className="hidden md:block" />
                            지금 바로 포스팅 주제를 선점하세요.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 text-sm font-medium transition-all ${isRefreshing ? 'opacity-70' : ''}`}
                        >
                            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            {isRefreshing ? '분석 중...' : '새로고침'}
                        </button>
                        <Link
                            href="/data"
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium transition-colors"
                        >
                            <ArrowRight className="w-4 h-4" />
                            전체 데이터 보기
                        </Link>
                    </div>
                </header>

                {/* 1. Golden Keywords (Tier 1) */}
                <InsightSection
                    title="👑 오늘의 황금 키워드"
                    description="경쟁은 거의 없고 검색량은 높은 '1등급' 키워드입니다."
                    icon={Crown}
                    sort="tier_desc" // 1등급 우선
                    color="yellow"
                />

                {/* 2. Niche Opportunities (Golden Ratio) */}
                <InsightSection
                    title="🎯 틈새 시장 (빈집)"
                    description="문서 수 대비 검색 효율이 가장 좋은 키워드입니다."
                    icon={Target}
                    sort="opp_desc"
                    color="emerald"
                />

                {/* 3. Blog Optimization */}
                <InsightSection
                    title="📝 블로그 블루오션"
                    description="블로그 발행량이 적어 상위 노출이 쉬운 키워드입니다."
                    icon={BookOpen}
                    sort="blog_asc"
                    color="blue"
                />

                {/* Footer Message */}
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-zinc-800 dark:to-zinc-900 rounded-2xl p-8 text-center space-y-4">
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white">더 많은 키워드가 필요하신가요?</h3>
                    <p className="text-zinc-600 dark:text-zinc-400">
                        데이터 메뉴에서 필터와 정렬을 사용하여 나만의 키워드를 찾아보세요.
                    </p>
                    <Link
                        href="/data"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 rounded-lg font-bold hover:shadow-lg transition-all"
                    >
                        데이터베이스 바로가기
                    </Link>
                </div>

            </div>
        </main>
    );
}
