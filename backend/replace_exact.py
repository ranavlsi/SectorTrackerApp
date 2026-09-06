with open('/Users/amitkumar/Desktop/SectorTrackerApp/src/App.jsx', 'r') as f:
    content = f.read()

old_logic = """
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
      
      const sectorObj = { name: mSector.name, status: `[M: ${mQuad}] [W: ${wQuad}] [D: ${dQuad}]` };

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
  };"""

new_logic = """
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
  };"""

content = content.replace(old_logic.strip(), new_logic.strip())

old_ui = """
          {/* Multi-Timeframe Trade Playbook */}
          <div className="glass-card" style={{ marginTop: '20px' }}>
            <h2 style={{ textAlign: 'left', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Compass color="#a855f7" /> Multi-Timeframe Trade Playbook
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', marginBottom: '20px' }}>
              The engine automatically maps sector quadrant positions across Monthly, Weekly, and Daily timeframes to find actionable trade setups based on cross-timeframe alignment.
            </p>
            
            {(() => {
              const playbooks = getMultiTimeframeSummary();
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                  
                  {/* Pullback Buys */}
                  <div className="stat-card" style={{ padding: '15px' }}>
                    <h3 style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 15px 0' }}>
                      <ActivitySquare size={18} /> Pullback Buys
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0 0 10px 0' }}>Structural uptrend, short-term dip.</p>
                    {playbooks.pullbackBuys.length === 0 ? <p style={{ color: '#555', fontSize: '0.9rem' }}>No setups.</p> : playbooks.pullbackBuys.map((s, i) => (
                      <div key={i} style={{ marginBottom: '8px', fontSize: '0.9rem' }}>
                        <strong>{s.name}</strong> <span style={{ color: '#888', display: 'block', fontSize: '0.75rem' }}>{s.status}</span>
                      </div>
                    ))}
                  </div>

                  {/* Emerging Leaders */}
                  <div className="stat-card" style={{ padding: '15px' }}>
                    <h3 style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 15px 0' }}>
                      <TrendingUp size={18} /> Emerging Leaders
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0 0 10px 0' }}>Early-stage momentum shift.</p>
                    {playbooks.emergingLeaders.length === 0 ? <p style={{ color: '#555', fontSize: '0.9rem' }}>No setups.</p> : playbooks.emergingLeaders.map((s, i) => (
                      <div key={i} style={{ marginBottom: '8px', fontSize: '0.9rem' }}>
                        <strong>{s.name}</strong> <span style={{ color: '#888', display: 'block', fontSize: '0.75rem' }}>{s.status}</span>
                      </div>
                    ))}
                  </div>

                  {/* Exhaustion Warnings */}
                  <div className="stat-card" style={{ padding: '15px' }}>
                    <h3 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 15px 0' }}>
                      <AlertCircle size={18} /> Exhaustion Warnings
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0 0 10px 0' }}>Macro leader breaking down short-term.</p>
                    {playbooks.exhaustionWarnings.length === 0 ? <p style={{ color: '#555', fontSize: '0.9rem' }}>No setups.</p> : playbooks.exhaustionWarnings.map((s, i) => (
                      <div key={i} style={{ marginBottom: '8px', fontSize: '0.9rem' }}>
                        <strong>{s.name}</strong> <span style={{ color: '#888', display: 'block', fontSize: '0.75rem' }}>{s.status}</span>
                      </div>
                    ))}
                  </div>

                  {/* Full Throttle */}
                  <div className="stat-card" style={{ padding: '15px' }}>
                    <h3 style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 15px 0' }}>
                      <Zap size={18} /> Full Throttle
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0 0 10px 0' }}>Leading on all timeframes.</p>
                    {playbooks.fullThrottle.length === 0 ? <p style={{ color: '#555', fontSize: '0.9rem' }}>No setups.</p> : playbooks.fullThrottle.map((s, i) => (
                      <div key={i} style={{ marginBottom: '8px', fontSize: '0.9rem' }}>
                        <strong>{s.name}</strong> <span style={{ color: '#888', display: 'block', fontSize: '0.75rem' }}>{s.status}</span>
                      </div>
                    ))}
                  </div>

                </div>
              )
            })()}
          </div>
"""

