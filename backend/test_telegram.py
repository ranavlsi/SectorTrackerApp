import requests
import os
from dotenv import load_dotenv

load_dotenv('/Users/amitkumar/Desktop/SectorTrackerApp/.env')
token = os.getenv('TELEGRAM_BOT_TOKEN')
chat_id = os.getenv('TELEGRAM_CHAT_ID')

print(f"Token length: {len(str(token))}, Chat ID: {chat_id}")
url = f"https://api.telegram.org/bot{token}/sendMessage"

payload = {
    "chat_id": chat_id,
    "text": "*TESTING 1 2 3*\n\n🚨 AAPL: 5m 10/20 SMA Crossover",
    "parse_mode": "Markdown"
}

try:
    res = requests.post(url, json=payload, timeout=15)
    print(f"Status: {res.status_code}")
    print(f"Response: {res.text}")
except Exception as e:
    print(f"Exception: {e}")
