import yfinance as yf
import pandas as pd
import json
import os
import sys
from datetime import datetime

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
    fcf_source = "Quarterly Statements (TTM)"
    
    ocf_keys = [
        'Operating Cash Flow', 'OperatingCashFlow',
        'Cash Flow From Continuing Operating Activities',
        'CashFlowFromContinuingOperatingActivities',
        'Total Cash From Operating Activities'
    ]
    capex_keys = [
        'Capital Expenditure', 'CapitalExpenditure',
        'CapitalExpendituresReported',
        'Purchase Of Property Plant And Equipment', 'PurchaseOfPPE',
        'Payments For Property And Equipment'
    ]
    
    try:
        qcf = getattr(t, 'quarterly_cashflow', None)
        if qcf is None or (hasattr(qcf, 'empty') and qcf.empty):
            qcf = t.get_cash_flow(freq="quarterly")
            
        if qcf is not None and not qcf.empty:
            ocf_row = None
            capex_row = None
            for n in ocf_keys:
                if n in qcf.index:
                    ocf_row = qcf.loc[n].dropna()
                    break
            for n in capex_keys:
                if n in qcf.index:
                    capex_row = qcf.loc[n].dropna()
                    break
                    
            if ocf_row is not None and len(ocf_row) >= 4:
                ocf_4q = float(ocf_row.iloc[:4].sum())
                capex_4q = float(capex_row.iloc[:4].sum()) if capex_row is not None and len(capex_row) >= 4 else -(abs(ocf_4q) * 0.18)
                calc_fcf = ocf_4q + (capex_4q if capex_4q < 0 else -capex_4q)
                if calc_fcf > 0:
                    fcf_ttm = calc_fcf
    except Exception:
        pass
        
    if fcf_ttm is None or fcf_ttm <= 0:
        try:
            acf = getattr(t, 'cashflow', None)
            if acf is None or (hasattr(acf, 'empty') and acf.empty):
                acf = t.get_cash_flow(freq="yearly")
                
            if acf is not None and not acf.empty:
                ocf_row = None
                capex_row = None
                for n in ocf_keys:
                    if n in acf.index:
                        ocf_row = acf.loc[n].dropna()
                        break
                for n in capex_keys:
                    if n in acf.index:
                        capex_row = acf.loc[n].dropna()
                        break
                        
                if ocf_row is not None and len(ocf_row) > 0:
                    ocf_ann = float(ocf_row.iloc[0])
                    capex_ann = float(capex_row.iloc[0]) if capex_row is not None and len(capex_row) > 0 else -(abs(ocf_ann) * 0.18)
                    calc_fcf = ocf_ann + (capex_ann if capex_ann < 0 else -capex_ann)
                    if calc_fcf > 0:
                        fcf_ttm = calc_fcf
                        fcf_source = "Annual Statements (LTM)"
        except Exception:
            pass
            
    # Proportional fallbacks scaled to company size - NEVER an arbitrary 1e9 ($1 Billion) placeholder
    mkt_cap = float(info.get('marketCap') or (current_price * (shares or 1)))
    total_rev = float(info.get('totalRevenue') or 0.0)
    sector = str(info.get('sector') or '').lower()
    industry = str(info.get('industry') or '').lower()
    
    if fcf_ttm is None or fcf_ttm <= 0:
        reported_fcf = info.get('freeCashflow')
        if reported_fcf and reported_fcf > 0 and (mkt_cap <= 0 or reported_fcf < mkt_cap * 0.35):
            fcf_ttm = float(reported_fcf)
            fcf_source = "Reported Free Cash Flow"
        else:
            op_cf = info.get('operatingCashflow')
            if op_cf and op_cf > 0 and (mkt_cap <= 0 or op_cf < mkt_cap * 0.40):
                fcf_ttm = float(op_cf * 0.78)
                fcf_source = "Estimated from Operating Cash Flow"
            else:
                net_inc = info.get('netIncomeToCommon') or 0
                if net_inc > 0 and (mkt_cap <= 0 or net_inc < mkt_cap * 0.35):
                    fcf_ttm = float(net_inc * 0.88)
                    fcf_source = "Estimated from Net Income"
                elif total_rev > 0:
                    if any(s in sector or s in industry for s in ['energy', 'materials', 'refin', 'utilities']):
                        fcf_margin = 0.038
                    elif any(s in sector or s in industry for s in ['technology', 'software', 'healthcare']):
                        fcf_margin = 0.095
                    else:
                        fcf_margin = 0.052
                    fcf_ttm = total_rev * fcf_margin
                    fcf_source = f"Normalized Revenue Margin ({fcf_margin*100:.1f}%)"
                else:
                    fcf_ttm = max(1000000.0, mkt_cap * 0.045)
                    fcf_source = "Normalized Market Cap Yield (4.5%)"

    # 2. Normalized 5-Year CAGR Growth
    growth = info.get('earningsGrowth') or info.get('revenueGrowth')
    if growth is None:
        growth = 0.08
    else:
        growth = float(growth)
        
    if growth > 0.35:
        growth_5y = min(0.25, growth * 0.45)
    elif growth < 0.02:
        growth_5y = 0.05
    else:
        growth_5y = max(0.04, min(growth, 0.20))

    # 3. Blume-Adjusted WACC
    rfr = 0.0425
    erp = 0.0525
    raw_beta = float(info.get('beta') or 1.1)
    adj_beta = (2.0 / 3.0) * raw_beta + (1.0 / 3.0) * 1.0
    cost_of_equity = rfr + adj_beta * erp
    cost_of_debt = 0.0525 * (1 - 0.21)
    
    equity_weight = mkt_cap / (mkt_cap + max(0, total_debt)) if (mkt_cap + total_debt) > 0 else 0.85
    debt_weight = 1.0 - equity_weight
    wacc = equity_weight * cost_of_equity + debt_weight * cost_of_debt
    wacc = max(0.070, min(wacc, 0.125))

    # 4. Sector-Tailored Terminal Multiples & Perpetual Growth
    if any(s in sector or s in industry for s in ['energy', 'oil', 'gas', 'refin', 'petroleum', 'coal']):
        exit_mult = 8.0 if growth_5y > 0.08 else 6.5
        terminal_growth = 0.015
    elif any(s in sector or s in industry for s in ['basic materials', 'metal', 'mining', 'chemical', 'steel']):
        exit_mult = 9.0 if growth_5y > 0.08 else 7.5
        terminal_growth = 0.018
    elif any(s in sector or s in industry for s in ['utilities', 'electric utility', 'gas utility']):
        exit_mult = 12.0 if growth_5y > 0.06 else 10.5
        terminal_growth = 0.020
    elif any(s in sector or s in industry for s in ['financial', 'bank', 'insurance']):
        exit_mult = 11.5 if growth_5y > 0.08 else 9.5
        terminal_growth = 0.020
    elif any(s in sector or s in industry for s in ['industrial', 'aerospace', 'machinery', 'transport']):
        exit_mult = 14.5 if growth_5y > 0.10 else 12.0
        terminal_growth = 0.022
    elif any(s in sector or s in industry for s in ['consumer defensive', 'staples', 'food', 'beverage']):
        exit_mult = 16.5 if growth_5y > 0.08 else 14.0
        terminal_growth = 0.020
    elif any(s in sector or s in industry for s in ['consumer cyclical', 'discretionary', 'retail', 'auto']):
        exit_mult = 16.0 if growth_5y > 0.10 else 13.0
        terminal_growth = 0.022
    elif any(s in sector or s in industry for s in ['technology', 'software', 'semiconductor', 'hardware']):
        exit_mult = 22.0 if growth_5y > 0.12 else 18.0
        terminal_growth = 0.025
    elif any(s in sector or s in industry for s in ['communication', 'telecom', 'media']):
        exit_mult = 16.0 if growth_5y > 0.10 else 13.0
        terminal_growth = 0.022
    elif any(s in sector or s in industry for s in ['healthcare', 'biotech', 'pharma', 'medical']):
        exit_mult = 19.5 if growth_5y > 0.10 else 15.5
        terminal_growth = 0.025
    else:
        exit_mult = 16.0 if growth_5y > 0.10 else 13.5
        terminal_growth = 0.022

    # 5. Two-Stage DCF Projections
    pv_fcfs = 0.0
    proj_fcf = fcf_ttm
    for yr in range(1, 6):
        proj_fcf *= (1 + growth_5y)
        pv_fcfs += proj_fcf / ((1 + wacc) ** yr)
        
    denom = max(0.02, wacc - terminal_growth)
    tv_gordon = (proj_fcf * (1 + terminal_growth)) / denom
    tv_exit = proj_fcf * exit_mult
    
    terminal_val = 0.40 * tv_gordon + 0.60 * tv_exit
    pv_tv = terminal_val / ((1 + wacc) ** 5)
    
    enterprise_val = pv_fcfs + pv_tv
    equity_val = enterprise_val + float(total_cash) - float(total_debt)
    
    calculated_fair_val = equity_val / float(shares) if shares and shares > 0 else current_price
    
    # Institutional Sanity Bounds:
    # A DCF model for a public stock without massive structural collapse/takeover
    # should stay within economic sanity boundaries relative to market pricing.
    min_bound = current_price * 0.35
    max_bound = current_price * 2.20
    fair_value = max(min_bound, min(calculated_fair_val, max_bound))
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
        'fcf_source': fcf_source,
        'wacc': round(wacc, 4),
        'growth_5y': round(growth_5y, 4),
        'exit_mult': exit_mult,
        'sector': sector or "General"
    }
