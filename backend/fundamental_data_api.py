import yfinance as yf
import pandas as pd
import json

def calculate_dcf_fair_value(ticker: str) -> dict:
    """
    Calculates a Simply Wall St style Fair Value using a 2-stage DCF model.
    """
    try:
        t = yf.Ticker(ticker)
        info = t.info
        if not info:
            return {"error": f"Could not fetch data for {ticker}."}
    except Exception as e:
        return {"error": f"Failed to fetch data: {str(e)}"}
        
    fcf = info.get('freeCashflow')
    total_cash = info.get('totalCash', 0)
    total_debt = info.get('totalDebt', 0)
    shares = info.get('sharesOutstanding')
    beta = info.get('beta')
    growth = info.get('earningsGrowth')
    
    current_price = info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose')
    
    missing = []
    if fcf is None: missing.append('freeCashflow')
    if shares is None or shares == 0: missing.append('sharesOutstanding')
    if current_price is None: missing.append('currentPrice')
    
    if missing:
        return {"error": f"Missing critical data for DCF: {', '.join(missing)}"}
        
    if fcf <= 0:
        return {"error": "Free cash flow is negative or zero. Basic DCF cannot be applied."}
        
    total_cash = total_cash if total_cash is not None else 0
    total_debt = total_debt if total_debt is not None else 0
    
    if growth is None:
        growth_rate = 0.05
    else:
        # Cap growth at 25% for a 10-year horizon to prevent exponential blowouts
        growth_rate = max(0.0, min(float(growth), 0.25))
        
    rfr = 0.04
    erp = 0.06
    if beta is None:
        discount_rate = 0.09
    else:
        discount_rate = rfr + (float(beta) * erp)
        discount_rate = max(0.05, min(discount_rate, 0.15))
        
    terminal_growth = 0.02
    if discount_rate <= terminal_growth:
        discount_rate = terminal_growth + 0.01
        
    pv_fcfs = 0.0
    projected_fcf = float(fcf)
    # 10-Year DCF Projection (Standard for Simply Wall St)
    for year in range(1, 11):
        projected_fcf *= (1 + growth_rate)
        pv_fcfs += projected_fcf / ((1 + discount_rate) ** year)
        
    terminal_value = (projected_fcf * (1 + terminal_growth)) / (discount_rate - terminal_growth)
    pv_tv = terminal_value / ((1 + discount_rate) ** 10)
    
    enterprise_value = pv_fcfs + pv_tv
    equity_value = enterprise_value + float(total_cash) - float(total_debt)
    
    if equity_value <= 0:
        fair_value = 0.0
    else:
        fair_value = equity_value / float(shares)
        
    fair_value = round(fair_value, 2)
    current_price = round(current_price, 2)
    
    if fair_value > 0:
        discount = (fair_value - current_price) / fair_value
    else:
        discount = 0.0
        
    discount_pct = round(discount * 100, 2)
    
    if discount_pct > 0:
        valuation_status = "Undervalued"
    elif discount_pct < 0:
        valuation_status = "Overvalued"
    else:
        valuation_status = "Fairly Valued"
        
    return {
        'fair_value': fair_value,
        'current_price': current_price,
        'valuation_status': valuation_status,
        'discount_pct': discount_pct
    }
