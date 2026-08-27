import os
import requests
from dotenv import load_dotenv

load_dotenv('/Users/amitkumar/Desktop/SectorTrackerApp/.env')
token = os.getenv('TELEGRAM_BOT_TOKEN')

url = f"https://api.telegram.org/bot{token}/getMe"
res = requests.get(url)
print(f"getMe Status: {res.status_code}")
print(f"getMe Response: {res.text}")
