import React, { useState, useEffect, useMemo } from 'react';

const BASKET_BADGE = {
    OFFENSIVE: { label: 'OFFENSIVE GROWTH/CYCLICAL', bg: 'rgba(56, 189, 248, 0.14)', border: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' },
    DEFENSIVE: { label: 'DEFENSIVE SAFE HAVEN', bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.4)', color: '#34d399' },
    REAL_ASSETS: { label: 'LATE-CYCLE REAL ASSETS', bg: 'rgba(249, 115, 22, 0.14)', border: 'rgba(249, 115, 22, 0.4)', color: '#fb923c' },
    SMALL_CAP: { label: 'HIGH-BETA SMALL CAP', bg: 'rgba(251, 191, 36, 0.14)', border: 'rgba(251, 191, 36, 0.4)', color: '#fbbf24' },
};

export default function SectorFlowTopBottomPredictor({ onTickerClick }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeView, setActiveView] = useState('checklist'); // 'checklist' | 'sectors' | 'chart' | 'history'
    const [hoverIdx, setHoverIdx] = useState(null);
    const [basketFilter, setBasketFilter] = useState('ALL');

    const loadPredictorData = async (force = false) => {
        setLoading(true);
        setError(null);
        const q = force ? '?force=true' : '';
        const urls = [
            `/api/sector_flow_predictor${q}`,
            `http://127.0.0.1:5000/api/sector_flow_predictor${q}`,
            `/sector_flow_predictor.json?t=${Date.now()}`,
        ];
        for (const url of urls) {
            try {
                const res = await fetch(url);
                if (!res.ok) continue;
                const json = await res.json();
                if (json && json.current_snapshot) {
                    setData(json);
                    setLoading(false);
                    return;
                }
            } catch (e) {
                // try next fallback
            }
        }
        setError('Unable to load 10-Year Sector Flow Predictor data.');
        setLoading(false);
    };

    useEffect(() => {
        loadPredictorData(false);
    }, []);

    const filteredSectors = useMemo(() => {
        if (!data?.sector_rankings) return [];
        if (basketFilter === 'ALL') return data.sector_rankings;
        return data.sector_rankings.filter((s) => s.basket === basketFilter);
    }, [data, basketFilter]);

    if (loading && !data) {
        return (
            <div style={{
                background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(9, 14, 28, 0.98))',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '14px',
                padding: '20px',
                marginBottom: '20px',
                color: '#94a3b8',
                fontSize: '0.9rem'
            }}>
                ⏳ Loading 10-Year Institutional Sector Flow Top/Bottom Predictor (2016–2026)...
            </div>
        );
    }

    if (error && !data) {
        return (
            <div style={{
                background: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(244, 63, 94, 0.35)',
                borderRadius: '14px',
                padding: '16px 20px',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#fda4af'
            }}>
                <span>⚠️ {error}</span>
                <button
                    onClick={() => loadPredictorData(true)}
                    style={{
                        background: 'rgba(244, 63, 94, 0.2)',
                        border: '1px solid rgba(244, 63, 94, 0.5)',
                        color: '#fecdd3',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontWeight: 700
                    }}
                >
                    Retry
                </button>
            </div>
        );
    }

    const snap = data.current_snapshot || {};
    const checklist = data.signal_checklist || [];
    const traj = data.trajectory_60d || [];
    const history = data.historical_turning_points || [];
    const roadmap = data.roadmap || {};
    const btBase = data.baseline_backtest || {};

    const fmtCmf = (v) => (v === null || v === undefined ? '—' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(3)}`);

    return (
        <div style={{
            background: 'linear-gradient(160deg, rgba(13, 20, 38, 0.97) 0%, rgba(8, 13, 26, 0.99) 100%)',
            border: `1px solid ${snap.phase_color || '#f59e0b'}44`,
            borderRadius: '16px',
            padding: '20px 22px',
            marginBottom: '22px',
            boxShadow: '0 14px 36px rgba(0, 0, 0, 0.45)'
        }}>
            {/* Top Header Row */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '14px',
                borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
                paddingBottom: '14px',
                marginBottom: '16px'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '0.3px' }}>
                            🧭 10-YEAR SECTOR FLOW MARKET TOP / BOTTOM PREDICTOR
                        </span>
                        <span style={{
                            background: `${snap.phase_color || '#f59e0b'}22`,
                            border: `1px solid ${snap.phase_color || '#f59e0b'}77`,
                            color: snap.phase_color || '#f59e0b',
                            padding: '3px 10px',
                            borderRadius: '999px',
                            fontSize: '0.73rem',
                            fontWeight: 800,
                            letterSpacing: '0.5px'
                        }}>
                            {snap.phase_badge || 'ROTATION ACTIVE'}
                        </span>
                        <span style={{
                            background: 'rgba(148, 163, 184, 0.12)',
                            border: '1px solid rgba(148, 163, 184, 0.25)',
                            color: '#94a3b8',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.7rem',
                            fontFamily: 'monospace'
                        }}>
                            Study: {data.study_span}
                        </span>
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '5px', lineHeight: 1.45 }}>
                        Quantifies institutional 5D/20D/60D Chaikin Money Flow (<code style={{ color: '#e2e8f0' }}>CMF</code>) across Offensive (<code style={{ color: '#38bdf8' }}>XLK, SMH, XLY, XLC, XLI, XLF</code>), Defensive (<code style={{ color: '#34d399' }}>XLP, XLU, XLV, XLRE</code>), and Real Asset (<code style={{ color: '#fb923c' }}>XLB, XLE</code>) baskets to detect distribution tops and washout bottoms.
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {[
                        { id: 'checklist', label: '🎯 Top/Bottom Signals & Forecast' },
                        { id: 'sectors', label: '📊 13-Sector Flow Matrix' },
                        { id: 'chart', label: '📈 60D Flow Trajectory' },
                        { id: 'history', label: '🏛️ 10Y Tops & Bottoms Proof' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveView(tab.id)}
                            style={{
                                background: activeView === tab.id ? 'rgba(56, 189, 248, 0.2)' : 'rgba(30, 41, 59, 0.65)',
                                border: activeView === tab.id ? '1px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.22)',
                                color: activeView === tab.id ? '#38bdf8' : '#cbd5e1',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                    <button
                        onClick={() => loadPredictorData(true)}
                        title="Refresh live sector flow calculations"
                        style={{
                            background: 'rgba(15, 23, 42, 0.8)',
                            border: '1px solid rgba(148, 163, 184, 0.3)',
                            color: '#94a3b8',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                        }}
                    >
                        ↻
                    </button>
                </div>
            </div>

            {/* 6 Live KPI Strip + Dual Risk Gauges */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
                gap: '10px',
                marginBottom: '16px'
            }}>
                {/* Gauge 1: Top Distribution Risk */}
                <div style={{
                    background: 'rgba(15, 23, 42, 0.78)',
                    border: `1px solid ${snap.top_risk_score >= 70 ? 'rgba(244, 63, 94, 0.45)' : 'rgba(148, 163, 184, 0.2)'}`,
                    borderRadius: '10px',
                    padding: '10px 12px'
                }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                        🚨 Market Top Distribution Risk
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '4px' }}>
                        <span style={{
                            fontSize: '1.35rem',
                            fontWeight: 900,
                            fontFamily: 'monospace',
                            color: snap.top_risk_score >= 70 ? '#f43f5e' : snap.top_risk_score >= 45 ? '#f59e0b' : '#10b981'
                        }}>
                            {snap.top_risk_score}/100
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#cbd5e1', fontWeight: 700 }}>
                            {snap.top_risk_score >= 70 ? 'HIGH TOP RISK' : snap.top_risk_score >= 45 ? 'ELEVATED' : 'LOW RISK'}
                        </span>
                    </div>
                    <div style={{ height: '5px', background: 'rgba(51, 65, 85, 0.7)', borderRadius: '999px', marginTop: '6px', overflow: 'hidden' }}>
                        <div style={{
                            width: `${Math.min(100, snap.top_risk_score || 0)}%`,
                            height: '100%',
                            background: snap.top_risk_score >= 70 ? '#f43f5e' : snap.top_risk_score >= 45 ? '#f59e0b' : '#10b981'
                        }} />
                    </div>
                </div>

                {/* Gauge 2: Capitulation Bottom Proximity */}
                <div style={{
                    background: 'rgba(15, 23, 42, 0.78)',
                    border: `1px solid ${snap.bottom_capitulation_score >= 75 ? 'rgba(16, 185, 129, 0.45)' : 'rgba(148, 163, 184, 0.2)'}`,
                    borderRadius: '10px',
                    padding: '10px 12px'
                }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                        ⚓ Washout Bottom Proximity
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '4px' }}>
                        <span style={{
                            fontSize: '1.35rem',
                            fontWeight: 900,
                            fontFamily: 'monospace',
                            color: snap.bottom_capitulation_score >= 75 ? '#10b981' : snap.bottom_capitulation_score >= 50 ? '#38bdf8' : '#94a3b8'
                        }}>
                            {snap.bottom_capitulation_score}/100
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#cbd5e1', fontWeight: 700 }}>
                            {snap.bottom_capitulation_score >= 75 ? 'WASHOUT ZONE' : 'NOT WASHED OUT'}
                        </span>
                    </div>
                    <div style={{ height: '5px', background: 'rgba(51, 65, 85, 0.7)', borderRadius: '999px', marginTop: '6px', overflow: 'hidden' }}>
                        <div style={{
                            width: `${Math.min(100, snap.bottom_capitulation_score || 0)}%`,
                            height: '100%',
                            background: snap.bottom_capitulation_score >= 75 ? '#10b981' : '#38bdf8'
                        }} />
                    </div>
                </div>

                {/* KPI 3: Offensive Basket CMF */}
                <div style={{ background: 'rgba(15, 23, 42, 0.78)', border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: '10px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>⚡ OFFENSIVE 20D CMF</div>
                    <div style={{
                        fontSize: '1.25rem',
                        fontWeight: 900,
                        fontFamily: 'monospace',
                        color: snap.off_cmf_20d >= 0 ? '#10b981' : '#f43f5e',
                        marginTop: '3px'
                    }}>
                        {fmtCmf(snap.off_cmf_20d)}
                    </div>
                    <div style={{ fontSize: '0.69rem', color: '#64748b', marginTop: '2px' }}>
                        5D: <span style={{ color: snap.off_cmf_5d >= 0 ? '#34d399' : '#fda4af', fontFamily: 'monospace' }}>{fmtCmf(snap.off_cmf_5d)}</span> | XLK: <span style={{ color: snap.xlk_cmf_20d >= 0 ? '#34d399' : '#fda4af', fontFamily: 'monospace' }}>{fmtCmf(snap.xlk_cmf_20d)}</span>
                    </div>
                </div>

                {/* KPI 4: Defensive Basket CMF */}
                <div style={{ background: 'rgba(15, 23, 42, 0.78)', border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: '10px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>🛡️ DEFENSIVE 20D CMF</div>
                    <div style={{
                        fontSize: '1.25rem',
                        fontWeight: 900,
                        fontFamily: 'monospace',
                        color: snap.def_cmf_20d >= 0 ? '#34d399' : '#f43f5e',
                        marginTop: '3px'
                    }}>
                        {fmtCmf(snap.def_cmf_20d)}
                    </div>
                    <div style={{ fontSize: '0.69rem', color: '#64748b', marginTop: '2px' }}>
                        5D: <span style={{ color: snap.def_cmf_5d >= 0 ? '#34d399' : '#fda4af', fontFamily: 'monospace' }}>{fmtCmf(snap.def_cmf_5d)}</span> | Real Assets: <span style={{ color: '#fb923c', fontFamily: 'monospace' }}>{fmtCmf(snap.em_cmf_20d)}</span>
                    </div>
                </div>

                {/* KPI 5: Def - Off Spread */}
                <div style={{
                    background: 'rgba(15, 23, 42, 0.78)',
                    border: `1px solid ${snap.def_minus_off_spread_20d >= 0.08 ? 'rgba(244, 63, 94, 0.45)' : 'rgba(148, 163, 184, 0.18)'}`,
                    borderRadius: '10px',
                    padding: '10px 12px'
                }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>🔄 DEF − OFF SPREAD (20D)</div>
                    <div style={{
                        fontSize: '1.25rem',
                        fontWeight: 900,
                        fontFamily: 'monospace',
                        color: snap.def_minus_off_spread_20d >= 0.08 ? '#f43f5e' : snap.def_minus_off_spread_20d >= 0.03 ? '#f59e0b' : '#10b981',
                        marginTop: '3px'
                    }}>
                        {fmtCmf(snap.def_minus_off_spread_20d)}
                    </div>
                    <div style={{ fontSize: '0.69rem', color: '#64748b', marginTop: '2px' }}>
                        Top Trigger Threshold: <span style={{ color: '#fda4af', fontFamily: 'monospace' }}>&gt;= +0.080</span>
                    </div>
                </div>

                {/* KPI 6: Sector Inflow / Panic Outflow Breadth */}
                <div style={{ background: 'rgba(15, 23, 42, 0.78)', border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: '10px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>📊 GICS INFLOW / PANIC BREADTH</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '3px' }}>
                        <span style={{ fontSize: '1.15rem', fontWeight: 900, fontFamily: 'monospace', color: '#38bdf8' }}>
                            {snap.pos_sec_pct}% Pos ({snap.pos_sec_count}/11)
                        </span>
                    </div>
                    <div style={{ fontSize: '0.69rem', color: '#64748b', marginTop: '2px' }}>
                        Panic Out (&lt;-0.08): <span style={{ color: snap.panic_out_pct >= 45 ? '#10b981' : '#f59e0b', fontFamily: 'monospace', fontWeight: 700 }}>{snap.panic_out_pct}% ({snap.panic_out_count}/11)</span>
                    </div>
                </div>
            </div>

            {/* VIEW 1: CHECKLIST & FORECAST ROADMAP */}
            {activeView === 'checklist' && (
                <div>
                    {/* Executive Diagnosis Callout */}
                    <div style={{
                        background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, rgba(15, 23, 42, 0.85) 100%)',
                        borderLeft: `4px solid ${snap.phase_color || '#f59e0b'}`,
                        borderRadius: '10px',
                        padding: '12px 16px',
                        marginBottom: '16px'
                    }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f8fafc', marginBottom: '4px' }}>
                            📌 LIVE REGIME DIAGNOSIS ({snap.date}): {snap.cycle_phase}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                            {roadmap.why_qqq_and_tech_weak_now}
                        </div>
                    </div>

                    {/* 4 Quantitative Signal Cards */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
                        gap: '12px',
                        marginBottom: '16px'
                    }}>
                        {checklist.map((sig) => {
                            const bt = sig.backtest || {};
                            const isTop = sig.type === 'TOP';
                            return (
                                <div
                                    key={sig.id}
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.82)',
                                        border: `1px solid ${sig.status_color || '#64748b'}55`,
                                        borderRadius: '12px',
                                        padding: '14px 16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                            <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#f8fafc' }}>
                                                {isTop ? '🔻' : '🟢'} {sig.title}
                                            </span>
                                            <span style={{
                                                background: `${sig.status_color || '#64748b'}22`,
                                                border: `1px solid ${sig.status_color || '#64748b'}88`,
                                                color: sig.status_color || '#94a3b8',
                                                fontSize: '0.67rem',
                                                fontWeight: 800,
                                                padding: '2px 8px',
                                                borderRadius: '999px',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {sig.status}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '10px', lineHeight: 1.4 }}>
                                            {sig.subtitle}
                                        </div>

                                        {/* Sub-conditions table */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                                            {(sig.conditions || []).map((c, idx) => (
                                                <div
                                                    key={idx}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        background: c.met ? 'rgba(16, 185, 129, 0.08)' : 'rgba(30, 41, 59, 0.5)',
                                                        border: `1px solid ${c.met ? 'rgba(16, 185, 129, 0.3)' : 'rgba(148, 163, 184, 0.14)'}`,
                                                        borderRadius: '7px',
                                                        padding: '6px 10px',
                                                        fontSize: '0.74rem'
                                                    }}
                                                >
                                                    <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                                                        {c.met ? '✅' : '⏳'} {c.label}
                                                    </span>
                                                    <span style={{ fontFamily: 'monospace', fontSize: '0.73rem', color: c.met ? '#34d399' : '#94a3b8', fontWeight: 700 }}>
                                                        Now: {c.current} <span style={{ color: '#64748b' }}>({c.target})</span>
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 10Y Backtest Footer */}
                                    <div style={{
                                        borderTop: '1px solid rgba(148, 163, 184, 0.14)',
                                        paddingTop: '8px',
                                        fontSize: '0.71rem',
                                        color: '#94a3b8',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '4px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                                            <span>
                                                <strong>10Y Triggers:</strong> <code style={{ color: '#f8fafc' }}>{bt.occurrences || 0}d</code>
                                            </span>
                                            <span>
                                                <strong>20D SPY Avg:</strong>{' '}
                                                <code style={{ color: (bt.fwd_20d_avg || 0) >= (btBase.fwd_20d_avg || 1.2) ? '#10b981' : '#f43f5e', fontWeight: 700 }}>
                                                    {bt.fwd_20d_avg >= 0 ? '+' : ''}{bt.fwd_20d_avg}%
                                                </code>{' '}
                                                <span style={{ color: '#64748b' }}>(vs +{btBase.fwd_20d_avg}% base)</span>
                                            </span>
                                            <span>
                                                <strong>60D SPY Avg:</strong>{' '}
                                                <code style={{ color: (bt.fwd_60d_avg || 0) >= (btBase.fwd_60d_avg || 3.6) ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
                                                    {bt.fwd_60d_avg >= 0 ? '+' : ''}{bt.fwd_60d_avg}%
                                                </code>{' '}
                                                ({bt.win_rate_60d}% win)
                                            </span>
                                        </div>
                                        <div style={{ color: '#64748b', fontSize: '0.69rem' }}>
                                            <strong>Analogues:</strong> {sig.historical_examples}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 2-Path Actionable Countdown to Next Market Bottom */}
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.9)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        borderRadius: '12px',
                        padding: '14px 16px'
                    }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#38bdf8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            🔭 HOW TO PREDICT THE EXACT NEXT MARKET BOTTOM (2 QUANTITATIVE PATHS)
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '12px' }}>
                            {(roadmap.when_will_market_bottom || []).map((item, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        background: item.triggered ? 'rgba(16, 185, 129, 0.09)' : 'rgba(30, 41, 59, 0.5)',
                                        border: item.triggered ? '1px solid rgba(16, 185, 129, 0.55)' : '1px solid rgba(148, 163, 184, 0.2)',
                                        borderRadius: '10px',
                                        padding: '12px'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '5px' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f8fafc' }}>
                                            {idx === 0 ? '🌊' : '🚀'} {item.path}
                                        </span>
                                        {item.triggered && (
                                            <span style={{
                                                fontSize: '0.68rem',
                                                fontWeight: 800,
                                                color: '#10b981',
                                                background: 'rgba(16, 185, 129, 0.16)',
                                                border: '1px solid rgba(16, 185, 129, 0.45)',
                                                padding: '2px 7px',
                                                borderRadius: '999px'
                                            }}>
                                                ✅ TRIGGERED NOW
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: item.triggered ? '#34d399' : '#38bdf8', fontWeight: 700, marginBottom: '5px' }}>
                                        Trigger Rule: {item.trigger}
                                    </div>
                                    <div style={{ fontSize: '0.74rem', color: '#cbd5e1', lineHeight: 1.45, marginBottom: '6px' }}>
                                        {item.meaning}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, fontFamily: 'monospace' }}>
                                        📈 10Y Empirical Edge: {item.historical_win_rate}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* VIEW 2: 13-SECTOR INFLOW / OUTFLOW RANKING MATRIX */}
            {activeView === 'sectors' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 700 }}>
                            Click any Sector ETF below to inspect its institutional chart & Stage/CANSLIM profile:
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {['ALL', 'OFFENSIVE', 'DEFENSIVE', 'REAL_ASSETS', 'SMALL_CAP'].map((b) => (
                                <button
                                    key={b}
                                    onClick={() => setBasketFilter(b)}
                                    style={{
                                        background: basketFilter === b ? 'rgba(56, 189, 248, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                                        border: basketFilter === b ? '1px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.2)',
                                        color: basketFilter === b ? '#38bdf8' : '#94a3b8',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {b.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.2)', color: '#94a3b8', textAlign: 'left' }}>
                                    <th style={{ padding: '8px 10px' }}>Rank / ETF</th>
                                    <th style={{ padding: '8px 10px' }}>Macro Basket</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Price (20D%)</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>5D Fast CMF</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>20D Primary CMF</th>
                                    <th style={{ padding: '8px 10px', width: '210px' }}>20D Institutional Flow Bar</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>60D Macro CMF</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>20D Net $ Flow</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Regime Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSectors.map((s, idx) => {
                                    const bBadge = BASKET_BADGE[s.basket] || BASKET_BADGE.OFFENSIVE;
                                    const barPct = Math.min(100, Math.abs(s.cmf_20d) * 350);
                                    const isPos = s.cmf_20d >= 0;
                                    return (
                                        <tr
                                            key={s.ticker}
                                            onClick={() => onTickerClick && onTickerClick(s.ticker)}
                                            style={{
                                                borderBottom: '1px solid rgba(148, 163, 184, 0.08)',
                                                cursor: onTickerClick ? 'pointer' : 'default',
                                                background: idx % 2 === 0 ? 'rgba(15, 23, 42, 0.45)' : 'transparent'
                                            }}
                                        >
                                            <td style={{ padding: '8px 10px', fontWeight: 800, color: '#f8fafc' }}>
                                                <span style={{ color: '#64748b', marginRight: '6px', fontFamily: 'monospace' }}>#{idx + 1}</span>
                                                <span style={{ color: s.color || '#38bdf8', textDecoration: 'underline', marginRight: '6px' }}>{s.ticker}</span>
                                                <span style={{ color: '#cbd5e1', fontWeight: 500, fontSize: '0.74rem' }}>{s.name}</span>
                                            </td>
                                            <td style={{ padding: '8px 10px' }}>
                                                <span style={{
                                                    background: bBadge.bg,
                                                    border: `1px solid ${bBadge.border}`,
                                                    color: bBadge.color,
                                                    fontSize: '0.65rem',
                                                    fontWeight: 800,
                                                    padding: '2px 7px',
                                                    borderRadius: '999px'
                                                }}>
                                                    {bBadge.label}
                                                </span>
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                                                <span style={{ color: '#f8fafc', fontWeight: 700 }}>${s.price}</span>{' '}
                                                <span style={{ color: s.ret_20d_pct >= 0 ? '#10b981' : '#f43f5e', fontSize: '0.72rem' }}>
                                                    ({s.ret_20d_pct >= 0 ? '+' : ''}{s.ret_20d_pct}%)
                                                </span>
                                            </td>
                                            <td style={{
                                                padding: '8px 10px',
                                                textAlign: 'right',
                                                fontFamily: 'monospace',
                                                fontWeight: 700,
                                                color: s.cmf_5d >= 0.03 ? '#10b981' : s.cmf_5d <= -0.03 ? '#f43f5e' : '#94a3b8'
                                            }}>
                                                {fmtCmf(s.cmf_5d)}
                                            </td>
                                            <td style={{
                                                padding: '8px 10px',
                                                textAlign: 'right',
                                                fontFamily: 'monospace',
                                                fontWeight: 900,
                                                fontSize: '0.84rem',
                                                color: isPos ? '#10b981' : '#f43f5e'
                                            }}>
                                                {fmtCmf(s.cmf_20d)}
                                            </td>
                                            <td style={{ padding: '8px 10px' }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    height: '12px',
                                                    background: 'rgba(30, 41, 59, 0.8)',
                                                    borderRadius: '6px',
                                                    overflow: 'hidden',
                                                    position: 'relative'
                                                }}>
                                                    <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: 'rgba(148,163,184,0.4)' }} />
                                                    {isPos ? (
                                                        <div style={{
                                                            marginLeft: '50%',
                                                            width: `${barPct / 2}%`,
                                                            height: '100%',
                                                            background: 'linear-gradient(90deg, #059669, #10b981)'
                                                        }} />
                                                    ) : (
                                                        <div style={{
                                                            marginLeft: `${50 - barPct / 2}%`,
                                                            width: `${barPct / 2}%`,
                                                            height: '100%',
                                                            background: 'linear-gradient(90deg, #f43f5e, #e11d48)'
                                                        }} />
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{
                                                padding: '8px 10px',
                                                textAlign: 'right',
                                                fontFamily: 'monospace',
                                                color: s.cmf_60d >= 0 ? '#34d399' : '#fda4af'
                                            }}>
                                                {fmtCmf(s.cmf_60d)}
                                            </td>
                                            <td style={{
                                                padding: '8px 10px',
                                                textAlign: 'right',
                                                fontFamily: 'monospace',
                                                color: s.net_dollar_flow_20d_m >= 0 ? '#10b981' : '#f43f5e',
                                                fontWeight: 700
                                            }}>
                                                {s.net_dollar_flow_20d_m >= 0 ? '+' : ''}${Math.abs(s.net_dollar_flow_20d_m).toLocaleString()}M
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                <span style={{
                                                    background: `${s.flow_color}20`,
                                                    border: `1px solid ${s.flow_color}66`,
                                                    color: s.flow_color,
                                                    fontSize: '0.66rem',
                                                    fontWeight: 800,
                                                    padding: '2px 8px',
                                                    borderRadius: '999px'
                                                }}>
                                                    {s.flow_status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* VIEW 3: 60-DAY TRAJECTORY SVG CHART */}
            {activeView === 'chart' && traj.length > 5 && (() => {
                const W = 920;
                const H = 260;
                const padL = 52;
                const padR = 24;
                const padT = 20;
                const padB = 30;
                const plotW = W - padL - padR;
                const plotH = H - padT - padB;

                const minCmf = -0.22;
                const maxCmf = 0.22;
                const xFor = (i) => padL + (i / (traj.length - 1)) * plotW;
                const yForCmf = (v) => {
                    const clamped = Math.max(minCmf, Math.min(maxCmf, v || 0));
                    return padT + ((maxCmf - clamped) / (maxCmf - minCmf)) * plotH;
                };
                const yZero = yForCmf(0);
                const yTopThresh = yForCmf(0.08);

                const buildPath = (key) =>
                    traj.map((pt, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yForCmf(pt[key]).toFixed(1)}`).join(' ');

                const activePt = hoverIdx !== null && traj[hoverIdx] ? traj[hoverIdx] : traj[traj.length - 1];

                return (
                    <div>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '10px',
                            marginBottom: '10px',
                            fontSize: '0.76rem'
                        }}>
                            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ color: '#38bdf8', fontWeight: 800 }}>━ Offensive CMF (20D)</span>
                                <span style={{ color: '#34d399', fontWeight: 800 }}>━ Defensive CMF (20D)</span>
                                <span style={{ color: '#f43f5e', fontWeight: 800 }}>━ Def − Off Spread (Top Trigger &gt;= +0.08)</span>
                                <span style={{ color: '#c084fc', fontWeight: 800 }}>-- XLK Tech CMF</span>
                            </div>
                            {activePt && (
                                <div style={{ fontFamily: 'monospace', color: '#e2e8f0', background: 'rgba(30,41,59,0.75)', padding: '4px 10px', borderRadius: '6px' }}>
                                    <strong>{activePt.date}</strong> | SPY: ${activePt.spy} | Off: {fmtCmf(activePt.off_cmf)} | Def: {fmtCmf(activePt.def_cmf)} | Spread: <span style={{ color: activePt.def_off_spread >= 0.08 ? '#f43f5e' : '#fbbf24', fontWeight: 800 }}>{fmtCmf(activePt.def_off_spread)}</span> | PosSec: {activePt.pos_sec_pct}%
                                </div>
                            )}
                        </div>

                        <svg
                            viewBox={`0 0 ${W} ${H}`}
                            style={{ width: '100%', height: 'auto', background: 'rgba(9, 14, 28, 0.9)', borderRadius: '10px', border: '1px solid rgba(148,163,184,0.16)' }}
                            onMouseLeave={() => setHoverIdx(null)}
                        >
                            {/* Zero Line & +0.08 Top Trigger Threshold Line */}
                            <line x1={padL} y1={yZero} x2={W - padR} y2={yZero} stroke="rgba(148,163,184,0.35)" strokeDasharray="4 4" />
                            <text x={padL - 6} y={yZero + 4} textAnchor="end" fill="#94a3b8" fontSize="10" fontFamily="monospace">0.00</text>

                            <line x1={padL} y1={yTopThresh} x2={W - padR} y2={yTopThresh} stroke="rgba(244,63,94,0.45)" strokeDasharray="3 3" />
                            <text x={padL - 6} y={yTopThresh + 4} textAnchor="end" fill="#f43f5e" fontSize="10" fontFamily="monospace">+0.08</text>

                            <line x1={padL} y1={yForCmf(-0.08)} x2={W - padR} y2={yForCmf(-0.08)} stroke="rgba(16,185,129,0.3)" strokeDasharray="3 3" />
                            <text x={padL - 6} y={yForCmf(-0.08) + 4} textAnchor="end" fill="#10b981" fontSize="10" fontFamily="monospace">-0.08</text>

                            {/* Trajectories */}
                            <path d={buildPath('off_cmf')} fill="none" stroke="#38bdf8" strokeWidth="2.2" />
                            <path d={buildPath('def_cmf')} fill="none" stroke="#34d399" strokeWidth="2.2" />
                            <path d={buildPath('def_off_spread')} fill="none" stroke="#f43f5e" strokeWidth="2.6" />
                            <path d={buildPath('xlk_cmf')} fill="none" stroke="#c084fc" strokeWidth="1.6" strokeDasharray="4 3" />

                            {/* Top Signal Markers */}
                            {traj.map((pt, i) =>
                                pt.top_sig ? (
                                    <circle
                                        key={`top-${i}`}
                                        cx={xFor(i)}
                                        cy={yForCmf(pt.def_off_spread)}
                                        r="4.5"
                                        fill="#f43f5e"
                                        stroke="#fff"
                                        strokeWidth="1.2"
                                    />
                                ) : null
                            )}

                            {/* Interactive Hover Columns */}
                            {traj.map((pt, i) => (
                                <rect
                                    key={`hit-${i}`}
                                    x={xFor(i) - plotW / traj.length / 2}
                                    y={padT}
                                    width={plotW / traj.length}
                                    height={plotH}
                                    fill="transparent"
                                    onMouseEnter={() => setHoverIdx(i)}
                                />
                            ))}

                            {/* X-Axis Date Labels */}
                            {[0, Math.floor(traj.length * 0.25), Math.floor(traj.length * 0.5), Math.floor(traj.length * 0.75), traj.length - 1].map((idx) => (
                                <text
                                    key={`xl-${idx}`}
                                    x={xFor(idx)}
                                    y={H - 8}
                                    textAnchor="middle"
                                    fill="#94a3b8"
                                    fontSize="10"
                                    fontFamily="monospace"
                                >
                                    {traj[idx]?.date}
                                </text>
                            ))}
                        </svg>
                    </div>
                );
            })()}

            {/* VIEW 4: 10-YEAR HISTORICAL TURNING POINTS TABLE */}
            {activeView === 'history' && (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.77rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.22)', color: '#94a3b8', textAlign: 'left' }}>
                                <th style={{ padding: '8px 10px' }}>Date</th>
                                <th style={{ padding: '8px 10px' }}>10-Year Market Cycle Landmark</th>
                                <th style={{ padding: '8px 10px' }}>Turn Type</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>SPY</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>OffCMF (20D)</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>DefCMF (20D)</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Def − Off Spread</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>XLK CMF</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>PosSec%</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>PanicOut%</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>SPY +20D</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>SPY +60D</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((h, i) => {
                                const isTop = h.event_type.includes('TOP');
                                const isBot = h.event_type.includes('BOTTOM');
                                return (
                                    <tr
                                        key={`${h.date}-${i}`}
                                        style={{
                                            borderBottom: '1px solid rgba(148, 163, 184, 0.09)',
                                            background: h.event_type === 'CURRENT REGIME' ? 'rgba(56, 189, 248, 0.12)' : 'transparent'
                                        }}
                                    >
                                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#cbd5e1' }}>{h.date}</td>
                                        <td style={{ padding: '8px 10px', fontWeight: 700, color: '#f8fafc' }}>{h.event}</td>
                                        <td style={{ padding: '8px 10px' }}>
                                            <span style={{
                                                background: isTop ? 'rgba(244,63,94,0.16)' : isBot ? 'rgba(16,185,129,0.16)' : 'rgba(56,189,248,0.18)',
                                                border: `1px solid ${isTop ? 'rgba(244,63,94,0.45)' : isBot ? 'rgba(16,185,129,0.45)' : 'rgba(56,189,248,0.45)'}`,
                                                color: isTop ? '#fda4af' : isBot ? '#6ee7b7' : '#38bdf8',
                                                padding: '2px 7px',
                                                borderRadius: '999px',
                                                fontSize: '0.66rem',
                                                fontWeight: 800
                                            }}>
                                                {h.event_type}
                                            </span>
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#e2e8f0' }}>${h.spy_price}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: h.off_cmf >= 0 ? '#10b981' : '#f43f5e' }}>{fmtCmf(h.off_cmf)}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: h.def_cmf >= 0 ? '#34d399' : '#f43f5e' }}>{fmtCmf(h.def_cmf)}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: h.def_off_spread >= 0.08 ? '#f43f5e' : '#cbd5e1' }}>
                                            {fmtCmf(h.def_off_spread)}
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: h.xlk_cmf >= 0 ? '#10b981' : '#f43f5e' }}>{fmtCmf(h.xlk_cmf)}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: h.pos_sec_pct <= 20 ? '#10b981' : '#cbd5e1', fontWeight: h.pos_sec_pct <= 20 ? 800 : 500 }}>
                                            {h.pos_sec_pct}%
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: h.panic_out_pct >= 45 ? '#10b981' : '#94a3b8', fontWeight: h.panic_out_pct >= 45 ? 800 : 500 }}>
                                            {h.panic_out_pct}%
                                        </td>
                                        <td style={{
                                            padding: '8px 10px',
                                            textAlign: 'right',
                                            fontFamily: 'monospace',
                                            fontWeight: 700,
                                            color: h.spy_fwd_20d_pct === null ? '#64748b' : h.spy_fwd_20d_pct >= 0 ? '#10b981' : '#f43f5e'
                                        }}>
                                            {h.spy_fwd_20d_pct === null ? 'LIVE' : `${h.spy_fwd_20d_pct >= 0 ? '+' : ''}${h.spy_fwd_20d_pct}%`}
                                        </td>
                                        <td style={{
                                            padding: '8px 10px',
                                            textAlign: 'right',
                                            fontFamily: 'monospace',
                                            fontWeight: 700,
                                            color: h.spy_fwd_60d_pct === null ? '#64748b' : h.spy_fwd_60d_pct >= 0 ? '#10b981' : '#f43f5e'
                                        }}>
                                            {h.spy_fwd_60d_pct === null ? 'LIVE' : `${h.spy_fwd_60d_pct >= 0 ? '+' : ''}${h.spy_fwd_60d_pct}%`}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