def get_fundamental_history(ticker):
    """
    Fetches up to 10+ quarters of historical financials using yfinance.
    """
    try:
        t = yf.Ticker(ticker)
        
        # We need Income Statement, Balance Sheet, and Cash Flow (Quarterly)
        # yfinance `.quarterly_financials` sometimes returns ~4 quarters. 
        # Using `.get_financials(freq="quarterly")` handles newer versions.
        # Fallback to `.quarterly_financials` if necessary.
        
        try:
            inc = t.get_financials(freq="quarterly")
            bs = t.get_balance_sheet(freq="quarterly")
            cf = t.get_cash_flow(freq="quarterly")
        except AttributeError:
            inc = t.quarterly_financials
            bs = t.quarterly_balance_sheet
            cf = t.quarterly_cashflow
            
        if inc is None or inc.empty:
            return {"error": "No fundamental data available."}
            
        # Reverse columns so oldest is first, newest is last for charting
        inc = inc[inc.columns[::-1]] if inc is not None else pd.DataFrame()
        bs = bs[bs.columns[::-1]] if bs is not None else pd.DataFrame()
        cf = cf[cf.columns[::-1]] if cf is not None else pd.DataFrame()

        history = []
        
        def get_val(df, keys, date):
            for k in keys:
                if k in df.index and pd.notna(df.loc[k, date]):
                    return float(df.loc[k, date])
            return 0
            
        for date in inc.columns:
            # Extract basic income metrics
            rev = get_val(inc, ['Total Revenue', 'TotalRevenue'], date)
            ni = get_val(inc, ['Net Income', 'NetIncome', 'NetIncomeCommonStockholders'], date)
            gross_profit = get_val(inc, ['Gross Profit', 'GrossProfit'], date)
            op_income = get_val(inc, ['Operating Income', 'OperatingIncome'], date)
            
            if rev == 0:
                continue
            
            # Margins
            gross_margin = (gross_profit / rev) * 100 if rev > 0 else 0
            op_margin = (op_income / rev) * 100 if rev > 0 else 0
            net_margin = (ni / rev) * 100 if rev > 0 else 0
            
            # EPS
            eps = get_val(inc, ['Diluted EPS', 'DilutedEPS', 'Basic EPS', 'BasicEPS'], date)
                
            # Free Cash Flow (Operating Cash Flow - Capital Expenditures)
            fcf = 0
            op_cf = 0
            if date in cf.columns:
                op_cf = get_val(cf, ['Operating Cash Flow', 'OperatingCashFlow'], date)
                capex = get_val(cf, ['Capital Expenditure', 'CapitalExpenditure'], date)
                fcf = op_cf + capex # capex is usually reported as negative
            
            # Debt (Balance Sheet)
            total_debt = 0
            total_equity = 0
            if date in bs.columns:
                total_debt = get_val(bs, ['Total Debt', 'TotalDebt'], date)
                total_equity = get_val(bs, ['Stockholders Equity', 'StockholdersEquity', 'TotalStockholderEquity'], date)
            
            debt_to_equity = (total_debt / total_equity) if total_equity > 0 else 0
            
            history.append({
                "quarter": date.strftime('%Y-%m'),
                "revenue": rev,
                "net_income": ni,
                "gross_margin": gross_margin,
                "operating_margin": op_margin,
                "net_margin": net_margin,
                "eps": eps,
                "fcf": fcf,
                "debt_to_equity": debt_to_equity
            })
            
        # Fundamental Buy/Sell Logic
        recommendation = "Hold"
        reasons = []
        score = 0
        
        if len(history) >= 2:
            current = history[-1]
            prev = history[-2]
            
            # Revenue Growth
            if current["revenue"] > prev["revenue"]:
                score += 1
                reasons.append("QoQ Revenue Growth")
            else:
                score -= 1
                reasons.append("QoQ Revenue Contraction")
                
            # Profitability
            if current["net_income"] > 0:
                score += 1
                reasons.append("Profitable")
            else:
                score -= 2
                reasons.append("Unprofitable")
                
            # Margin Expansion
            if current["net_margin"] > prev["net_margin"]:
                score += 1
                reasons.append("Expanding Margins")
                
            # Cash Generation
            if current["fcf"] > 0:
                score += 1
                reasons.append("Positive Free Cash Flow")
            else:
                score -= 1
                reasons.append("Negative Free Cash Flow (Cash Burn)")
                
            # Debt
            if current["debt_to_equity"] < 1.0:
                score += 1
                reasons.append("Healthy Balance Sheet (Low Debt)")
            elif current["debt_to_equity"] > 2.0:
                score -= 1
                reasons.append("Highly Leveraged (Debt Risk)")
                
            if score >= 3:
                recommendation = "Strong Buy"
            elif score >= 1:
                recommendation = "Buy"
            elif score <= -2:
                recommendation = "Strong Sell"
            elif score < 0:
                recommendation = "Sell"
                
        else:
            recommendation = "Neutral (Insufficient History)"
            reasons.append("Need more than 1 quarter of data to determine trend")

        # --- Calculate Acceleration Velocity ---
        acceleration_metrics = {}
        if len(history) >= 3:
            # history is oldest to newest, so history[-1] is current, [-2] is previous, [-3] is two quarters ago
            h1 = history[-3]
            h2 = history[-2]
            h3 = history[-1]
            
            def calc_growth(v_old, v_new):
                if v_old == 0: return 0
                return (v_new - v_old) / abs(v_old)
                
            def get_accel(k):
                g1 = calc_growth(h1[k], h2[k])
                g2 = calc_growth(h2[k], h3[k])
                
                status = "Neutral"
                color = "yellow"
                if g2 > g1 and g2 > 0: 
                    status = "Accelerating"
                    color = "green"
                elif g2 < g1 and g2 < 0:
                    status = "Decelerating"
                    color = "red"
                elif g2 < g1 and g2 > 0:
                    status = "Slowing Growth"
                    color = "orange"
                    
                return {
                    "current": h3[k],
                    "growth_q1": round(g1 * 100, 1),
                    "growth_q2": round(g2 * 100, 1),
                    "status": status,
                    "color": color
                }
                
            acceleration_metrics = {
                "revenue": get_accel("revenue"),
                "eps": get_accel("eps"),
                "fcf": get_accel("fcf"),
                "operating_margin": {
                    "current": h3["operating_margin"],
                    "bps_change": round((h3["operating_margin"] - h2["operating_margin"]) * 100, 0),
                    "status": "Expanding" if h3["operating_margin"] > h2["operating_margin"] else "Contracting",
                    "color": "green" if h3["operating_margin"] > h2["operating_margin"] else "red"
                }
            }

        # Fetch info to get the company overview
        info = t.info if t.info else {}
        
        website = info.get("website", "")
        logo_url = ""
        if website:
            domain = website.replace("https://", "").replace("http://", "").replace("www.", "").split("/")[0]
            logo_url = f"https://logo.clearbit.com/{domain}"
        
        return {
            "ticker": ticker,
            "company_overview": info.get("longBusinessSummary", "No company overview available."),
            "sector": info.get("sector", "Unknown"),
            "industry": info.get("industry", "Unknown"),
            "website": website,
            "logo_url": logo_url,
            "history": history,
            "acceleration_metrics": acceleration_metrics,
            "recommendation": recommendation,
            "score": score,
            "reasons": reasons,
            "fair_value_data": calculate_dcf_fair_value(ticker)
        }
        
    except Exception as e:
        print(f"Error in fundamental data api for {ticker}: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    import sys
    ticker = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
    print(json.dumps(get_fundamental_history(ticker), indent=2))
