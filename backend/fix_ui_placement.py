import re

with open('/Users/amitkumar/Desktop/SectorTrackerApp/src/App.jsx', 'r') as f:
    content = f.read()

# Delete the currently injected UI block entirely
content = re.sub(
    r"          \{\/\* Multi-Timeframe Trade Playbook \*\/.*?          <\/div>\n",
    "",
    content,
    flags=re.DOTALL
)

# Read the correct UI block
with open('/Users/amitkumar/Desktop/SectorTrackerApp/backend/inject_ui.js', 'r') as f:
    new_ui = f.read()

# Inject it right before {/* Automated Money Flow Summary */}
content = content.replace("          {/* Automated Money Flow Summary */}", new_ui + "\n          {/* Automated Money Flow Summary */}")

with open('/Users/amitkumar/Desktop/SectorTrackerApp/src/App.jsx', 'w') as f:
    f.write(content)
