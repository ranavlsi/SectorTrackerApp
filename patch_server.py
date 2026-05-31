import os
import re

server_path = 'server.py'
backend_path = 'backend/server.py'

with open(server_path, 'r') as f:
    old_content = f.read()

# Extract pieces using regex or simple string splitting
# 1. send_telegram_alert
send_telegram_block = re.search(r'(TELEGRAM_BOT_TOKEN = .*?warnings\.filterwarnings\(\'ignore\'\)\n)', old_content, re.DOTALL).group(1)

# 2. The whole block of background workers and stream
councils_block = re.search(r'(nyse_holidays = holidays\.NYSE\(\).*?if __name__ == \'__main__\':)', old_content, re.DOTALL).group(1)

# Now, read backend/server.py
with open(backend_path, 'r') as f:
    backend_content = f.read()

# We want to inject send_telegram_alert, then the councils_block, just before def background_agent_worker():
injection = f"\n# --- LEGACY COUNCILS PORTED ---\n{send_telegram_block}\n{councils_block}\n# --- END LEGACY COUNCILS ---\n\n"

# Replace background_agent_worker to also push to alert_queue
# In backend/server.py, we have `broadcast_telegram_alert(ticker, alert_msg)` calls. We will replace them with a function that pushes to both!

new_backend_content = backend_content.replace('def background_agent_worker():', injection + 'def background_agent_worker():')

# Replace the threading lines at the bottom of backend/server.py
threading_injection = """
    threading.Thread(target=background_agent_worker, daemon=True).start()
    threading.Thread(target=technical_council_worker, daemon=True).start()
    threading.Thread(target=insider_council_worker, daemon=True).start()
    threading.Thread(target=darkpool_council_worker, daemon=True).start()
    threading.Thread(target=premarket_council_worker, daemon=True).start()
"""

new_backend_content = re.sub(
    r'daemon_thread = threading\.Thread\(target=background_agent_worker, daemon=True\)\n\s+daemon_thread\.start\(\)',
    threading_injection.strip(),
    new_backend_content
)

# Patch broadcast_telegram_alert inside backend/server.py to also enqueue
# We'll just define a custom broadcast inside backend/server.py that intercepts it
custom_broadcast = """
def custom_broadcast_and_queue(ticker, msg):
    broadcast_telegram_alert(ticker, msg)
    alert = {
        "id": "LIVE_" + str(random.randint(1000, 9999)),
        "council": "📡 LIVE SCANNER",
        "ticker": ticker,
        "setup": msg,
        "color": "#10b981",
        "timestamp": datetime.now().strftime("%I:%M:%S %p")
    }
    alert_queue.put(alert)
"""

new_backend_content = new_backend_content.replace('def background_agent_worker():', custom_broadcast + '\n\ndef background_agent_worker():')
new_backend_content = new_backend_content.replace('broadcast_telegram_alert(ticker, alert_msg)', 'custom_broadcast_and_queue(ticker, alert_msg)')


with open(backend_path, 'w') as f:
    f.write(new_backend_content)

print("Backend successfully patched!")
