import React from 'react';

/**
 * Lightweight, High-Precision SVG Financial Sparkline (Koyfin Style)
 * Renders an inline multi-period trendline with end-dot indicator.
 */
export default function Sparkline({
  data = [],
  color = '#00F0FF',
  width = 64,
  height = 20,
  showArea = true
}) {
  if (!data || data.length < 2) {
    return <span className="text-slate-600 font-mono text-[10px]">---</span>;
  }

  const validData = data.map((v) => (typeof v === 'number' && !isNaN(v) ? v : 0));
  const min = Math.min(...validData);
  const max = Math.max(...validData);
  const range = max - min || 1;

  const points = validData.map((d, i) => {
    const x = (i / (validData.length - 1)) * (width - 4) + 2;
    const y = height - ((d - min) / range) * (height - 6) - 3;
    return `${x},${y}`;
  });

  const polylinePoints = points.join(' ');
  const lastPoint = points[points.length - 1].split(',');
  const lastX = parseFloat(lastPoint[0]);
  const lastY = parseFloat(lastPoint[1]);

  const isUp = validData[validData.length - 1] >= validData[0];
  const strokeColor = color === 'auto' ? (isUp ? '#00E676' : '#FF3366') : color;

  const areaPoints = `${points[0].split(',')[0]},${height} ${polylinePoints} ${lastX},${height}`;

  return (
    <div className="inline-flex items-center">
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id={`spark-grad-${strokeColor.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
          </linearGradient>
        </defs>

        {showArea && (
          <polygon
            points={areaPoints}
            fill={`url(#spark-grad-${strokeColor.replace('#', '')})`}
          />
        )}

        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polylinePoints}
        />

        <circle
          cx={lastX}
          cy={lastY}
          r="2.5"
          fill={strokeColor}
          filter="drop-shadow(0 0 3px rgba(0,0,0,0.8))"
        />
      </svg>
    </div>
  );
}
