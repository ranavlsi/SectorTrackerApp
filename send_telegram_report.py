import os
import json
import urllib.request
import urllib.parse
import sys
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')

def send_telegram_alert(message):
    """Sends a formatted markdown alert to Telegram if credentials exist."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID or TELEGRAM_BOT_TOKEN == "PUT_YOUR_BOT_TOKEN_HERE":
        print("Error: Telegram credentials not configured properly.")
        return False
        
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        data = json.dumps({
            "chat_id": TELEGRAM_CHAT_ID,
            "text": message
        }).encode('utf-8')
        
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                print("Telegram alert sent successfully!")
                return True
            else:
                print(f"Telegram returned status code: {response.status}")
                return False
    except Exception as e:
        print(f"Telegram failed: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 send_telegram_report.py <path_to_markdown_file>")
        sys.exit(1)
        
    filepath = sys.argv[1]
    
    if not os.path.exists(filepath):
        print(f"Error: File '{filepath}' not found.")
        sys.exit(1)
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Telegram messages are limited to 4096 characters
    if len(content) > 4000:
        content = content[:4000] + "\n...[Truncated]"
        
    success = send_telegram_alert(content)
    if not success:
        sys.exit(1)
