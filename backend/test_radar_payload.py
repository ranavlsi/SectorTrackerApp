import requests
import os
from dotenv import load_dotenv

load_dotenv('/Users/amitkumar/Desktop/SectorTrackerApp/.env')
token = os.getenv('TELEGRAM_BOT_TOKEN')
chat_id = os.getenv('TELEGRAM_CHAT_ID')

msg = """*📡 INTRADAY RADAR SWEEP*

🚨 MARKET: *Top Actionable Breakouts:*
1. NVDA (Vol: 2.5x) - Price: $120.50
2. BRK-B (Vol: 1.8x) - Price: $400.20
3. TSLA (Vol: 1.5x) - Price: $175.00"""

url = f"https://api.telegram.org/bot{token}/sendMessage"
res = requests.post(url, json={
    "chat_id": chat_id,
    "text": msg,
    "parse_mode": "Markdown"
})
print(f"Status: {res.status_code}")
print(f"Response: {res.text}")
