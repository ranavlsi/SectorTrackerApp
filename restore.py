import json
import os

log_file = '/Users/amitkumar/.gemini/antigravity/brain/e1ee4a1a-5710-4329-a4e2-4328edeaa2bc/.system_generated/logs/transcript.jsonl'

with open(log_file, 'r') as f:
    lines = f.readlines()

latest_app_content = None

for line in lines:
    try:
        step = json.loads(line)
        if 'tool_calls' in step:
            for call in step['tool_calls']:
                if call['function']['name'] == 'default_api:write_to_file':
                    args = json.loads(call['function']['arguments'])
                    if 'App.jsx' in args.get('TargetFile', ''):
                        latest_app_content = args.get('CodeContent')
                # If we used multi_replace or replace, we might not have the full file.
                # But we definitely did a write_to_file during the overhaul!
    except Exception as e:
        pass

if latest_app_content:
    with open('/Users/amitkumar/Desktop/SectorTrackerApp/src/App.jsx.backup', 'w') as f:
        f.write(latest_app_content)
    print("Found and restored full App.jsx to App.jsx.backup!")
else:
    print("Could not find a full write_to_file for App.jsx in the logs.")
