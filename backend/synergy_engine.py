import yfinance as yf
import pandas as pd
import requests
import random
import time
from io import StringIO
from datetime import datetime

def extract_finviz_table(html):
    try:
        dfs = pd.read_html(StringIO(html))
        valid_dfs = [d for d in dfs if 'Ticker' in d.columns and len(d) > 0]
        if valid_dfs:
            return valid_dfs[-1]
    except:
        pass
    return None

def detect_synergies():
    """
    Detects synergistic confluence between Dark Pool block trades (proxied by Unusual Volume)
    and Options Flow (Gamma/Sweep urgency).
    """
    alerts = []
    try:
        url = 'https://finviz.com/screener.ashx?v=111&s=ta_unusualvolume&o=-volume'
        headers = {'User-Agent': 'Mozilla/5.0'}
        res = requests.get(url, headers=headers)
        df = extract_finviz_table(res.text)
        
        if df is None or len(df) == 0:
            return []
            
        # Clean price column
        df['PriceNum'] = pd.to_numeric(df['Price'], errors='coerce')
        # Filter for mid/large caps to avoid penny stock noise
        df = df[df['PriceNum'] >= 5.0]
        
        # Take the top 5 to prevent yfinance rate limits
        tickers = df['Ticker'].head(5).tolist()
        
        for ticker in tickers:
            try:
                # Add delay to prevent yfinance rate limit bans
                time.sleep(2)
                
                t = yf.Ticker(ticker)
                spot_price = float(t.fast_info.get('lastPrice', 0))
                if pd.isna(spot_price) or spot_price == 0: continue
                
                # Calculate intraday VWAP as proxy for the Dark Pool block level
                hist = t.history(period="1d", interval="5m")
                hist = hist.dropna(subset=['Close', 'Volume'])
                if hist.empty or hist['Volume'].sum() == 0: continue
                
                vwap = (hist['Close'] * hist['Volume']).sum() / hist['Volume'].sum()
                if pd.isna(vwap): continue
                
                options = t.options
                if not options: continue
                
                chain = t.option_chain(options[0])
                calls = chain.calls
                puts = chain.puts
                
                # Filter to near-the-money options to gauge immediate urgency
                near_calls = calls[(calls['strike'] >= spot_price * 0.9) & (calls['strike'] <= spot_price * 1.1)]
                near_puts = puts[(puts['strike'] >= spot_price * 0.9) & (puts['strike'] <= spot_price * 1.1)]
                
                call_vol = near_calls['volume'].sum()
                put_vol = near_puts['volume'].sum()
                
                if pd.isna(call_vol): call_vol = 0
                if pd.isna(put_vol): put_vol = 0
                
                # Require substantial volume to trigger an alert
                if call_vol + put_vol < 100:
                    continue
                    
                is_above_vwap = spot_price > vwap
                cp_ratio = call_vol / put_vol if put_vol > 0 else call_vol
                pc_ratio = put_vol / call_vol if call_vol > 0 else put_vol
                
                if is_above_vwap and cp_ratio > 1.5:
                    alerts.append({
                        "id": str(random.randint(1000, 9999)),
                        "council": "📈 SYNERGY: LIFTOFF",
                        "ticker": ticker,
                        "price": round(spot_price, 2),
                        "setup": f"Bullish Synergy: Trading ABOVE Dark Pool Level (${vwap:.2f}) + Heavy Calls ({cp_ratio:.1f}x Puts)",
                        "color": "#10b981", # Green
                        "timestamp": datetime.now().strftime("%I:%M:%S %p")
                    })
                elif not is_above_vwap and pc_ratio > 1.5:
                    alerts.append({
                        "id": str(random.randint(1000, 9999)),
                        "council": "📉 SYNERGY: RUG PULL",
                        "ticker": ticker,
                        "price": round(spot_price, 2),
                        "setup": f"Bearish Synergy: Trading BELOW Dark Pool Level (${vwap:.2f}) + Heavy Puts ({pc_ratio:.1f}x Calls)",
                        "color": "#ef4444", # Red
                        "timestamp": datetime.now().strftime("%I:%M:%S %p")
                    })
                elif is_above_vwap and pc_ratio > 2.0:
                    alerts.append({
                        "id": str(random.randint(1000, 9999)),
                        "council": "🛡️ SYNERGY: HEDGE",
                        "ticker": ticker,
                        "price": round(spot_price, 2),
                        "setup": f"Protected Long: Holding Dark Pool Support (${vwap:.2f}) but loading Puts ({pc_ratio:.1f}x Calls)",
                        "color": "#f59e0b", # Yellow/Orange
                        "timestamp": datetime.now().strftime("%I:%M:%S %p")
                    })
            except Exception as e:
                pass
                
    except Exception as e:
        print(f"Error fetching unusual volume: {e}")
        
    return alerts
