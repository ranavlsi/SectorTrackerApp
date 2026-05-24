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
        # Value: lower P/E is better
        pe = info.get("trailingPE", 20)
        v_score = get_style_score(-pe, [-15, -20, -25, -35]) 
        
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
            "revenueGrowth": revenue_growth,
            "profitMargins": info.get("profitMargins"),
            "returnOnEquity": info.get("returnOnEquity"),
            "history": history
        }
        
        return result
    except Exception as e:
        print(f"Error calculating fundamentals for {ticker_symbol}: {e}")
        return {"error": str(e)}
