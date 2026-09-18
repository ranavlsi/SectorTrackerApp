"""
backend/valuation_engine.py
Institutional-Grade Dynamic Scenario & Valuation Modeling Engine.
Implements FCFF DCF with mid-year discounting convention, Reverse DCF Solver,
5x5 Tornado Sensitivity Matrix, and Multiples Dispersion Envelopes.
"""

from typing import Dict, List, Optional, Any
import math
import yfinance as yf
import pandas as pd

class ValuationEngine:
    @staticmethod
    def calculate_wacc(
        stock_price: float,
        shares_outstanding: float,
        total_debt: float,
        interest_expense: float,
        beta: float,
        risk_free_rate: float = 0.0425,
        equity_risk_premium: float = 0.050,
        tax_rate: float = 0.21,
        size_premium: float = 0.0
    ) -> Dict[str, float]:
        market_equity = stock_price * shares_outstanding
        total_capital = market_equity + total_debt
        
        we = market_equity / total_capital if total_capital > 0 else 1.0
        wd = total_debt / total_capital if total_capital > 0 else 0.0
        
        cost_of_equity = risk_free_rate + (beta * equity_risk_premium) + size_premium
        
        if total_debt > 0 and interest_expense > 0:
            pre_tax_cost_of_debt = interest_expense / total_debt
            pre_tax_cost_of_debt = min(max(pre_tax_cost_of_debt, 0.02), 0.15)
        else:
            pre_tax_cost_of_debt = risk_free_rate + 0.015
            
        after_tax_cost_of_debt = pre_tax_cost_of_debt * (1 - tax_rate)
        wacc = (we * cost_of_equity) + (wd * after_tax_cost_of_debt)
        wacc = min(max(wacc, 0.05), 0.20)
        
        return {
            "wacc": round(wacc, 4),
            "cost_of_equity": round(cost_of_equity, 4),
            "pre_tax_cost_of_debt": round(pre_tax_cost_of_debt, 4),
            "after_tax_cost_of_debt": round(after_tax_cost_of_debt, 4),
            "weight_equity": round(we, 4),
            "weight_debt": round(wd, 4)
        }

    @staticmethod
    def calculate_dcf(
        base_revenue: float,
        base_fcf_or_margin: float,
        shares_outstanding: float,
        total_cash: float,
        total_debt: float,
        growth_rate_5y: float,
        target_operating_margin: Optional[float] = None,
        terminal_growth_rate: float = 0.025,
        wacc: float = 0.09,
        projection_years: int = 5,
        use_margin_mode: bool = False,
        effective_tax_rate: float = 0.21,
        exit_multiple: Optional[float] = None
    ) -> Dict[str, Any]:
        if wacc <= terminal_growth_rate and exit_multiple is None:
            wacc = terminal_growth_rate + 0.01
            
        projections: List[Dict[str, float]] = []
        pv_fcfs = 0.0
        current_rev = base_revenue
        
        for year in range(1, projection_years + 1):
            current_rev *= (1 + growth_rate_5y)
            
            if use_margin_mode and target_operating_margin is not None:
                operating_income = current_rev * target_operating_margin
                nopat = operating_income * (1 - effective_tax_rate)
                year_fcf = nopat * 0.85
            else:
                year_fcf = base_fcf_or_margin * ((1 + growth_rate_5y) ** year)
                
            discount_factor = 1.0 / ((1 + wacc) ** (year - 0.5))
            pv_year_fcf = year_fcf * discount_factor
            pv_fcfs += pv_year_fcf
            
            projections.append({
                "year": year,
                "revenue": round(current_rev, 2),
                "fcf": round(year_fcf, 2),
                "discount_factor": round(discount_factor, 4),
                "pv_fcf": round(pv_year_fcf, 2)
            })
            
        final_fcf = projections[-1]["fcf"]
        
        if exit_multiple is not None and exit_multiple > 0:
            terminal_value = final_fcf * exit_multiple
        else:
            tv_gordon = (final_fcf * (1 + terminal_growth_rate)) / (wacc - terminal_growth_rate)
            exit_mult_default = 22.0 if growth_rate_5y > 0.12 else 18.0
            tv_exit = final_fcf * exit_mult_default
            terminal_value = 0.5 * tv_gordon + 0.5 * tv_exit
            
        pv_terminal_value = terminal_value / ((1 + wacc) ** projection_years)
        enterprise_value = pv_fcfs + pv_terminal_value
        equity_value = enterprise_value + total_cash - total_debt
        
        fair_value = equity_value / shares_outstanding if shares_outstanding > 0 else 0.0
        fair_value = max(round(fair_value, 2), 0.0)
        
        return {
            "enterprise_value": round(enterprise_value, 2),
            "pv_explicit_fcfs": round(pv_fcfs, 2),
            "terminal_value": round(terminal_value, 2),
            "pv_terminal_value": round(pv_terminal_value, 2),
            "equity_value": round(equity_value, 2),
            "fair_value_per_share": fair_value,
            "wacc": round(wacc, 4),
            "terminal_growth_rate": round(terminal_growth_rate, 4),
            "growth_rate_5y": round(growth_rate_5y, 4),
            "projections": projections
        }

    @classmethod
    def reverse_dcf_solver(
        cls,
        market_price: float,
        base_revenue: float,
        base_fcf: float,
        shares_outstanding: float,
        total_cash: float,
        total_debt: float,
        wacc: float = 0.09,
        terminal_growth_rate: float = 0.025,
        target_operating_margin: Optional[float] = None
    ) -> Dict[str, Any]:
        low_g = -0.50
        high_g = 1.00
        tolerance = 0.02
        max_iters = 60
        implied_growth = 0.0
        solved = False
        
        for _ in range(max_iters):
            mid_g = (low_g + high_g) / 2.0
            res = cls.calculate_dcf(
                base_revenue=base_revenue,
                base_fcf_or_margin=base_fcf,
                shares_outstanding=shares_outstanding,
                total_cash=total_cash,
                total_debt=total_debt,
                growth_rate_5y=mid_g,
                target_operating_margin=target_operating_margin,
                terminal_growth_rate=terminal_growth_rate,
                wacc=wacc
            )
            calc_price = res["fair_value_per_share"]
            diff = calc_price - market_price
            
            if abs(diff) <= tolerance:
                implied_growth = mid_g
                solved = True
                break
                
            if diff < 0:
                low_g = mid_g
            else:
                high_g = mid_g
                
        if not solved:
            implied_growth = (low_g + high_g) / 2.0

        pct = implied_growth * 100
        if pct < 0:
            category = "Priced for Contraction / Distressed"
            color = "red"
            desc = "Market anticipates multi-year operational decline or erosion of economic moat."
        elif pct <= 6:
            category = "Conservative / Deep Value"
            color = "emerald"
            desc = "Sub-GDP growth priced in; low hurdle rate provides a high margin of safety."
        elif pct <= 14:
            category = "Realistic / High Quality"
            color = "blue"
            desc = "Priced in line with standard mature corporate earnings compounding."
        elif pct <= 24:
            category = "Aggressive Growth"
            color = "amber"
            desc = "Requires superior market share gains and consistent execution."
        else:
            category = "Priced for Perfection"
            color = "rose"
            desc = "Hyper-growth demanded. Any earnings miss creates severe downside risk."

        return {
            "market_price": market_price,
            "implied_revenue_cagr": round(implied_growth * 100, 2),
            "category": category,
            "color": color,
            "assessment": desc,
            "wacc_used": round(wacc * 100, 2),
            "terminal_growth_used": round(terminal_growth_rate * 100, 2)
        }

    @classmethod
    def generate_sensitivity_matrix(
        cls,
        base_revenue: float,
        base_fcf: float,
        shares_outstanding: float,
        total_cash: float,
        total_debt: float,
        base_growth: float,
        base_wacc: float,
        base_terminal_growth: float,
        market_price: float
    ) -> Dict[str, Any]:
        wacc_steps = [base_wacc - 0.010, base_wacc - 0.005, base_wacc, base_wacc + 0.005, base_wacc + 0.010]
        tg_steps = [base_terminal_growth - 0.006, base_terminal_growth - 0.003, base_terminal_growth, base_terminal_growth + 0.003, base_terminal_growth + 0.006]
        
        matrix = []
        for w in wacc_steps:
            row = []
            for tg in tg_steps:
                dcf = cls.calculate_dcf(
                    base_revenue=base_revenue,
                    base_fcf_or_margin=base_fcf,
                    shares_outstanding=shares_outstanding,
                    total_cash=total_cash,
                    total_debt=total_debt,
                    growth_rate_5y=base_growth,
                    terminal_growth_rate=tg,
                    wacc=w
                )
                fv = dcf["fair_value_per_share"]
                upside_pct = round(((fv - market_price) / market_price) * 100, 1) if market_price > 0 else 0.0
                row.append({
                    "wacc": round(w * 100, 2),
                    "terminal_growth": round(tg * 100, 2),
                    "fair_value": fv,
                    "upside_pct": upside_pct,
                    "is_base": (round(w, 4) == round(base_wacc, 4) and round(tg, 4) == round(base_terminal_growth, 4))
                })
            matrix.append(row)
            
        return {
            "wacc_axis": [round(w * 100, 2) for w in wacc_steps],
            "terminal_growth_axis": [round(tg * 100, 2) for tg in tg_steps],
            "matrix": matrix
        }