new_ui = """
          {/* Multi-Timeframe Trade Playbook */}
          <div className="glass-card" style={{ marginTop: '20px' }}>
            <h2 style={{ textAlign: 'left', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Compass color="#a855f7" /> Multi-Timeframe Trade Playbook
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', marginBottom: '20px' }}>
              The engine automatically maps sector quadrant positions across Monthly, Weekly, and Daily timeframes to find actionable trade setups based on cross-timeframe alignment.
            </p>
            
            {(() => {
              const playbooks = getMultiTimeframeSummary();
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                  
                  {/* Pullback Buys */}
                  <div className="stat-card" style={{ padding: '15px' }}>
                    <h3 style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 15px 0' }}>
                      <ActivitySquare size={18} /> Pullback Buys
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0 0 10px 0' }}>Structural uptrend, short-term dip.</p>
                    {playbooks.pullbackBuys.length === 0 ? <p style={{ color: '#555', fontSize: '0.9rem' }}>No setups.</p> : playbooks.pullbackBuys.map((s, i) => (
                      <div key={i} style={{ marginBottom: '12px', fontSize: '0.9rem', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <strong>{s.name}</strong> 
                        <span style={{ color: '#888', display: 'block', fontSize: '0.75rem', marginTop: '2px' }}>{s.status}</span>
                        {s.topStocks && <span style={{ color: '#4facfe', display: 'block', fontSize: '0.8rem', marginTop: '4px', fontWeight: 500 }}>{s.topStocks}</span>}
                      </div>
                    ))}
                  </div>

                  {/* Emerging Leaders */}
                  <div className="stat-card" style={{ padding: '15px' }}>
                    <h3 style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 15px 0' }}>
                      <TrendingUp size={18} /> Emerging Leaders
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0 0 10px 0' }}>Early-stage momentum shift.</p>
                    {playbooks.emergingLeaders.length === 0 ? <p style={{ color: '#555', fontSize: '0.9rem' }}>No setups.</p> : playbooks.emergingLeaders.map((s, i) => (
                      <div key={i} style={{ marginBottom: '12px', fontSize: '0.9rem', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <strong>{s.name}</strong> 
                        <span style={{ color: '#888', display: 'block', fontSize: '0.75rem', marginTop: '2px' }}>{s.status}</span>
                        {s.topStocks && <span style={{ color: '#4facfe', display: 'block', fontSize: '0.8rem', marginTop: '4px', fontWeight: 500 }}>{s.topStocks}</span>}
                      </div>
                    ))}
                  </div>

                  {/* Exhaustion Warnings */}
                  <div className="stat-card" style={{ padding: '15px' }}>
                    <h3 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 15px 0' }}>
                      <AlertCircle size={18} /> Exhaustion Warnings
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0 0 10px 0' }}>Macro leader breaking down short-term.</p>
                    {playbooks.exhaustionWarnings.length === 0 ? <p style={{ color: '#555', fontSize: '0.9rem' }}>No setups.</p> : playbooks.exhaustionWarnings.map((s, i) => (
                      <div key={i} style={{ marginBottom: '12px', fontSize: '0.9rem', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <strong>{s.name}</strong> 
                        <span style={{ color: '#888', display: 'block', fontSize: '0.75rem', marginTop: '2px' }}>{s.status}</span>
                        {s.topStocks && <span style={{ color: '#4facfe', display: 'block', fontSize: '0.8rem', marginTop: '4px', fontWeight: 500 }}>{s.topStocks}</span>}
                      </div>
                    ))}
                  </div>

                  {/* Full Throttle */}
                  <div className="stat-card" style={{ padding: '15px' }}>
                    <h3 style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 15px 0' }}>
                      <Zap size={18} /> Full Throttle
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0 0 10px 0' }}>Leading on all timeframes.</p>
                    {playbooks.fullThrottle.length === 0 ? <p style={{ color: '#555', fontSize: '0.9rem' }}>No setups.</p> : playbooks.fullThrottle.map((s, i) => (
                      <div key={i} style={{ marginBottom: '12px', fontSize: '0.9rem', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <strong>{s.name}</strong> 
                        <span style={{ color: '#888', display: 'block', fontSize: '0.75rem', marginTop: '2px' }}>{s.status}</span>
                        {s.topStocks && <span style={{ color: '#4facfe', display: 'block', fontSize: '0.8rem', marginTop: '4px', fontWeight: 500 }}>{s.topStocks}</span>}
                      </div>
                    ))}
                  </div>

                </div>
              )
            })()}
          </div>
"""

content = content.replace(old_ui.strip(), new_ui.strip())

with open('/Users/amitkumar/Desktop/SectorTrackerApp/src/App.jsx', 'w') as f:
    f.write(content)

