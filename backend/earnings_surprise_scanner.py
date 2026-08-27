import yfinance as yf
import pandas as pd
import requests
import logging

def get_post_earnings_data(symbol):
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    # 1. Get Earnings Trend (Revisions) via Yahoo JSON API
    url = f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}?modules=earningsTrend"
    try:
        res = requests.get(url, headers=headers, timeout=5).json()
        trends = res['quoteSummary']['result'][0]['earningsTrend']['trend']
        current_qtr = trends[0] 
        
        up_revisions = current_qtr['earningsEstimate'].get('upLast30days', 0)
        down_revisions = current_qtr['earningsEstimate'].get('downLast30days', 0)
        total_analysts = current_qtr['earningsEstimate'].get('numberOfAnalysts', {}).get('fmt', 0)
    except Exception as e:
        up_revisions, down_revisions, total_analysts = 0, 0, 1
        
    # 2. Get Earnings Surprise via yfinance
    ticker = yf.Ticker(symbol)
    try:
        earnings_dates = ticker.get_earnings_dates(limit=5)
        if earnings_dates is not None and not earnings_dates.empty:
            ed_valid = earnings_dates.dropna(subset=['Surprise(%)'])
            if not ed_valid.empty:
                eps_surprise_pct = ed_valid.iloc[0]['Surprise(%)']
            else:
                eps_surprise_pct = 0.0
        else:
            eps_surprise_pct = 0.0
    except Exception:
        eps_surprise_pct = 0.0
        
    return {
        "EPS_Surprise_Pct": eps_surprise_pct,
        "Up_Revisions_30d": up_revisions,
        "Down_Revisions_30d": down_revisions,
        "Total_Analysts": int(total_analysts) if total_analysts else 1
    }

def evaluate_earnings_surprise(ticker):
    """
    Evaluates a stock for Post-Earnings Drift Potential (PEDP).
    Uses EPS Surprise % and exact analyst revisions from Yahoo API.
    Returns a dictionary if the score exceeds the threshold, else None.
    """
    try:
        data = get_post_earnings_data(ticker)
        
        # Cap surprise at +/- 50% for normalization
        eps_score_capped = max(min(data['EPS_Surprise_Pct'], 0.50), -0.50) / 0.50
        
        # Calculate Net Revision Ratio (-1.0 to 1.0)
        total_revisions = data['Up_Revisions_30d'] + data['Down_Revisions_30d']
        if total_revisions > 0:
            revision_ratio = (data['Up_Revisions_30d'] - data['Down_Revisions_30d']) / total_revisions
        else:
            revision_ratio = 0.0
            
        # Simplified Score out of 100 (60% Surprise, 40% Revisions)
        score = (0.60 * eps_score_capped * 100) + (0.40 * revision_ratio * 100)
        score = round(score, 2)
        
        # Determine if it's a valid setup (Score > 60)
        if score >= 60:
            return {
                "status": "TRIGGERED",
                "ticker": ticker,
                "score": score,
                "eps_surprise_pct": round(data['EPS_Surprise_Pct'] * 100, 2),
                "upgrades_30d": data['Up_Revisions_30d'],
                "downgrades_30d": data['Down_Revisions_30d']
            }
            
        return None
        
    except Exception as e:
        logging.error(f"[Earnings Surprise Scanner] Error analyzing {ticker}: {e}")
        return None

if __name__ == "__main__":
    for sym in ["NVDA", "AAPL", "RDDT"]:
        res = evaluate_earnings_surprise(sym)
        print(f"{sym}: {res}")
