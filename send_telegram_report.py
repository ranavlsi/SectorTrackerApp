import os
import json
import urllib.request
import urllib.parse
import sys
from dotenv import load_dotenv

# Load environment variables from .env
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
load_dotenv(env_path)

TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')

import requests
import time

def send_telegram_alert(message):
    """Sends a formatted markdown alert to Telegram if credentials exist."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID or TELEGRAM_BOT_TOKEN == "PUT_YOUR_BOT_TOKEN_HERE":
        print("Error: Telegram credentials not configured properly.")
        return False
        
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message
    }
    
    while True:
        try:
            response = requests.post(url, json=payload, timeout=10)
            if response.status_code == 200:
                print("Telegram alert sent successfully!")
                return True
            elif response.status_code == 429:
                retry_after = response.json().get("parameters", {}).get("retry_after", 5)
                print(f"Rate limited by Telegram. Waiting {retry_after} seconds before retrying...")
                time.sleep(retry_after + 1)
            else:
                print(f"Telegram returned status code: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"Telegram failed: {e}")
            time.sleep(5)

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
