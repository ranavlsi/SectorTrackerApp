/**
 * src/utils/dcfEngine.js
 * Real-Time Client-Side DCF & Sensitivity Engine
 * Provides sub-millisecond, 60 FPS calculations for interactive sliders.
 */

export function calculateDCF({
  baseRevenue,
  baseFCF,
  sharesOutstanding,
  totalCash,
  totalDebt,
  growthRate5Y, // e.g. 0.12
  targetOperatingMargin, // e.g. 0.28
  terminalGrowthRate = 0.025, // e.g. 0.025
  wacc = 0.09, // e.g. 0.09
  useMargin = false,
  taxRate = 0.21,
  exitMultiple = null,
  currentPrice = 0
}) {
  if (wacc <= terminalGrowthRate && !exitMultiple) {
    wacc = terminalGrowthRate + 0.005;
  }

  let pvFCFs = 0;
  let currentRev = baseRevenue;
  const projections = [];

  for (let year = 1; year <= 5; year++) {
    currentRev *= (1 + growthRate5Y);
    let yearFCF = 0;

    if (useMargin && targetOperatingMargin != null) {
      const ebit = currentRev * targetOperatingMargin;
      const nopat = ebit * (1 - taxRate);
      yearFCF = nopat * 0.85; // normalized net reinvestment rate
    } else {
      yearFCF = baseFCF * Math.pow(1 + growthRate5Y, year);
    }

    // Mid-year discount convention: (year - 0.5)
    const discountFactor = 1.0 / Math.pow(1 + wacc, year - 0.5);
    const pv = yearFCF * discountFactor;
    pvFCFs += pv;

    projections.push({
      year,
      revenue: currentRev,
      fcf: yearFCF,
      pv
    });
  }

  const finalFCF = projections[projections.length - 1].fcf;
  let terminalValue = 0;

  if (exitMultiple && exitMultiple > 0) {
    terminalValue = finalFCF * exitMultiple;
  } else {
    terminalValue = (finalFCF * (1 + terminalGrowthRate)) / (wacc - terminalGrowthRate);
  }

  const pvTerminalValue = terminalValue / Math.pow(1 + wacc, 5);
  const enterpriseValue = pvFCFs + pvTerminalValue;
  const equityValue = enterpriseValue + totalCash - totalDebt;

  const fairValue = sharesOutstanding > 0 ? Math.max(0, equityValue / sharesOutstanding) : 0;
  const upsidePct = currentPrice > 0 ? ((fairValue - currentPrice) / currentPrice) * 100 : 0;

  return {
    fairValue: Number(fairValue.toFixed(2)),
    upsidePct: Number(upsidePct.toFixed(1)),
    enterpriseValue,
    equityValue,
    pvFCFs,
    pvTerminalValue,
    projections
  };
}

/**
 * Instant Client-Side Reverse DCF Solver (Bisection)
 */
export function solveReverseDCF(params, currentPrice) {
  let low = -0.40;
  let high = 0.80;
  let impliedGrowth = 0;

  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    const res = calculateDCF({ ...params, growthRate5Y: mid, currentPrice });
    const diff = res.fairValue - currentPrice;

    if (Math.abs(diff) < 0.05) {
      impliedGrowth = mid;
      break;
    }
    if (diff < 0) {
      low = mid;
    } else {
      high = mid;
    }
    impliedGrowth = mid;
  }

  const pct = impliedGrowth * 100;
  let category = "Realistic";
  let color = "text-blue-400";
  let bg = "bg-blue-500/10 border-blue-500/20";

  if (pct < 0) {
    category = "Priced for Decline / Distressed";
    color = "text-rose-400";
    bg = "bg-rose-500/10 border-rose-500/20";
  } else if (pct < 6) {
    category = "Conservative / Deep Value";
    color = "text-emerald-400";
    bg = "bg-emerald-500/10 border-emerald-500/20";
  } else if (pct < 15) {
    category = "Moderate / Reasonable";
    color = "text-cyan-400";
    bg = "bg-cyan-500/10 border-cyan-500/20";
  } else if (pct < 25) {
    category = "Aggressive Growth";
    color = "text-amber-400";
    bg = "bg-amber-500/10 border-amber-500/20";
  } else {
    category = "Priced for Perfection";
    color = "text-purple-400";
    bg = "bg-purple-500/10 border-purple-500/20";
  }

  return {
    impliedGrowthPct: Number(pct.toFixed(1)),
    category,
    color,
    bg
  };
}

/**
 * 5x5 WACC vs Terminal Growth Sensitivity Matrix
 */
export function generateSensitivityMatrix(params, currentPrice) {
  const baseWACC = params.wacc;
  const baseTG = params.terminalGrowthRate;

  const waccOffsets = [-0.01, -0.005, 0, 0.005, 0.01];
  const tgOffsets = [-0.006, -0.003, 0, 0.003, 0.006];

  return waccOffsets.map((wOff) => {
    const w = baseWACC + wOff;
    return tgOffsets.map((tgOff) => {
      const tg = baseTG + tgOff;
      const res = calculateDCF({ ...params, wacc: w, terminalGrowthRate: tg, currentPrice });
      return {
        wacc: Number((w * 100).toFixed(1)),
        terminalGrowth: Number((tg * 100).toFixed(1)),
        fairValue: res.fairValue,
        upsidePct: res.upsidePct,
        isBase: wOff === 0 && tgOff === 0
      };
    });
  });
}