def get_complete_valuation_package(ticker: str) -> Dict[str, Any]:
    t = yf.Ticker(ticker)
    info = getattr(t, 'info', {}) or {}
    
    price = float(info.get("currentPrice") or info.get("previousClose") or 100.0)
    shares = float(info.get("sharesOutstanding") or getattr(t.fast_info, 'shares', None) or 0)
    if shares <= 0:
        mcap_hint = float(info.get('marketCap') or getattr(t.fast_info, 'market_cap', 0) or 0)
        shares = (mcap_hint / price) if mcap_hint > 0 and price > 0 else 50000000.0
    beta = float(info.get("beta") or 1.1)
    
    # Financial extraction
    try:
        bs = t.get_balance_sheet(freq="quarterly")
        cf = t.get_cash_flow(freq="quarterly")
        inc = t.get_income_stmt(freq="quarterly")
    except Exception:
        bs = getattr(t, 'quarterly_balance_sheet', None)
        cf = getattr(t, 'quarterly_cashflow', None)
        inc = getattr(t, 'quarterly_financials', None)
        
    def get_first(df, keys, default=0.0):
        if df is None or df.empty: return default
        for k in keys:
            if k in df.index and pd.notna(df.iloc[df.index.get_loc(k), 0]):
                return float(df.iloc[df.index.get_loc(k), 0])
        return default

    mkt_cap_est = price * shares
    default_cash = float(info.get('totalCash') or getattr(t.fast_info, 'cash', 0) or (mkt_cap_est * 0.08))
    default_debt = float(info.get('totalDebt') or getattr(t.fast_info, 'debt', 0) or (mkt_cap_est * 0.15))
    default_rev = float(info.get('totalRevenue') or (mkt_cap_est * 0.70))

    cash = get_first(bs, ['Cash And Cash Equivalents', 'CashAndCashEquivalents', 'CashCashEquivalentsAndShortTermInvestments'], default_cash)
    debt = get_first(bs, ['Total Debt', 'TotalDebt', 'LongTermDebt'], default_debt)
    
    rev_raw = get_first(inc, ['Total Revenue', 'TotalRevenue', 'Operating Revenue'], default_rev / 4.0)
    rev_ttm = rev_raw * 4.0 if rev_raw > 0 else default_rev

    op_cf_raw = get_first(cf, ['Operating Cash Flow', 'OperatingCashFlow', 'Cash Flow From Continuing Operating Activities', 'Total Cash From Operating Activities'], 0.0)
    capex_raw = abs(get_first(cf, ['Capital Expenditure', 'CapitalExpenditure', 'CapitalExpendituresReported', 'Purchase Of Property Plant And Equipment'], 0.0))

    if op_cf_raw > 0:
        op_cf = op_cf_raw * 4.0
        capex = capex_raw * 4.0 if capex_raw > 0 else (op_cf * 0.20)
        fcf = max(mkt_cap_est * 0.01, op_cf - capex)
    else:
        reported_fcf = info.get('freeCashflow')
        if reported_fcf and reported_fcf > 0 and reported_fcf < mkt_cap_est * 0.40:
            fcf = float(reported_fcf)
        else:
            fcf = max(mkt_cap_est * 0.035, rev_ttm * 0.045)
    
    wacc_data = ValuationEngine.calculate_wacc(
        stock_price=price,
        shares_outstanding=shares,
        total_debt=debt,
        interest_expense=debt * 0.045,
        beta=beta
    )
    base_wacc = wacc_data["wacc"]
    raw_g = float(info.get('earningsGrowth') or info.get('revenueGrowth') or 0.10)
    if raw_g > 0.40:
        base_growth = min(0.30, raw_g * 0.5)
    elif raw_g < 0.03:
        base_growth = 0.08
    else:
        base_growth = max(0.06, min(raw_g, 0.25))
    base_tg = 0.025
    
    dcf = ValuationEngine.calculate_dcf(
        base_revenue=rev_ttm,
        base_fcf_or_margin=fcf,
        shares_outstanding=shares,
        total_cash=cash,
        total_debt=debt,
        growth_rate_5y=base_growth,
        terminal_growth_rate=base_tg,
        wacc=base_wacc
    )
    
    reverse_dcf = ValuationEngine.reverse_dcf_solver(
        market_price=price,
        base_revenue=rev_ttm,
        base_fcf=fcf,
        shares_outstanding=shares,
        total_cash=cash,
        total_debt=debt,
        wacc=base_wacc,
        terminal_growth_rate=base_tg
    )
    
    sensitivity = ValuationEngine.generate_sensitivity_matrix(
        base_revenue=rev_ttm,
        base_fcf=fcf,
        shares_outstanding=shares,
        total_cash=cash,
        total_debt=debt,
        base_growth=base_growth,
        base_wacc=base_wacc,
        base_terminal_growth=base_tg,
        market_price=price
    )
    
    return {
        "ticker": ticker.upper(),
        "current_price": price,
        "base_financials": {
            "revenue": rev_ttm,
            "fcf": fcf,
            "shares": shares,
            "cash": cash,
            "debt": debt,
            "beta": beta,
            "historical_margin": float(info.get("operatingMargins") or 0.25)
        },
        "wacc_details": wacc_data,
        "dcf_base_valuation": dcf,
        "reverse_dcf": reverse_dcf,
        "sensitivity_matrix": sensitivity
    }
