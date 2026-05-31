import requests
import re
from bs4 import BeautifulSoup
import json
import os
import time
from screener_engine import run_screener

# Path to store the user's tradingview watchlist URL
TV_URL_FILE = os.path.join(os.path.dirname(__file__), '..', 'public', 'tv_watchlist_url.json')
TV_RESULTS_FILE = os.path.join(os.path.dirname(__file__), '..', 'public', 'tv_watchlist_results.json')

def save_watchlist_url(url):
    with open(TV_URL_FILE, 'w') as f:
        json.dump({"url": url}, f)

def get_watchlist_url():
    if os.path.exists(TV_URL_FILE):
        with open(TV_URL_FILE, 'r') as f:
            data = json.load(f)
            return data.get("url", "")
    return ""

def scrape_tradingview_watchlist(url):
    """
    Scrapes a public TradingView watchlist URL and extracts all ticker symbols.
    Uses regex to find /symbols/EXCHANGE-TICKER/ links which is TradingView's standard URL schema.
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    
    print(f"[TradingView Agent] Fetching URL: {url}")
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
    except Exception as e:
        print(f"[TradingView Agent] Failed to fetch URL: {e}")
        return []

    soup = BeautifulSoup(response.text, 'html.parser')
    tickers = set()
    
    # Find all links on the page. Watchlists always link to individual symbol pages.
    # e.g., <a href="/symbols/NASDAQ-AAPL/">AAPL</a>
    for a in soup.find_all('a', href=True):
        href = a['href']
        # Match pattern /symbols/EXCHANGE-TICKER/
        match = re.search(r'/symbols/([A-Z0-9]+-[A-Z0-9]+)/', href, re.IGNORECASE)
        if match:
            exchange_ticker = match.group(1).upper()
            if '-' in exchange_ticker:
                ticker = exchange_ticker.split('-')[1]
                tickers.add(ticker)
                
    # Also attempt to parse embedded JSON data if TradingView renders it via React state
    script_tags = soup.find_all('script')
    for script in script_tags:
        if script.string and 'WatchlistWidget' in script.string:
            # Fallback regex to find "pro_name": "NASDAQ:AAPL"
            matches = re.findall(r'"pro_name"\s*:\s*"([A-Z0-9]+):([A-Z0-9]+)"', script.string)
            for exchange, ticker in matches:
                tickers.add(ticker)
                
    result = list(tickers)
    print(f"[TradingView Agent] Successfully extracted {len(result)} tickers: {result}")
    return result

def run_tradingview_sync():
    """
    Called by the background thread to periodically scrape the URL and run quant scans.
    Also checks for exported .txt files dropped in the Desktop/TradingView_Watchlists folder.
    """
    import glob
    import re
    
    tickers = set()
    
    # 1. Read from Desktop Drop Folder
    desktop_folder = "/Users/amitkumar/Desktop/TradingView_Watchlists"
    txt_files = glob.glob(os.path.join(desktop_folder, "*.txt"))
    for file_path in txt_files:
        try:
            with open(file_path, 'r') as f:
                content = f.read()
                # TradingView txt exports are usually comma-separated: NASDAQ:AAPL,NYSE:TSLA
                # Or newline separated. We split by comma or newline.
                tokens = re.split(r'[,\n\s]+', content)
                for token in tokens:
                    token = token.strip()
                    if not token: continue
                    # Extract the actual ticker (e.g., NASDAQ:AAPL -> AAPL)
                    ticker_part = token.split(':')[-1].upper()
                    # Filter out header words, usually tickers are 1-5 chars and only uppercase letters
                    if 1 <= len(ticker_part) <= 5 and ticker_part.isalpha():
                        tickers.add(ticker_part)
        except Exception as e:
            print(f"[TradingView Agent] Failed to read {file_path}: {e}")
            
    # 2. Read from UI Config (URL or pasted list)
    url_or_list = get_watchlist_url()
    if url_or_list:
        print(f"[TradingView Agent] Syncing UI config: {url_or_list[:50]}...")
        if not url_or_list.startswith('http'):
            ui_tickers = [t.upper() for t in re.findall(r'[A-Za-z]+', url_or_list)]
            tickers.update(ui_tickers)
        else:
            scraped = scrape_tradingview_watchlist(url_or_list)
            tickers.update(scraped)
            
    tickers = list(tickers)
        
    if not tickers:
        print("[TradingView Agent] No tickers found in Desktop folder or UI. Skipping scan.")
        return
        
    # Run the massive quant screener purely on these specific tickers!
    print(f"[TradingView Agent] Initiating Deep Quant Scan on {len(tickers)} TV tickers...")
    
    # We reuse the `run_screener` but pass ONLY our TV tickers.
    results = run_screener(custom_universe=tickers)
    
    # Flatten categorized results into a single list of unified alerts
    flattened_alerts = []
    category_map = {
        "vwap_breakout": {"type": "VWAP Trend Break", "priority": "High"},
        "darkpool_hvn": {"type": "Dark Pool Rejection", "priority": "High"},
        "put_call_spike": {"type": "Options Flow Spike", "priority": "High"},
        "orb_failed": {"type": "ORB Failure", "priority": "Medium"},
        "zacks_rank_1": {"type": "Zacks Rank 1", "priority": "Medium"},
        "pending_breakout": {"type": "Pending Breakout", "priority": "High"}
    }
    
    if results:
        for cat, items in results.items():
            for item in items:
                mapped = category_map.get(cat, {"type": cat.replace("_", " ").title(), "priority": "Medium"})
                flattened_alerts.append({
                    "ticker": item["ticker"],
                    "type": mapped["type"],
                    "priority": mapped["priority"],
                    "reason": str(item.get("metric", ""))
                })
                
    # Save results specifically for the TV Watchlist Tab
    with open(TV_RESULTS_FILE, 'w') as f:
        json.dump({"last_updated": time.time(), "tickers": tickers, "alerts": flattened_alerts}, f)
        
    print("[TradingView Agent] Sync complete. Results saved to public/tv_watchlist_results.json")

if __name__ == "__main__":
    # Test script locally
    test_url = get_watchlist_url()
    if test_url:
        run_tradingview_sync()
    else:
        print("No URL configured in tv_watchlist_url.json")
