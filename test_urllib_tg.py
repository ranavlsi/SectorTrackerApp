import urllib.request
import urllib.error
import json
import os
from dotenv import load_dotenv

load_dotenv('/Users/amitkumar/Desktop/SectorTrackerApp/.env')
token = os.getenv('TELEGRAM_BOT_TOKEN')
chat_id = os.getenv('TELEGRAM_CHAT_ID')

url = f"https://api.telegram.org/bot{token}/sendMessage"
data = json.dumps({"chat_id": chat_id, "text": "test urllib"}).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})

try:
    with urllib.request.urlopen(req) as response:
        print("Success")
except urllib.error.HTTPError as e:
    print(f"Error Code: {e.code}")
    body = e.read().decode()
    print(f"Body: {body}")