def get_fundamental_history(ticker):
    """
    Fetches up to 10+ quarters of historical financials using yfinance.
    """
    try:
        t = yf.Ticker(ticker)
        info = getattr(t, 'info', None) or {}
        
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
                "debt_to_equity": debt_to_equity,
                "capex": abs(capex),
                "operating_cash_flow": op_cf
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

        # Wall Street Consensus Forecasts Engine (Quarterly & Annual Future Estimates)
        quarterly_forecast = []
        annual_forecast = []
        try:
            shares = info.get("sharesOutstanding") or 1e9
            rev_growth = info.get("revenueGrowth") or 0.12
            earnings_growth = info.get("earningsGrowth") or 0.15
            fwd_eps = info.get("forwardEps")
            
            # Historical baselines for ratios
            last_q = history[-1] if history else {}
            last_a = annual_history[-1] if annual_history else {}
            
            base_rev = last_a.get("revenue") or (last_q.get("revenue", 1e10) * 4)
            base_ni = last_a.get("net_income") or (last_q.get("net_income", 2e9) * 4)
            base_gm = last_a.get("gross_margin") or last_q.get("gross_margin") or 50.0
            base_om = last_a.get("operating_margin") or last_q.get("operating_margin") or 25.0
            base_nm = last_a.get("net_margin") or last_q.get("net_margin") or 20.0
            base_eps = last_a.get("eps") or last_q.get("eps") or 2.0
            
            fcf_conversion = (last_a.get("fcf", 0) / base_ni) if base_ni > 0 and last_a.get("fcf", 0) > 0 else 0.95
            fcf_conversion = max(0.7, min(1.3, fcf_conversion))
            capex_ratio = (last_a.get("capex", 0) / base_rev) if base_rev > 0 and last_a.get("capex", 0) > 0 else 0.05
            capex_ratio = max(0.02, min(0.20, capex_ratio))

            rev_est = getattr(t, 'revenue_estimate', None)
            eps_est = getattr(t, 'earnings_estimate', None)

            # 1. ANNUAL PROJECTIONS (FY+1E, FY+2E)
            last_yr_str = str(last_a.get("period", datetime.now().year))
            try:
                base_yr = int(last_yr_str)
            except Exception:
                base_yr = datetime.now().year

            # FY+1E (0y or extrapolated)
            if rev_est is not None and '0y' in rev_est.index and pd.notna(rev_est.loc['0y', 'avg']):
                fy1_rev = float(rev_est.loc['0y', 'avg'])
            else:
                fy1_rev = base_rev * (1 + rev_growth)

            if eps_est is not None and '0y' in eps_est.index and pd.notna(eps_est.loc['0y', 'avg']):
                fy1_eps = float(eps_est.loc['0y', 'avg'])
            elif fwd_eps:
                fy1_eps = float(fwd_eps)
            else:
                fy1_eps = base_eps * (1 + earnings_growth)

            fy1_ni = (fy1_eps * shares) if shares > 0 else (fy1_rev * (base_nm / 100))
            fy1_gm = round(min(95.0, base_gm + 0.3), 1)
            fy1_om = round(min(80.0, base_om + 0.5), 1)
            fy1_nm = round((fy1_ni / fy1_rev * 100) if fy1_rev > 0 else base_nm, 1)
            fy1_fcf = fy1_ni * fcf_conversion
            fy1_capex = fy1_rev * capex_ratio
            fy1_ocf = fy1_fcf + fy1_capex

            # FY+2E (+1y or extrapolated)
            if rev_est is not None and '+1y' in rev_est.index and pd.notna(rev_est.loc['+1y', 'avg']):
                fy2_rev = float(rev_est.loc['+1y', 'avg'])
            else:
                fy2_rev = fy1_rev * (1 + rev_growth * 0.85)

            if eps_est is not None and '+1y' in eps_est.index and pd.notna(eps_est.loc['+1y', 'avg']):
                fy2_eps = float(eps_est.loc['+1y', 'avg'])
            else:
                fy2_eps = fy1_eps * (1 + earnings_growth * 0.85)

            fy2_ni = (fy2_eps * shares) if shares > 0 else (fy2_rev * (base_nm / 100))
            fy2_gm = round(min(95.0, fy1_gm + 0.2), 1)
            fy2_om = round(min(80.0, fy1_om + 0.4), 1)
            fy2_nm = round((fy2_ni / fy2_rev * 100) if fy2_rev > 0 else base_nm, 1)
            fy2_fcf = fy2_ni * fcf_conversion
            fy2_capex = fy2_rev * capex_ratio
            fy2_ocf = fy2_fcf + fy2_capex

            annual_forecast = [
                {
                    "period": f"{base_yr + 1}E",
                    "revenue": fy1_rev,
                    "net_income": fy1_ni,
                    "gross_margin": fy1_gm,
                    "operating_margin": fy1_om,
                    "net_margin": fy1_nm,
                    "eps": round(fy1_eps, 2),
                    "fcf": fy1_fcf,
                    "capex": fy1_capex,
                    "operating_cash_flow": fy1_ocf,
                    "is_forecast": True
                },
                {
                    "period": f"{base_yr + 2}E",
                    "revenue": fy2_rev,
                    "net_income": fy2_ni,
                    "gross_margin": fy2_gm,
                    "operating_margin": fy2_om,
                    "net_margin": fy2_nm,
                    "eps": round(fy2_eps, 2),
                    "fcf": fy2_fcf,
                    "capex": fy2_capex,
                    "operating_cash_flow": fy2_ocf,
                    "is_forecast": True
                }
            ]

            # 2. QUARTERLY PROJECTIONS (Q+1E, Q+2E)
            last_q_rev = last_q.get("revenue") or (base_rev / 4)
            last_q_ni = last_q.get("net_income") or (base_ni / 4)
            last_q_eps = last_q.get("eps") or (base_eps / 4)

            # Q+1E (0q or extrapolated)
            if rev_est is not None and '0q' in rev_est.index and pd.notna(rev_est.loc['0q', 'avg']):
                q1_rev = float(rev_est.loc['0q', 'avg'])
            else:
                q1_rev = last_q_rev * (1 + rev_growth / 4)

            if eps_est is not None and '0q' in eps_est.index and pd.notna(eps_est.loc['0q', 'avg']):
                q1_eps = float(eps_est.loc['0q', 'avg'])
            else:
                q1_eps = last_q_eps * (1 + earnings_growth / 4)

            q1_ni = (q1_eps * shares) if shares > 0 else (q1_rev * (base_nm / 100))
            q1_gm = round(min(95.0, base_gm + 0.2), 1)
            q1_om = round(min(80.0, base_om + 0.3), 1)
            q1_nm = round((q1_ni / q1_rev * 100) if q1_rev > 0 else base_nm, 1)
            q1_fcf = q1_ni * fcf_conversion
            q1_capex = q1_rev * capex_ratio
            q1_ocf = q1_fcf + q1_capex

            # Q+2E (+1q or extrapolated)
            if rev_est is not None and '+1q' in rev_est.index and pd.notna(rev_est.loc['+1q', 'avg']):
                q2_rev = float(rev_est.loc['+1q', 'avg'])
            else:
                q2_rev = q1_rev * (1 + rev_growth / 4)

            if eps_est is not None and '+1q' in eps_est.index and pd.notna(eps_est.loc['+1q', 'avg']):
                q2_eps = float(eps_est.loc['+1q', 'avg'])
            else:
                q2_eps = q1_eps * (1 + earnings_growth / 4)

            q2_ni = (q2_eps * shares) if shares > 0 else (q2_rev * (base_nm / 100))
            q2_gm = round(min(95.0, q1_gm + 0.2), 1)
            q2_om = round(min(80.0, q1_om + 0.3), 1)
            q2_nm = round((q2_ni / q2_rev * 100) if q2_rev > 0 else base_nm, 1)
            q2_fcf = q2_ni * fcf_conversion
            q2_capex = q2_rev * capex_ratio
            q2_ocf = q2_fcf + q2_capex

            quarterly_forecast = [
                {
                    "quarter": "Q+1E",
                    "revenue": q1_rev,
                    "net_income": q1_ni,
                    "gross_margin": q1_gm,
                    "operating_margin": q1_om,
                    "net_margin": q1_nm,
                    "eps": round(q1_eps, 2),
                    "fcf": q1_fcf,
                    "capex": q1_capex,
                    "operating_cash_flow": q1_ocf,
                    "is_forecast": True
                },
                {
                    "quarter": "Q+2E",
                    "revenue": q2_rev,
                    "net_income": q2_ni,
                    "gross_margin": q2_gm,
                    "operating_margin": q2_om,
                    "net_margin": q2_nm,
                    "eps": round(q2_eps, 2),
                    "fcf": q2_fcf,
                    "capex": q2_capex,
                    "operating_cash_flow": q2_ocf,
                    "is_forecast": True
                }
            ]
        except Exception as e:
            print(f"Error computing forecasts for {ticker}: {e}")

        forecasts = {
            "quarterly": quarterly_forecast,
            "annual": annual_forecast
        }
            
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
            "forecasts": forecasts,
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
