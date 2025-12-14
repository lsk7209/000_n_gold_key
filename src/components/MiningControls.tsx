
'use client';

import { useState, useRef, useEffect } from 'react';
import { triggerMining } from '@/app/actions';
import { Play, FastForward, Square, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function MiningControls() {
    const [isTurbo, setIsTurbo] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [stats, setStats] = useState<{
        runs: number;
        success: number;
        failed: number;
        lastResult: any;
    }>({ runs: 0, success: 0, failed: 0, lastResult: null });

    // 로그 상태
    const [logs, setLogs] = useState<string[]>([]);
    const abortControllerRef = useRef<boolean>(false);

    const addLog = (msg: string) => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
    };

    const runBatch = async () => {
        try {
            const start = performance.now();
            addLog(isTurbo ? '🚀 터보 배치 시작...' : '▶ 일반 배치 시작...');

            const result = await triggerMining();
            const duration = ((performance.now() - start) / 1000).toFixed(1);

            if (result.success) {
                setStats(prev => ({
                    ...prev,
                    runs: prev.runs + 1,
                    success: prev.success + 1,
                    lastResult: result
                }));
                // 요약 로그 생성
                const expandInfo = result.expand ? `확장 ${result.expand.totalSaved}개` : '확장 없음';
                const fillInfo = result.fillDocs ? `갱신 ${result.fillDocs.processed}개` : '갱신 없음';
                addLog(`✅ 완료 (${duration}s): ${expandInfo}, ${fillInfo}`);
            } else {
                setStats(prev => ({ ...prev, runs: prev.runs + 1, failed: prev.failed + 1 }));
                addLog(`❌ 실패 (${duration}s): ${result.error}`);
            }
        } catch (e: any) {
            setStats(prev => ({ ...prev, runs: prev.runs + 1, failed: prev.failed + 1 }));
            addLog(`❌ 시스템 오류: ${e.message}`);
        }
    };

    // 터보 모드 루프
    const startTurboLoop = async () => {
        setIsRunning(true);
        setIsTurbo(true);
        abortControllerRef.current = false;

        addLog('🔥 터보 모드 가동! (중지 버튼을 누를 때까지 계속 실행됩니다)');

        let round = 1;
        while (!abortControllerRef.current) {
            addLog(`🔄 터보 라운드 #${round} 진행 중...`);
            await runBatch();

            if (abortControllerRef.current) break;

            // 쿨다운 (API 보호) - 터보 모드여도 2초는 쉬어줌
            addLog('⏳ 쿨다운 (2초)...');
            await new Promise(r => setTimeout(r, 2000));
            round++;
        }

        setIsRunning(false);
        setIsTurbo(false);
        addLog('🛑 터보 모드 중지됨.');
    };

    const handleNormalClick = async () => {
        if (isRunning) return;
        setIsRunning(true);
        setIsTurbo(false);
        await runBatch();
        setIsRunning(false);
    };

    const handleTurboClick = () => {
        if (isRunning && isTurbo) {
            // Stop
            abortControllerRef.current = true;
            addLog('🛑 중지 요청 중... 현재 작업이 끝나면 멈춥니다.');
        } else {
            // Start
            startTurboLoop();
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2 h-8 bg-blue-600 rounded-full inline-block"></span>
                    수집 제어 패널
                </h2>
                <div className="flex gap-2">
                    <div className="px-3 py-1 bg-slate-100 rounded text-xs text-slate-500 font-mono">
                        Runs: {stats.runs} | Success: {stats.success}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 일반 수집 버튼 */}
                <button
                    onClick={handleNormalClick}
                    disabled={isRunning}
                    className={`flex items-center justify-center gap-3 p-4 rounded-xl border transition-all
                        ${isRunning
                            ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-white border-slate-200 hover:border-blue-500 hover:text-blue-600 hover:shadow-md text-slate-700'
                        }`}
                >
                    <Play size={24} className={isRunning && !isTurbo ? "animate-pulse" : ""} />
                    <div className="text-left">
                        <div className="font-bold">일반 수집 (1회)</div>
                        <div className="text-xs opacity-70">안정적인 단일 배치 실행</div>
                    </div>
                </button>

                {/* 터보 수집 버튼 */}
                <button
                    onClick={handleTurboClick}
                    disabled={isRunning && !isTurbo}
                    className={`flex items-center justify-center gap-3 p-4 rounded-xl border transition-all text-white
                        ${isTurbo
                            ? 'bg-red-600 border-red-700 hover:bg-red-700 shadow-inner'
                            : 'bg-gradient-to-br from-indigo-500 to-purple-600 border-transparent hover:shadow-lg hover:from-indigo-600 hover:to-purple-700'
                        } ${isRunning && !isTurbo ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {isTurbo ? (
                        <>
                            <Square size={24} className="fill-current" />
                            <div className="text-left">
                                <div className="font-bold">터보 중지</div>
                                <div className="text-xs opacity-90">현재 루프 종료 후 멈춤</div>
                            </div>
                        </>
                    ) : (
                        <>
                            <FastForward size={24} />
                            <div className="text-left">
                                <div className="font-bold">터보 모드 (무한)</div>
                                <div className="text-xs opacity-90">월초 몰아서 수집 (Loop)</div>
                            </div>
                        </>
                    )}
                </button>
            </div>

            {/* 로그 창 */}
            <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs md:text-sm text-slate-300 h-48 overflow-y-auto space-y-1 shadow-inner">
                {logs.length === 0 && (
                    <div className="h-full flex items-center justify-center text-slate-600 italic">
                        대기 중... 버튼을 눌러 수집을 시작하세요.
                    </div>
                )}
                {logs.map((log, i) => (
                    <div key={i} className="border-b border-white/5 last:border-0 pb-1 last:pb-0 break-all leading-relaxed">
                        {log}
                    </div>
                ))}
            </div>

            <div className="text-xs text-slate-400 text-center">
                * 터보 모드는 브라우저 탭이 열려있는 동안에만 작동합니다.
            </div>
        </div>
    );
}
