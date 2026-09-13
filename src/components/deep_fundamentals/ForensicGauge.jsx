import React from 'react';
import ForensicCard from './ForensicCard';

/**
 * Backwards-compatible export bridging ForensicGauge to the institutional ForensicCard
 */
export default function ForensicGauge(props) {
  let detectedType = 'altman';
  const label = (props.label || '').toLowerCase();

  if (label.includes('altman') || label.includes('z-score')) {
    detectedType = 'altman';
  } else if (label.includes('beneish') || label.includes('m-score')) {
    detectedType = 'beneish';
  } else if (label.includes('piotroski') || label.includes('f-score')) {
    detectedType = 'piotroski';
  } else if (label.includes('squeeze') || label.includes('short')) {
    detectedType = 'squeeze';
  }

  return (
    <ForensicCard
      type={detectedType}
      value={props.value}
      status={props.status}
      statusColor={props.statusColor}
    />
  );
}
