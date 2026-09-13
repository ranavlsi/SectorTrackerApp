import React from 'react';

/**
 * SimplyWallSt-Inspired 5-Pillar Snowflake Radar Polygon
 * Scores corporate fundamentals across:
 * 1. Value (DCF, Multiples)
 * 2. Future Growth (Forecast CAGR, Guidance)
 * 3. Past Performance (Historical ROE, Beat Streak)
 * 4. Financial Health (Altman Z, Solvency, Debt)
 * 5. Capital Return (Buyback Cannibal, Dividend, FCF)
 */
export default function SnowflakeRadar({
  pillars = {
    value: 16,
    futureGrowth: 18,
    pastPerformance: 19,
    financialHealth: 17,
    capitalReturn: 16
  },
  totalScore = 86
}) {
  const axes = [
    { key: 'value', label: 'Value', score: pillars.value ?? 16, max: 20 },
    { key: 'futureGrowth', label: 'Future Growth', score: pillars.futureGrowth ?? 18, max: 20 },
    { key: 'pastPerformance', label: 'Past Performance', score: pillars.pastPerformance ?? 19, max: 20 },
    { key: 'financialHealth', label: 'Health', score: pillars.financialHealth ?? 17, max: 20 },
    { key: 'capitalReturn', label: 'Capital Return', score: pillars.capitalReturn ?? 16, max: 20 }
  ];

  const cx = 110;
  const cy = 100;
  const r = 68;

  // Compute 5 vertices of the outer grid
  const angles = axes.map((_, i) => (i * 2 * Math.PI) / 5 - Math.PI / 2);

  // Background concentric rings at 25%, 50%, 75%, 100%
  const gridRings = [0.25, 0.5, 0.75, 1.0].map((scale) => {
    return angles.map((a) => `${cx + r * scale * Math.cos(a)},${cy + r * scale * Math.sin(a)}`).join(' ');
  });

  // Data polygon points
  const dataPoints = axes.map((ax, i) => {
    const scale = Math.max(0.1, Math.min(1.0, ax.score / ax.max));
    const a = angles[i];
    const x = cx + r * scale * Math.cos(a);
    const y = cy + r * scale * Math.sin(a);
    return `${x},${y}`;
  }).join(' ');

  const scoreColor = totalScore >= 75 ? '#00E676' : totalScore >= 50 ? '#00F0FF' : totalScore >= 35 ? '#FFB300' : '#FF3366';

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, rgba(18, 24, 38, 0.95) 0%, rgba(10, 14, 23, 0.95) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
      }}
      className="p-4 rounded-2xl flex flex-col items-center justify-between"
    >
      <div className="w-full flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00F0FF]"></span>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
            5-Pillar Snowflake Radar
          </span>
        </div>
        <span
          className="text-xs font-mono font-black px-2 py-0.5 rounded border"
          style={{
            color: scoreColor,
            borderColor: `${scoreColor}40`,
            backgroundColor: `${scoreColor}15`
          }}
        >
          {totalScore}/100 Score
        </span>
      </div>

      {/* SVG Radar */}
      <div className="relative w-56 h-52 flex items-center justify-center my-1">
        <svg viewBox="0 0 220 200" className="w-full h-full overflow-visible">
          <defs>
            <radialGradient id="snowflakeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.08" />
            </radialGradient>
          </defs>

          {/* Web grid lines from center */}
          {angles.map((a, i) => (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={cx + r * Math.cos(a)}
              y2={cy + r * Math.sin(a)}
              stroke="#1e293b"
              strokeWidth="1.5"
            />
          ))}

          {/* Concentric rings */}
          {gridRings.map((pts, i) => (
            <polygon
              key={i}
              points={pts}
              fill="none"
              stroke="#1e293b"
              strokeWidth="1"
              strokeDasharray={i < 3 ? '2 2' : 'none'}
            />
          ))}

          {/* Active Data Polygon */}
          <polygon
            points={dataPoints}
            fill="url(#snowflakeGlow)"
            stroke="#00F0FF"
            strokeWidth="2"
            strokeLinejoin="round"
            className="transition-all duration-700 ease-out"
          />

          {/* Data Vertices */}
          {axes.map((ax, i) => {
            const scale = Math.max(0.1, Math.min(1.0, ax.score / ax.max));
            const a = angles[i];
            const x = cx + r * scale * Math.cos(a);
            const y = cy + r * scale * Math.sin(a);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="3.5"
                fill="#00F0FF"
                stroke="#090d16"
                strokeWidth="1.5"
              />
            );
          })}

          {/* Text Labels */}
          {axes.map((ax, i) => {
            const a = angles[i];
            const lx = cx + (r + 18) * Math.cos(a);
            const ly = cy + (r + 14) * Math.sin(a);
            return (
              <text
                key={i}
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#94a3b8"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="700"
              >
                {ax.label}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Mini Pillar Pills Row */}
      <div className="w-full grid grid-cols-5 gap-1 pt-2 border-t border-slate-800 text-center font-mono">
        {axes.map((ax, i) => (
          <div key={i} className="bg-slate-950/60 p-1 rounded border border-slate-800/80">
            <div className="text-[8px] text-slate-400 uppercase truncate">{ax.label.split(' ')[0]}</div>
            <div className="text-[11px] font-black text-cyan-300">{ax.score}/20</div>
          </div>
        ))}
      </div>
    </div>
  );
}
