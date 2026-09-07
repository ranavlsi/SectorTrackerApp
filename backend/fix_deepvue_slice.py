with open('/Users/amitkumar/Desktop/SectorTrackerApp/src/App.jsx', 'r') as f:
    content = f.read()

# Replace leaders map
old_leaders_map = """                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {deepvueData.leaders.map(item => ("""

new_leaders_map = """                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {deepvueData.leaders.slice(0, expandedCategories.deepvue_leaders ? 20 : 5).map(item => ("""

content = content.replace(old_leaders_map, new_leaders_map)

# Replace leaders button inject
old_leaders_end = """                        />
                      ))}
                    </div>"""

new_leaders_end = """                        />
                      ))}
                      {deepvueData.leaders.length > 5 && (
                        <button 
                          onClick={() => setExpandedCategories(prev => ({ ...prev, deepvue_leaders: !prev.deepvue_leaders }))}
                          style={{ 
                            background: 'rgba(255, 215, 0, 0.05)', 
                            border: '1px dashed rgba(255, 215, 0, 0.3)', 
                            color: '#ffd700', 
                            padding: '0.5rem', 
                            borderRadius: '4px', 
                            cursor: 'pointer', 
                            marginTop: '0.5rem',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          {expandedCategories.deepvue_leaders ? (
                            <><ChevronUp size={16} /> Fold Up</>
                          ) : (
                            <><ChevronDown size={16} /> View {Math.min(20, deepvueData.leaders.length)} / {deepvueData.leaders.length} Leaders</>
                          )}
                        </button>
                      )}
                    </div>"""

if "deepvueData.leaders.length > 5" not in content:
    content = content.replace(old_leaders_end, new_leaders_end)

# Replace VCP map
old_vcp_map = """                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {deepvueData.active_vcp.map(item => ("""

new_vcp_map = """                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {deepvueData.active_vcp.slice(0, expandedCategories.deepvue_vcp ? 20 : 5).map(item => ("""

content = content.replace(old_vcp_map, new_vcp_map)

# Replace VCP button inject
old_vcp_end = """                        />
                          ))}
                        </div>"""

new_vcp_end = """                        />
                          ))}
                          {deepvueData.active_vcp.length > 5 && (
                            <button 
                              onClick={() => setExpandedCategories(prev => ({ ...prev, deepvue_vcp: !prev.deepvue_vcp }))}
                              style={{ 
                                background: 'rgba(255, 215, 0, 0.05)', 
                                border: '1px dashed rgba(255, 215, 0, 0.3)', 
                                color: '#ffd700', 
                                padding: '0.5rem', 
                                borderRadius: '4px', 
                                cursor: 'pointer', 
                                marginTop: '0.5rem',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                            >
                              {expandedCategories.deepvue_vcp ? (
                                <><ChevronUp size={16} /> Fold Up</>
                              ) : (
                                <><ChevronDown size={16} /> View {Math.min(20, deepvueData.active_vcp.length)} / {deepvueData.active_vcp.length} VCP Setups</>
                              )}
                            </button>
                          )}
                        </div>"""

if "deepvueData.active_vcp.length > 5" not in content:
    content = content.replace(old_vcp_end, new_vcp_end)

with open('/Users/amitkumar/Desktop/SectorTrackerApp/src/App.jsx', 'w') as f:
    f.write(content)
