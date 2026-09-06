import re

with open('/Users/amitkumar/Desktop/SectorTrackerApp/src/App.jsx', 'r') as f:
    content = f.read()

# Replace getMultiTimeframeSummary
with open('/Users/amitkumar/Desktop/SectorTrackerApp/backend/inject_multi_rrg.js', 'r') as f:
    new_logic = f.read()

content = re.sub(
    r"  const getQuadrant = \(x, y\) => \{.*?    return playbooks;\n  \};\n",
    new_logic,
    content,
    flags=re.DOTALL
)

# Replace the UI block
with open('/Users/amitkumar/Desktop/SectorTrackerApp/backend/inject_ui.js', 'r') as f:
    new_ui = f.read()

content = re.sub(
    r"          \{\/\* Multi-Timeframe Trade Playbook \*\/.*?          <\/div>\n",
    new_ui,
    content,
    flags=re.DOTALL
)

with open('/Users/amitkumar/Desktop/SectorTrackerApp/src/App.jsx', 'w') as f:
    f.write(content)

