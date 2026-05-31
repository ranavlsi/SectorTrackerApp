import pandas as pd
import requests
from io import StringIO

def fetch_yahoo_screener(url):
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        req = requests.get(url, headers=headers, timeout=10)
        dfs = pd.read_html(StringIO(req.text))
        if dfs:
            raw_symbols = dfs[0]['Symbol'].tolist()
            # Yahoo formats them weirdly sometimes like "R RDW"
            clean_symbols = [str(s).split()[-1] for s in raw_symbols if pd.notna(s)]
            return clean_symbols
    except Exception as e:
        print(f"Failed to scrape {url}: {e}")
    return []

def get_dynamic_universe():
    urls = [
        'https://finance.yahoo.com/screener/predefined/day_gainers',
        'https://finance.yahoo.com/screener/predefined/most_actives'
    ]
    dynamic_tickers = set()
    for url in urls:
        dynamic_tickers.update(fetch_yahoo_screener(url))
        
    return list(dynamic_tickers)

if __name__ == "__main__":
    universe = get_dynamic_universe()
    print(f"Found {len(universe)} dynamic tickers: {universe}")
