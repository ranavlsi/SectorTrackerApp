import yfinance as yf
import pandas as pd
from finvizfinance.quote import finvizfinance
import json

def get_peer_valuation(target_ticker):
    """
    Finds sector peers using finvizfinance and compares key valuation multiples.
    """
    try:
        from finvizfinance.quote import finvizfinance
        from finvizfinance.screener.overview import Overview
        
        peers = []
        try:
            # 1. Get exact Industry of the target stock
            stock = finvizfinance(target_ticker.upper())
            fund = stock.ticker_fundament()
            industry = fund.get('Industry')
            
            if industry:
                # 2. Screen for peers in the exact same industry
                screener = Overview()
                screener.set_filter(filters_dict={'Industry': industry})
                df = screener.screener_view()
                
                # Sort by Market Cap closest to the target stock's market cap
                def parse_cap(val):
                    if not isinstance(val, str): return 0
                    val = val.replace(',', '')
                    if 'B' in val: return float(val.replace('B', '')) * 1e9
                    if 'M' in val: return float(val.replace('M', '')) * 1e6
                    if 'K' in val: return float(val.replace('K', '')) * 1e3
                    try: return float(val)
                    except: return 0
                    
                target_cap_str = fund.get('Market Cap')
                target_cap = parse_cap(target_cap_str) if target_cap_str else 0
                    
                if 'Market Cap' in df.columns:
                    df['cap_val'] = df['Market Cap'].apply(parse_cap)
                    if target_cap > 0:
                        df['cap_diff'] = abs(df['cap_val'] - target_cap)
                        df = df.sort_values(by='cap_diff', ascending=True)
                    else:
                        df = df.sort_values(by='cap_val', ascending=False)
                    
                found_peers = df['Ticker'].tolist()
                peers = [p for p in found_peers if p != target_ticker.upper()][:5]
        except Exception as e:
            pass
            
        if not peers:
            # Fallback peer map just in case
            peer_map = {
                "AAPL": ["MSFT", "GOOGL", "META", "AMZN"],
                "MSFT": ["AAPL", "GOOGL", "META", "AMZN"],
                "NVDA": ["AMD", "INTC", "QCOM", "AVGO", "SMCI"],
                "TSLA": ["F", "GM", "RIVN", "LCID"],
                "JPM": ["BAC", "WFC", "C", "GS"],
                "JNJ": ["PFE", "MRK", "ABBV", "LLY"]
            }
            peers = peer_map.get(target_ticker.upper(), ["SPY", "QQQ"])
        
        all_tickers = [target_ticker.upper()] + peers
        
        data = []
        for ticker in all_tickers:
            try:
                info = yf.Ticker(ticker).info
                if not info: continue
                
                mc = info.get('marketCap', 0)
                data.append({
                    'Ticker': ticker,
                    'Market Cap': f"${mc / 1e9:.1f}B" if mc else "N/A",
                    'EV/EBITDA': round(info.get('enterpriseToEbitda', 0), 2) or "N/A",
                    'Forward P/E': round(info.get('forwardPE', 0), 2) or "N/A",
                    'Price/Sales': round(info.get('priceToSalesTrailing12Months', 0), 2) or "N/A",
                    'Price/Book': round(info.get('priceToBook', 0), 2) or "N/A"
                })
            except Exception as e:
                pass
                
        return {
            "ticker": target_ticker,
            "valuation": data
        }
        
    except Exception as e:
        print(f"Error in peer_valuation_api for {target_ticker}: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    import sys
    ticker = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
    print(json.dumps(get_peer_valuation(ticker), indent=2))
