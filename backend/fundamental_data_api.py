import yfinance as yf
import pandas as pd
import json
import os
import sys

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from earnings_deconstructor_engine import get_earnings_deconstruction
from moat_catalyst_engine import get_moat_catalyst_analysis
from valuation_engine import get_complete_valuation_package
from forensic_dupont_engine import get_forensic_dupont_analysis
from capital_allocation_engine import calculate_capital_allocation

def calculate_dcf_fair_value(ticker: str) -> dict:
    """
    Calculates an institutional 2-stage DCF Fair Value using true TTM Free Cash Flow,
    Blume-adjusted Beta WACC, and blended terminal valuation (Gordon Growth + Exit Multiple).
    """
    try:
        t = yf.Ticker(ticker.upper())
        info = t.info or {}
        if not info:
            return {"error": f"Could not fetch data for {ticker}."}
    except Exception as e:
        return {"error": f"Failed to fetch data: {str(e)}"}
        
    current_price = info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose')
    if not current_price:
        hist = t.history(period="1d")
        current_price = float(hist['Close'].iloc[-1]) if not hist.empty else 100.0
        
    shares = info.get('sharesOutstanding')
    if not shares:
        shares = getattr(t.fast_info, 'shares', None)
        
    total_cash = info.get('totalCash') or getattr(t.fast_info, 'cash', 0) or 0
    total_debt = info.get('totalDebt') or getattr(t.fast_info, 'debt', 0) or 0
    
    # 1. Compute True TTM Free Cash Flow from Statements
    fcf_ttm = None
    try:
        qcf = t.quarterly_cashflow
        if qcf is not None and not qcf.empty:
            ocf_row = None
            capex_row = None
            for n in ['Operating Cash Flow', 'OperatingCashFlow']:
                if n in qcf.index:
                    ocf_row = qcf.loc[n].dropna()
                    break
            for n in ['Capital Expenditure', 'CapitalExpenditure']:
                if n in qcf.index:
                    capex_row = qcf.loc[n].dropna()
                    break
                    
            if ocf_row is not None and len(ocf_row) >= 4:
                ocf_4q = float(ocf_row.iloc[:4].sum())
                capex_4q = float(capex_row.iloc[:4].sum()) if capex_row is not None and len(capex_row) >= 4 else -(ocf_4q * 0.18)
                fcf_ttm = ocf_4q + capex_4q
    except Exception:
        pass
        
    if fcf_ttm is None or fcf_ttm <= 0:
        try:
            acf = t.cashflow
            if acf is not None and not acf.empty:
                ocf_row = acf.loc['Operating Cash Flow'].dropna() if 'Operating Cash Flow' in acf.index else None
                capex_row = acf.loc['Capital Expenditure'].dropna() if 'Capital Expenditure' in acf.index else None
                if ocf_row is not None and len(ocf_row) > 0:
                    ocf_ann = float(ocf_row.iloc[0])
                    capex_ann = float(capex_row.iloc[0]) if capex_row is not None and len(capex_row) > 0 else -(ocf_ann * 0.18)
                    fcf_ttm = ocf_ann + capex_ann
        except Exception:
            pass
            
    if fcf_ttm is None or fcf_ttm <= 0:
        net_inc = info.get('netIncomeToCommon') or 0
        if net_inc > 0:
            fcf_ttm = float(net_inc * 0.95)
        else:
            fcf_ttm = float(info.get('freeCashflow') or 1e9)

    # 2. Normalized 5-Year CAGR Growth
    growth = info.get('earningsGrowth') or info.get('revenueGrowth')
    if growth is None:
        growth = 0.10
    else:
        growth = float(growth)
        
    if growth > 0.40:
        growth_5y = min(0.30, growth * 0.5)
    elif growth < 0.03:
        growth_5y = 0.08
    else:
        growth_5y = max(0.06, min(growth, 0.25))

    # 3. Blume-Adjusted WACC
    rfr = 0.042
    erp = 0.055
    raw_beta = float(info.get('beta') or 1.1)
    adj_beta = (2.0 / 3.0) * raw_beta + (1.0 / 3.0) * 1.0
    cost_of_equity = rfr + adj_beta * erp
    cost_of_debt = 0.05 * (1 - 0.21)
    
    mkt_cap = info.get('marketCap') or (current_price * (shares or 1))
    equity_weight = mkt_cap / (mkt_cap + max(0, total_debt)) if (mkt_cap + total_debt) > 0 else 0.9
    debt_weight = 1.0 - equity_weight
    wacc = equity_weight * cost_of_equity + debt_weight * cost_of_debt
    wacc = max(0.075, min(wacc, 0.115))

    # 4. Two-Stage DCF with Exit Multiple Blend
    pv_fcfs = 0.0
    proj_fcf = fcf_ttm
    for yr in range(1, 6):
        proj_fcf *= (1 + growth_5y)
        pv_fcfs += proj_fcf / ((1 + wacc) ** yr)
        
    terminal_growth = 0.025
    tv_gordon = (proj_fcf * (1 + terminal_growth)) / (wacc - terminal_growth)
    exit_mult = 22.0 if growth_5y > 0.12 else 18.0
    tv_exit = proj_fcf * exit_mult
    
    terminal_val = 0.5 * tv_gordon + 0.5 * tv_exit
    pv_tv = terminal_val / ((1 + wacc) ** 5)
    
    enterprise_val = pv_fcfs + pv_tv
    equity_val = enterprise_val + float(total_cash) - float(total_debt)
    
    fair_value = equity_val / float(shares) if shares and shares > 0 else current_price
    fair_value = round(max(0.0, fair_value), 2)
    current_price = round(current_price, 2)
    
    discount = (fair_value - current_price) / fair_value if fair_value > 0 else 0.0
    discount_pct = round(discount * 100, 1)
    
    status = "Undervalued" if discount_pct > 5 else ("Overvalued" if discount_pct < -5 else "Fairly Valued")
    
    return {
        'fair_value': fair_value,
        'current_price': current_price,
        'valuation_status': status,
        'discount_pct': discount_pct,
        'fcf_ttm': round(fcf_ttm, 2),
        'wacc': round(wacc, 4),
        'growth_5y': round(growth_5y, 4)
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

        # Extract Annual History (5-Year Multi-Year Engine)
        annual_history = []
        try:
            inc_a = t.income_stmt
            cf_a = t.cashflow
            bs_a = t.balance_sheet
            if inc_a is not None and not inc_a.empty:
                for date in inc_a.columns:
                    yr = date.strftime('%Y')
                    rev_a = get_val(inc_a, ['Total Revenue', 'Operating Revenue'], date)
                    if rev_a == 0: continue
                    ni_a = get_val(inc_a, ['Net Income', 'NetIncome', 'NetIncomeCommonStockholders'], date)
                    gp_a = get_val(inc_a, ['Gross Profit', 'GrossProfit'], date)
                    op_a = get_val(inc_a, ['Operating Income', 'OperatingIncome'], date)
                    eps_a = get_val(inc_a, ['Diluted EPS', 'DilutedEPS'], date)
                    op_cf_a = get_val(cf_a, ['Operating Cash Flow', 'OperatingCashFlow'], date)
                    capex_a = get_val(cf_a, ['Capital Expenditure', 'CapitalExpenditure'], date)
                    fcf_a = op_cf_a + capex_a
                    gm_a = (gp_a / rev_a) * 100 if rev_a > 0 else 0
                    om_a = (op_a / rev_a) * 100 if rev_a > 0 else 0
                    nm_a = (ni_a / rev_a) * 100 if rev_a > 0 else 0
                    
                    annual_history.append({
                        "period": yr,
                        "revenue": rev_a,
                        "net_income": ni_a,
                        "gross_margin": gm_a,
                        "operating_margin": om_a,
                        "net_margin": nm_a,
                        "eps": eps_a,
                        "fcf": fcf_a,
                        "capex": abs(capex_a),
                        "operating_cash_flow": op_cf_a
                    })
                annual_history.sort(key=lambda x: x["period"])
        except Exception as e:
            print(f"Error extracting annual history: {e}")
            
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
        
        # Next-Gen Institutional Deep Fundamentals Modules
        try:
            earnings_deconstruction = get_earnings_deconstruction(ticker)
        except Exception as e:
            print(f"Earnings deconstruction error for {ticker}: {e}")
            earnings_deconstruction = None

        try:
            moat_catalyst = get_moat_catalyst_analysis(ticker)
        except Exception as e:
            print(f"Moat catalyst error for {ticker}: {e}")
            moat_catalyst = None

        try:
            dynamic_valuation = get_complete_valuation_package(ticker)
        except Exception as e:
            print(f"Valuation package error for {ticker}: {e}")
            dynamic_valuation = None

        try:
            forensic_dupont = get_forensic_dupont_analysis(ticker)
        except Exception as e:
            print(f"Forensic dupont error for {ticker}: {e}")
            forensic_dupont = None

        try:
            capital_allocation = calculate_capital_allocation(ticker)
        except Exception as e:
            print(f"Capital allocation error for {ticker}: {e}")
            capital_allocation = None

        long_name = info.get("longName") or info.get("shortName") or ticker
        short_name = info.get("shortName") or info.get("longName") or ticker
        curr_price = float(info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose") or 0.0)

        # Profile and Trading Multiples
        profile = {
            "symbol": ticker,
            "ticker": ticker,
            "company_name": long_name,
            "long_name": long_name,
            "short_name": short_name,
            "current_price": curr_price,
            "exchange": info.get("exchange", "NASDAQ"),
            "market_cap": info.get("marketCap", 0),
            "enterprise_value": info.get("enterpriseValue", 0),
            "trailing_pe": info.get("trailingPE", 0),
            "forward_pe": info.get("forwardPE", 0),
            "peg_ratio": info.get("pegRatio", 0),
            "price_to_sales": info.get("priceToSalesTrailing12Months", 0),
            "price_to_book": info.get("priceToBook", 0),
            "ev_to_ebitda": info.get("enterpriseToEbitda", 0),
            "ev_to_revenue": info.get("enterpriseToRevenue", 0),
            "dividend_yield": info.get("dividendYield", 0),
            "payout_ratio": info.get("payoutRatio", 0),
            "beta": info.get("beta", 1.0),
            "roe": info.get("returnOnEquity", 0),
            "roa": info.get("returnOnAssets", 0),
            "profit_margin": info.get("profitMargins", 0),
            "operating_margin": info.get("operatingMargins", 0),
            "gross_margin": info.get("grossMargins", 0),
            "analyst_target_mean": info.get("targetMeanPrice", 0),
            "analyst_target_high": info.get("targetHighPrice", 0),
            "analyst_target_low": info.get("targetLowPrice", 0),
            "analyst_count": info.get("numberOfAnalystOpinions", 0),
            "analyst_rating": info.get("recommendationKey", "buy"),
            "fifty_two_week_low": info.get("fiftyTwoWeekLow", 0),
            "fifty_two_week_high": info.get("fiftyTwoWeekHigh", 0),
            "fifty_two_week_change": info.get("52WeekChange", 0),
            "short_percent_of_float": info.get("shortPercentOfFloat", 0),
            "shares_outstanding": info.get("sharesOutstanding", 0)
        }

        return {
            "ticker": ticker,
            "symbol": ticker,
            "company_name": long_name,
            "long_name": long_name,
            "short_name": short_name,
            "current_price": curr_price,
            "company_overview": info.get("longBusinessSummary", "No company overview available."),
            "sector": info.get("sector", "Unknown"),
            "industry": info.get("industry", "Unknown"),
            "website": website,
            "logo_url": logo_url,
            "history": history,
            "annual_history": annual_history,
            "acceleration_metrics": acceleration_metrics,
            "recommendation": recommendation,
            "score": score,
            "reasons": reasons,
            "profile": profile,
            "fair_value_data": calculate_dcf_fair_value(ticker),
            # Next-Gen Institutional Data
            "earnings_deconstruction": earnings_deconstruction,
            "moat_catalyst": moat_catalyst,
            "dynamic_valuation": dynamic_valuation,
            "forensic_dupont": forensic_dupont,
            "capital_allocation": capital_allocation
        }
        
    except Exception as e:
        print(f"Error in fundamental data api for {ticker}: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    import sys
    ticker = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
    print(json.dumps(get_fundamental_history(ticker), indent=2))
