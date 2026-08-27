import yfinance as yf
import pandas as pd

def get_style_score(metric, thresholds):
    # Helper to assign A,B,C,D,F based on metric and thresholds
    if metric is None: return 'C'
    if metric >= thresholds[0]: return 'A'
    if metric >= thresholds[1]: return 'B'
    if metric >= thresholds[2]: return 'C'
    if metric >= thresholds[3]: return 'D'
    return 'F'

PEER_BASKETS = {
    "Technology": ["MSFT", "AAPL", "ORCL", "CSCO"],
    "Semiconductors": ["NVDA", "AMD", "TSM", "AVGO", "INTC"],
    "Software - Infrastructure": ["MSFT", "ADBE", "ORCL"],
    "Software - Application": ["CRM", "NOW", "SNPS"],
    "Healthcare": ["LLY", "UNH", "JNJ", "ABBV"],
    "Financial Services": ["JPM", "BAC", "WFC", "MS"],
    "Consumer Cyclical": ["AMZN", "TSLA", "HD", "MCD"],
    "Energy": ["XOM", "CVX", "COP", "SLB"],
    "Industrials": ["CAT", "GE", "UNP", "HON"],
    "Communication Services": ["GOOGL", "META", "NFLX", "DIS"],
    "Basic Materials": ["LIN", "SHW", "FCX", "ECL"],
    "Consumer Defensive": ["WMT", "PG", "COST", "KO"]
}

def get_industry_benchmark(sector, industry):
    basket = PEER_BASKETS.get(industry, PEER_BASKETS.get(sector, ["SPY"]))
    
    total_pe, count_pe = 0, 0
    total_peg, count_peg = 0, 0
    total_ps, count_ps = 0, 0
    
    for sym in basket:
        try:
            t = yf.Ticker(sym)
            i = t.info
            pe = i.get('trailingPE')
            peg = i.get('pegRatio')
            ps = i.get('priceToSalesTrailing12Months')
            if pe: total_pe += pe; count_pe += 1
            if peg: total_peg += peg; count_peg += 1
            if ps: total_ps += ps; count_ps += 1
        except: pass
        
    return {
        "pe": round(total_pe / count_pe, 2) if count_pe > 0 else 20.0,
        "peg": round(total_peg / count_peg, 2) if count_peg > 0 else 1.5,
        "ps": round(total_ps / count_ps, 2) if count_ps > 0 else 2.0,
        "basket": basket
    }

def calculate_zacks_rank(revenue_growth, peg_ratio):
    if revenue_growth is None: revenue_growth = 0
    if peg_ratio is None: peg_ratio = 1.5
    
    if revenue_growth > 0.15 and peg_ratio < 1.5:
        return 1
    elif revenue_growth > 0.05 and peg_ratio < 2.5:
        return 2
    elif revenue_growth > -0.05 and peg_ratio < 3.5:
        return 3
    elif revenue_growth > -0.15 and peg_ratio < 5:
        return 4
    return 5

def generate_report(ticker, rank, info):
    rank_str = ["Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"][rank - 1]
    company = info.get('longName', ticker)
    sector = info.get('sector', 'its sector')
    
    report = f"{company} is currently displaying a Zacks Rank proxy of #{rank} ({rank_str}). "
    if rank <= 2:
        report += f"The company is showing strong momentum in {sector}, with robust revenue growth accelerating its top line. Valuation multiples remain compressed relative to forward earnings estimates, suggesting significant upside potential."
    elif rank == 3:
        report += f"The company is currently fairly valued within {sector}. We expect it to perform in line with the broader market. Wait for a better entry point or a clearer catalyst."
    else:
        report += f"Fundamental deterioration is evident in {sector}. With decelerating top-line growth and stretched valuation multiples, risk is skewed to the downside."
        
    return report

