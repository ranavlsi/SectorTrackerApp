import json
import logging
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
import os
from typing import Dict, Any

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "YOUR_TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "YOUR_TELEGRAM_CHAT_ID")

try:
    import yfinance as yf
except ImportError:
    yf = None

logger = logging.getLogger(__name__)

def fetch_reddit_data(ticker: str) -> list:
    reddit_titles = []
    try:
        url = f'https://www.reddit.com/r/wallstreetbets/search.json?q={ticker}&restrict_sr=1&sort=new'
        # Reddit blocks generic browser agents. Using a custom descriptive agent compliant with their API rules.
        custom_user_agent = 'macos:sector_tracker_app:v1.0 (by /u/anonymous_trader)'
        req = urllib.request.Request(url, headers={'User-Agent': custom_user_agent})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            for child in data.get('data', {}).get('children', []):
                reddit_titles.append(child.get('data', {}).get('title', ''))
    except urllib.error.HTTPError as e:
        if e.code not in (403, 429):
            logger.error(f"Failed to fetch Reddit data for {ticker}: {e}")
    except Exception as e:
        if "403" not in str(e) and "429" not in str(e):
            logger.error(f"Failed to fetch Reddit data for {ticker}: {e}")
    return reddit_titles[:15]

def fetch_stocktwits_data(ticker: str) -> list:
    stocktwits_messages = []
    try:
        url = f'https://api.stocktwits.com/api/2/streams/symbol/{ticker}.json'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            for msg in data.get('messages', []):
                stocktwits_messages.append(msg.get('body', ''))
    except Exception as e:
        logger.error(f"Failed to fetch Stocktwits data for {ticker}: {e}")
    return stocktwits_messages[:15]

def fetch_unusual_options(ticker: str) -> list:
    unusual_options = []
    try:
        import pandas as pd
        from yahooquery import Ticker as YQTicker
        stock = YQTicker(ticker)
        chain_df = stock.option_chain
        
        if not isinstance(chain_df, pd.DataFrame) or chain_df.empty:
            return unusual_options
            
        chain_df = chain_df.reset_index()
        expirations = chain_df['expiration'].unique()
        if len(expirations) == 0: return unusual_options
        
        nearest_exp = sorted(expirations)[0]
        options_df = chain_df[chain_df['expiration'] == nearest_exp]
        
        for index, row in options_df.iterrows():
            vol = row.get('volume', 0)
            oi = row.get('openInterest', 0)
            strike = row.get('strike', 0)
            
            if pd.isna(vol) or pd.isna(oi):
                continue
                
            vol = float(vol)
            oi = float(oi)
            
            if oi > 0:
                ratio = vol / oi
                if ratio > 2.0 and vol > 100:
                    unusual_options.append({
                        'strike': float(strike),
                        'vol': int(vol),
                        'oi': int(oi),
                        'ratio': round(ratio, 2)
                    })
    except Exception as e:
        logger.error(f"Failed to fetch unusual options for {ticker}: {e}")
        
    return unusual_options

def fetch_x_data(ticker: str) -> list:
    x_updates = []
    try:
        url = f'https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            xml_data = response.read()
            root = ET.fromstring(xml_data)
            for item in root.findall('./channel/item'):
                title = item.find('title')
                if title is not None and title.text:
                    x_updates.append(title.text)
    except Exception as e:
        logger.error(f"Failed to fetch X.com proxy data for {ticker}: {e}")
    return x_updates[:10]

def broadcast_telegram_alert(ticker: str, synthesis: str):
    message = f"🚨 AI AGENT ALERT: {ticker} 🚨\n\n{synthesis}"
    
    # 1. Send to Telegram
    if TELEGRAM_BOT_TOKEN != "YOUR_TELEGRAM_BOT_TOKEN":
        try:
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
            data = json.dumps({"chat_id": TELEGRAM_CHAT_ID, "text": message}).encode('utf-8')
            req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=5) as response:
                pass
        except Exception as e:
            logger.error(f"Failed to send Telegram alert: {e}")
            
    # 2. Write to local Live Market Updates
    try:
        file_dir = os.path.dirname(os.path.abspath(__file__))
        alerts_path = os.path.join(file_dir, '..', 'public', 'alerts.json')
        
        alerts = []
        if os.path.exists(alerts_path):
            with open(alerts_path, 'r') as f:
                try:
                    alerts = json.load(f)
                except:
                    pass
        
        import datetime
        timestamp = datetime.datetime.now().isoformat()
        alerts.insert(0, {"ticker": ticker, "message": synthesis, "timestamp": timestamp})
        alerts = alerts[:50] # Keep last 50
        
        # Ensure public directory exists
        os.makedirs(os.path.dirname(alerts_path), exist_ok=True)
        with open(alerts_path, 'w') as f:
            json.dump(alerts, f)
    except Exception as e:
        logger.error(f"Failed to write to local alerts.json: {e}")

def get_market_agents_data(ticker: str) -> Dict[str, Any]:
    """
    Fetches market agents data (Reddit, Stocktwits, and unusual options).
    """
    reddit_data = fetch_reddit_data(ticker)
    stocktwits_data = fetch_stocktwits_data(ticker)
    options_data = fetch_unusual_options(ticker)
    x_updates = fetch_x_data(ticker)
    
    # Synthesis vibe
    vibe_score = len(reddit_data) + len(stocktwits_data) + (len(options_data) * 2)
    if vibe_score > 500:
        synthesis = f"High chatter and activity detected for {ticker}. "
    elif vibe_score > 5:
        synthesis = f"Moderate activity detected for {ticker}. "
    else:
        synthesis = f"Low activity detected for {ticker}. "
        
    synthesis += f"Found {len(reddit_data)} Reddit posts, {len(stocktwits_data)} StockTwits messages, and {len(options_data)} unusual options trades."
    
    if vibe_score > 500:
        # Trigger live market alert and Telegram push
        broadcast_telegram_alert(ticker, synthesis)
        
    # Calculate Surge Metrics
    all_text = " ".join(reddit_data + stocktwits_data + x_updates).lower()
    bullish_words = ['buy', 'bull', 'call', 'moon', 'long', 'undervalued', 'hold', 'up']
    bearish_words = ['sell', 'bear', 'put', 'short', 'overvalued', 'drop', 'dump', 'down']
    
    bull_count = sum(all_text.count(w) for w in bullish_words)
    bear_count = sum(all_text.count(w) for w in bearish_words)
    total_sentiment_words = bull_count + bear_count
    
    bullish_percent = int((bull_count / total_sentiment_words) * 100) if total_sentiment_words > 0 else 50
    sentiment_label = 'bullish' if bullish_percent > 55 else ('bearish' if bullish_percent < 45 else 'neutral')
    
    surge_level = min(int((vibe_score / 40.0) * 100), 100)
    
    surge_metrics = {
        'surge_level': surge_level,
        'bullish_percent': bullish_percent,
        'sentiment_label': sentiment_label
    }
    
    return {
        'reddit': reddit_data,
        'stocktwits': stocktwits_data,
        'unusual_options': options_data,
        'x_updates': x_updates,
        'synthesis': synthesis,
        'surge_metrics': surge_metrics
    }
