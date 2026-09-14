import React from 'react';
import GexProfilerSuite from './GexProfilerSuite';

/**
 * GexHeatmap component upgraded to render the full Institutional GEX Profiler Suite
 * while preserving full backwards compatibility across any parent views.
 */
const GexHeatmap = ({ ticker = 'SPY' }) => {
  return <GexProfilerSuite initialTicker={ticker} />;
};

export default GexHeatmap;

