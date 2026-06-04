import yfinance as yf
import pandas as pd
import json

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

        return {
            "ticker": ticker,
            "history": history,
            "recommendation": recommendation,
            "score": score,
            "reasons": reasons
        }
        
    except Exception as e:
        print(f"Error in fundamental data api for {ticker}: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    import sys
    ticker = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
    print(json.dumps(get_fundamental_history(ticker), indent=2))
