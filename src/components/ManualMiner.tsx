'use client';

import { useState } from 'react';
import { Loader2, Pickaxe, Search, CheckCircle2 } from 'lucide-react';
import { triggerMining } from '@/app/actions'; // Server Action

export default function ManualMiner() {
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [error, setError] = useState('');

    // System Trigger State
    const [sysLoading, setSysLoading] = useState(false);
    const [sysMsg, setSysMsg] = useState('');
    const [sysErrors, setSysErrors] = useState<string[]>([]);

    const handleBatchTrigger = async () => {
        setSysLoading(true);
        setSysMsg('');
        setSysErrors([]);
        try {
            const res: any = await triggerMining();
            if (res.success) {
                let msg = `✅ 봇 실행 완료: ${res.mode}`;
                if (res.mode === 'FILL_DOCS') {
                    msg += ` (성공: ${res.processed}, 실패: ${res.failed || 0})`;
                } else if (res.mode === 'EXPAND') {
                    msg += ` (Seed: ${res.seed}, 저장: ${res.saved})`;
                } else {
                    msg += ` (${res.message})`;
                }
                setSysMsg(msg);

                if (res.errors && res.errors.length > 0) {
                    setSysErrors(res.errors);
                }
            } else {
                setSysMsg(`❌ 실행 실패: ${res.error || '알 수 없는 오류'}`);
            }
        } catch (e) {
            setSysMsg('❌ 요청 실패');
        } finally {
            setSysLoading(false);
        }
    };

    const handleMining = async () => {
        if (!input.trim()) return;

        setLoading(true);
        setError('');
        setResults([]);

        try {
            const keywords = input.split(',').map(s => s.trim()).filter(Boolean);
            if (keywords.length === 0) return;

            const res = await fetch('/api/miner/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keywords })
            });

            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.error || 'Request failed');
            }

            // Flatten results
            const allItems = json.results
                .filter((r: any) => r.success)
                .flatMap((r: any) => r.data || []);

            setResults(allItems);

            if (allItems.length === 0) {
                setError('결과가 없습니다.');
            }

        } catch (err: any) {
            setError(err.message || '수집 중 오류 발생');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="키워드 입력 (콤마로 구분, 예: 홍대맛집, 강남카페)"
                    className="flex-1 px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleMining()}
                />
                <button
                    onClick={handleMining}
                    disabled={loading || !input.trim()}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg disabled:opacity-50 flex items-center gap-2 whitespace-nowrap transition-colors"
                >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Pickaxe className="w-5 h-5" />}
                    수집 시작
                </button>
            </div>

            {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-md text-sm text-left">
                    {error}
                </div>
            )}

            {results.length > 0 && (
                <div className="mt-8 space-y-4 text-left">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <Search className="w-5 h-5 text-emerald-600" />
                            수집된 연관 키워드 ({results.length}개)
                        </h3>
                        <span className="text-sm text-zinc-500 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            DB 저장 완료 (상세 분석 대기중)
                            <button
                                onClick={handleBatchTrigger}
                                disabled={sysLoading}
                                className="ml-2 px-2 py-1 text-xs bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded text-zinc-600 transition-colors disabled:opacity-50"
                            >
                                {sysLoading ? '실행중...' : '⚡ 봇 즉시 실행'}
                            </button>
                        </span>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                        {sysMsg && (
                            <div className={`text-sm font-medium px-1 ${sysMsg.startsWith('❌') ? 'text-red-600' : 'text-blue-600'}`}>
                                {sysMsg}
                            </div>
                        )}
                        {sysErrors.length > 0 && (
                            <div className="text-xs text-red-500 bg-red-50 p-2 rounded max-w-md text-right">
                                <div className="font-bold mb-1">다음 에러로 일부 실패:</div>
                                {sysErrors.map((e, i) => <div key={i}>• {e}</div>)}
                                <div className="mt-1 text-zinc-400">Vercel 환경변수(API키)를 확인해주세요.</div>
                            </div>
                        )}
                    </div>

                    <div className="max-h-96 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 border-b border-zinc-200 dark:border-zinc-700 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 font-medium">연관 키워드</th>
                                    <th className="px-4 py-3 font-medium text-right">PC 검색량</th>
                                    <th className="px-4 py-3 font-medium text-right">Mobile 검색량</th>
                                    <th className="px-4 py-3 font-medium text-right">총 검색량</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                {results.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                                        <td className="px-4 py-2 font-medium">{item.keyword}</td>
                                        <td className="px-4 py-2 text-right text-zinc-500">{item.pc_search_cnt.toLocaleString()}</td>
                                        <td className="px-4 py-2 text-right text-zinc-500">{item.mo_search_cnt.toLocaleString()}</td>
                                        <td className="px-4 py-2 text-right font-bold text-zinc-900 dark:text-zinc-100">{item.total_search_cnt.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
