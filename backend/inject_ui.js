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
