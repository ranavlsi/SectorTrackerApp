import os
from dotenv import load_dotenv
import requests

load_dotenv('/Users/amitkumar/Desktop/SectorTrackerApp/.env')
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')

setup = """
*1. GME (+15.0%)* @ $25.00
• *PMH:* 26.00 | *PML:* 24.00
• *Gap Fill Target:* $21.74
• *Float:* 300M | *Short:* 20%
• *Social Sentiment:* BULLISH (80% Bullish)
• *Unusual Options:* No unusual options detected
• *News:* Earnings
• *Trade Plan:* Watch for Opening Range Breakout (ORB) above PMH (26.00) with volume. Buy the breakout for a long continuation. Use PML (24.00) or VWAP as a stop loss.
"""

msg = f"*🌅 PREMARKET BRIEFING*\n\n🚨 MARKET: {setup}"

url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
res = requests.post(url, json={
    "chat_id": TELEGRAM_CHAT_ID,
    "text": msg,
    "parse_mode": "Markdown"
}, timeout=5)

print(f"Status Code: {res.status_code}")
print(f"Response: {res.text}")