def get_fundamentals(ticker_symbol):
    try:
        t = yf.Ticker(ticker_symbol)
        info = t.info
        
        # Pull required metrics
        revenue_growth = info.get("revenueGrowth", 0)
        peg_ratio = info.get("pegRatio", 1.5)
        
        rank = calculate_zacks_rank(revenue_growth, peg_ratio)
        
        # Determine Style Scores (Proxy)
        pe = info.get("trailingPE", 20)
        peg_ratio = info.get("pegRatio", 1.5)
        ps_ratio = info.get("priceToSalesTrailing12Months", 2.0)
        sector = info.get("sector", "Unknown")
        industry = info.get("industry", "Unknown")
        
        # New Blended Value Score (PE, PEG, P/S) Relative to Industry Benchmark
        benchmark = get_industry_benchmark(sector, industry)
        
        # Calculate deviation from benchmark (lower is better for value)
        pe_dev = (benchmark["pe"] - pe) / benchmark["pe"] if benchmark["pe"] else 0
        peg_dev = (benchmark["peg"] - peg_ratio) / benchmark["peg"] if benchmark["peg"] else 0
        ps_dev = (benchmark["ps"] - ps_ratio) / benchmark["ps"] if benchmark["ps"] else 0
        
        # Blended deviation metric
        blended_dev = (pe_dev + peg_dev + ps_dev) / 3
        # If blended_dev is +0.30, stock is 30% CHEAPER than peers (Good)
        # If blended_dev is -0.50, stock is 50% MORE EXPENSIVE than peers (Bad)
        v_score = get_style_score(blended_dev, [0.30, 0.10, -0.10, -0.40]) 
        
        # Growth: higher rev growth is better
        g_score = get_style_score(revenue_growth, [0.20, 0.10, 0.0, -0.10])
        
        # Momentum: relative strength proxy (52 week high)
        spot = info.get('currentPrice', info.get('regularMarketPrice', 0))
        high52 = info.get('fiftyTwoWeekHigh', spot + 1)
        mom_metric = spot / high52 if high52 else 0
        m_score = get_style_score(mom_metric, [0.95, 0.85, 0.70, 0.50])
        
        # VGM overall
        scores = {'A': 5, 'B': 4, 'C': 3, 'D': 2, 'F': 1}
        letters = {5: 'A', 4: 'B', 3: 'C', 2: 'D', 1: 'F', 0: 'F'}
        vgm_avg = (scores[v_score] + scores[g_score] + scores[m_score]) / 3
        vgm_score = letters[int(round(vgm_avg))]
        
        style_scores = {
            "value": v_score,
            "growth": g_score,
            "momentum": m_score,
            "vgm": vgm_score
        }
        
        # Adjust Zacks Rank Proxy to prevent conflicts: if VGM is D or F, rank cannot be 1 or 2
        if vgm_score in ['D', 'F']:
            rank = max(rank, 4)
        elif vgm_score == 'C':
            rank = max(rank, 3)
        
        # History
        history = []
        try:
            inc = t.quarterly_income_stmt
            if inc is not None and not inc.empty:
                # Grab last 4-8 quarters
                for date in inc.columns[:8]:
                    try:
                        eps = inc.loc['Basic EPS', date] if 'Basic EPS' in inc.index else 0
                        rev = inc.loc['Total Revenue', date] if 'Total Revenue' in inc.index else 0
                        history.append({
                            "date": date.strftime("%Y-%m"), 
                            "eps": float(eps) if pd.notna(eps) else 0, 
                            "revenue": float(rev) if pd.notna(rev) else 0
                        })
                    except Exception:
                        pass
                history.reverse() # chronological order
        except Exception as e:
            print(f"Error getting history for {ticker_symbol}: {e}")
            
        result = {
            "ticker": ticker_symbol,
            "zacks_rank": rank,
            "spot": spot,
            "style_scores": style_scores,
            "report": generate_report(ticker_symbol, rank, info),
            "numberOfAnalystOpinions": info.get("numberOfAnalystOpinions", 0),
            "recommendationKey": info.get("recommendationKey", "none"),
            "targetMeanPrice": info.get("targetMeanPrice"),
            "targetHighPrice": info.get("targetHighPrice"),
            "targetLowPrice": info.get("targetLowPrice"),
            "pegRatio": peg_ratio,
            "trailingPE": pe,
            "forwardPE": info.get("forwardPE"),
            "priceToSales": ps_ratio,
            "revenueGrowth": revenue_growth,
            "profitMargins": info.get("profitMargins"),
            "returnOnEquity": info.get("returnOnEquity"),
            "benchmark_pe": benchmark["pe"],
            "benchmark_peg": benchmark["peg"],
            "benchmark_ps": benchmark["ps"],
            "benchmark_basket": benchmark["basket"],
            "history": history
        }
        
        return result
    except Exception as e:
        print(f"Error calculating fundamentals for {ticker_symbol}: {e}")
        return {"error": str(e)}
