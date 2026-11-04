import React from 'react';

export default function RsSparkline({
  data,
  status,
  isBlueDot = false,
  rsVsHigh = 0,
  width = 128,
  height = 36,
}) {
  if (!Array.isArray(data) || data.length < 2) return null;

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const span = maxVal - minVal || 0.0001;

  const padX = 4;
  const padY = 5;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const points = data.map((val, i) => {
    const x = padX + (i / (data.length - 1)) * innerW;
    const y = padY + innerH - ((val - minVal) / span) * innerH;
    return [x, y];
  });

  const polylinePoints = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const firstPt = points[0];
  const lastPt = points[points.length - 1];
  const areaPath = `M ${firstPt[0].toFixed(1)},${(height - 2).toFixed(1)} L ${points
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' L ')} L ${lastPt[0].toFixed(1)},${(height - 2).toFixed(1)} Z`;

  let strokeColor = '#38bdf8'; // Default cyan
  let fillRgba = 'rgba(56, 189, 248, 0.14)';
  if (isBlueDot || rsVsHigh >= 98.5) {
    strokeColor = '#00E676'; // MarketSurge / IBD Blue-Green RS New High
    fillRgba = 'rgba(0, 230, 118, 0.16)';
  } else if (status === 'c_and_h') {
    strokeColor = '#c084fc'; // Purple Cup & Handle
    fillRgba = 'rgba(192, 132, 252, 0.16)';
  } else if (status === 'cup') {
    strokeColor = '#f59e0b'; // Amber Cup
    fillRgba = 'rgba(245, 158, 11, 0.14)';
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}
    >
      {/* 52W RS High Reference Line */}
      <line
        x1={padX}
        y1={padY}
        x2={width - padX}
        y2={padY}
        stroke="rgba(148, 163, 184, 0.22)"
        strokeWidth="1"
        strokeDasharray="2,2"
      />
      {/* Area Fill */}
      <path d={areaPath} fill={fillRgba} />
      {/* RS Line Curve */}
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polylinePoints}
      />
      {/* Endpoint / Blue Dot Marker */}
      {(isBlueDot || rsVsHigh >= 98.5) ? (
        <>
          <circle
            cx={lastPt[0]}
            cy={lastPt[1]}
            r="4.5"
            fill="rgba(56, 189, 248, 0.35)"
          />
          <circle
            cx={lastPt[0]}
            cy={lastPt[1]}
            r="2.8"
            fill="#00f2fe"
            stroke="#ffffff"
            strokeWidth="1"
          />
        </>
      ) : (
        <circle
          cx={lastPt[0]}
          cy={lastPt[1]}
          r="2.2"
          fill={strokeColor}
        />
      )}
    </svg>
  );
}
