  const getQuadrant = (x, y) => {
    if (x >= 100 && y >= 100) return 'Leading';
    if (x >= 100 && y < 100) return 'Weakening';
    if (x < 100 && y < 100) return 'Lagging';
    if (x < 100 && y >= 100) return 'Improving';
    return 'Unknown';
  };

  const getMultiTimeframeSummary = () => {
    const playbooks = {
      pullbackBuys: [],
      emergingLeaders: [],
      exhaustionWarnings: [],
      fullThrottle: []
    };

    const monthlyData = data.rrg?.monthly || [];
    const weeklyData = data.rrg?.weekly || [];
    const dailyData = data.rrg?.daily || [];

    if (!monthlyData.length || !weeklyData.length || !dailyData.length) return playbooks;

    monthlyData.forEach(mSector => {
      if (!mSector.trail || mSector.trail.length === 0) return;
      
      const wSector = weeklyData.find(s => s.name === mSector.name);
      const dSector = dailyData.find(s => s.name === mSector.name);
      
      if (!wSector || !wSector.trail || !dSector || !dSector.trail) return;

      const mCur = mSector.trail[mSector.trail.length - 1];
      const wCur = wSector.trail[wSector.trail.length - 1];
      const dCur = dSector.trail[dSector.trail.length - 1];

      const mQuad = getQuadrant(mCur.x, mCur.y);
      const wQuad = getQuadrant(wCur.x, wCur.y);
      const dQuad = getQuadrant(dCur.x, dCur.y);
      
      const topStocks = (dSector.top_stocks || []).slice(0, 3).map(s => s.ticker).join(", ");
      
      const sectorObj = { 
        name: mSector.name, 
        status: `[M: ${mQuad}] [W: ${wQuad}] [D: ${dQuad}]`,
        topStocks: topStocks ? `Top 3: ${topStocks}` : ''
      };

      // Pullback Buy: Monthly Up, Weekly Up, Daily Pulling Back
      if ((mQuad === 'Leading' || mQuad === 'Improving') && (wQuad === 'Leading') && (dQuad === 'Weakening' || dQuad === 'Lagging')) {
        playbooks.pullbackBuys.push(sectorObj);
      }
      // Emerging Leader: Monthly Beaten Down, Weekly turning, Daily Up
      else if ((mQuad === 'Lagging' || mQuad === 'Improving') && (wQuad === 'Improving' || wQuad === 'Leading') && (dQuad === 'Leading')) {
        playbooks.emergingLeaders.push(sectorObj);
      }
      // Exhaustion Warning: Monthly Leading, but lower timeframes breaking down
      else if (mQuad === 'Leading' && (wQuad === 'Weakening' || wQuad === 'Lagging') && (dQuad === 'Lagging')) {
        playbooks.exhaustionWarnings.push(sectorObj);
      }
      // Full Throttle: Everything is Leading
      else if (mQuad === 'Leading' && wQuad === 'Leading' && dQuad === 'Leading') {
        playbooks.fullThrottle.push(sectorObj);
      }
    });

    return playbooks;
  };
