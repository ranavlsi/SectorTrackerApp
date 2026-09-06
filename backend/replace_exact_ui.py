with open('/Users/amitkumar/Desktop/SectorTrackerApp/src/App.jsx', 'r') as f:
    content = f.read()

# First, remove the misplaced UI block using string replacement (not regex).
with open('/Users/amitkumar/Desktop/SectorTrackerApp/backend/inject_ui.js', 'r') as f:
    ui_block = f.read()

content = content.replace(ui_block, "")

# Then, inject it where it belongs.
content = content.replace("          {/* Automated Money Flow Summary */}", ui_block + "\n          {/* Automated Money Flow Summary */}")

with open('/Users/amitkumar/Desktop/SectorTrackerApp/src/App.jsx', 'w') as f:
    f.write(content)
