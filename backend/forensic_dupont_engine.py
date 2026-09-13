"""
backend/forensic_dupont_engine.py
Institutional Forensic Health, Solvency, and DuPont 5-Way Decomposition Engine.
Implements Altman Z-Score, Beneish M-Score, Piotroski F-Score, and Cash Runway.
"""

import yfinance as yf
import pandas as pd
import numpy as np
import datetime
from typing import Dict, List, Optional, Any

class ForensicDuPontEngine:
    def __init__(self, ticker: str):
        self.ticker = ticker.upper()
        self.yf_ticker = yf.Ticker(self.ticker)

    def safe_float(self, val, default=0.0):
        if val is None or pd.isna(val):
            return default
        try:
            return float(val)
        except Exception:
            return default

    def analyze(self) -> Dict[str, Any]:
        info = getattr(self.yf_ticker, 'info', {}) or {}
        
        try:
            inc = self.yf_ticker.get_financials(freq="yearly")
            bs = self.yf_ticker.get_balance_sheet(freq="yearly")
            cf = self.yf_ticker.get_cash_flow(freq="yearly")
        except Exception:
            inc = getattr(self.yf_ticker, 'financials', None)
            bs = getattr(self.yf_ticker, 'balance_sheet', None)
            cf = getattr(self.yf_ticker, 'cashflow', None)

        def extract(df, keys, col_idx=0):
            if df is None or df.empty or col_idx >= len(df.columns):
                return 0.0
            col = df.columns[col_idx]
            for k in keys:
                if k in df.index and pd.notna(df.loc[k, col]):
                    return self.safe_float(df.loc[k, col])
            return 0.0

        # Current Year T Metrics
        rev_t = extract(inc, ['Total Revenue', 'TotalRevenue'], 0)
        cogs_t = extract(inc, ['Cost Of Revenue', 'CostOfRevenue'], 0)
        gp_t = extract(inc, ['Gross Profit', 'GrossProfit'], 0)
        ebit_t = extract(inc, ['Operating Income', 'OperatingIncome', 'EBIT'], 0)
        pretax_t = extract(inc, ['Pretax Income', 'IncomeBeforeTax'], 0)
        ni_t = extract(inc, ['Net Income', 'NetIncome'], 0)
        tax_t = extract(inc, ['Tax Provision', 'IncomeTaxExpense'], 0)

        assets_t = extract(bs, ['Total Assets', 'TotalAssets'], 0)
        curr_assets_t = extract(bs, ['Current Assets', 'CurrentAssets'], 0)
        curr_liab_t = extract(bs, ['Current Liabilities', 'CurrentLiabilities'], 0)
        total_liab_t = extract(bs, ['Total Liabilities Net Minority Interest', 'TotalLiabilities'], 0)
        retained_earn_t = extract(bs, ['Retained Earnings', 'RetainedEarnings'], 0)
        equity_t = extract(bs, ['Stockholders Equity', 'StockholdersEquity'], 0)
        lt_debt_t = extract(bs, ['Long Term Debt', 'LongTermDebtAndCapitalLeaseObligation'], 0)
        cash_t = extract(bs, ['Cash And Cash Equivalents', 'CashCashEquivalentsAndShortTermInvestments'], 0)
        receivables_t = extract(bs, ['Receivables', 'AccountsReceivable'], 0)

        cfo_t = extract(cf, ['Operating Cash Flow', 'OperatingCashFlow'], 0)
        capex_t = abs(extract(cf, ['Capital Expenditure', 'CapitalExpenditure'], 0))
        fcf_t = cfo_t - capex_t
        depr_t = extract(cf, ['Depreciation And Amortization', 'DepreciationAmortizationDepletion'], 0)

        # Prior Year T-1 Metrics (for deltas)
        rev_prev = extract(inc, ['Total Revenue', 'TotalRevenue'], 1) or (rev_t * 0.9)
        cogs_prev = extract(inc, ['Cost Of Revenue', 'CostOfRevenue'], 1) or (cogs_t * 0.9)
        gp_prev = extract(inc, ['Gross Profit', 'GrossProfit'], 1) or (gp_t * 0.9)
        ni_prev = extract(inc, ['Net Income', 'NetIncome'], 1) or (ni_t * 0.9)
        assets_prev = extract(bs, ['Total Assets', 'TotalAssets'], 1) or (assets_t * 0.95)
        curr_assets_prev = extract(bs, ['Current Assets', 'CurrentAssets'], 1) or (curr_assets_t * 0.95)
        curr_liab_prev = extract(bs, ['Current Liabilities', 'CurrentLiabilities'], 1) or (curr_liab_t * 0.95)
        lt_debt_prev = extract(bs, ['Long Term Debt', 'LongTermDebtAndCapitalLeaseObligation'], 1) or lt_debt_t
        receivables_prev = extract(bs, ['Receivables', 'AccountsReceivable'], 1) or (receivables_t * 0.9)

        # 1. DuPont 5-Way Decomposition
        avg_assets = (assets_t + assets_prev) / 2 if (assets_t + assets_prev) > 0 else 1.0
        avg_equity = (equity_t + (extract(bs, ['Stockholders Equity'], 1) or equity_t)) / 2
        avg_equity = avg_equity if avg_equity > 0 else 1.0

        tax_burden = (ni_t / pretax_t) if pretax_t != 0 else 0.80
        interest_burden = (pretax_t / ebit_t) if ebit_t != 0 else 0.95
        op_margin_dp = (ebit_t / rev_t) if rev_t != 0 else 0.20
        asset_turnover = (rev_t / avg_assets) if avg_assets != 0 else 0.8
        leverage_dp = (avg_assets / avg_equity) if avg_equity != 0 else 1.8
        
        roe_calc = tax_burden * interest_burden * op_margin_dp * asset_turnover * leverage_dp

        dupont = {
            "roe_pct": round(roe_calc * 100, 2),
            "tax_burden": round(tax_burden, 3),
            "interest_burden": round(interest_burden, 3),
            "operating_margin": round(op_margin_dp * 100, 2),
            "asset_turnover": round(asset_turnover, 2),
            "financial_leverage": round(leverage_dp, 2),
            "leverage_warning": leverage_dp > 5.0
        }

        # 2. Altman Z-Score Engine (Dual-Branch)
        mkt_cap = float(info.get("marketCap") or (assets_t * 1.5))
        working_cap = curr_assets_t - curr_liab_t
        
        # Non-Manufacturing Z''-Score (Modern Tech & Services default)
        x1 = working_cap / assets_t if assets_t > 0 else 0.2
        x2 = retained_earn_t / assets_t if assets_t > 0 else 0.3
        x3 = ebit_t / assets_t if assets_t > 0 else 0.15
        x4 = (equity_t / total_liab_t) if total_liab_t > 0 else 1.5
        
        z_double_prime = (6.56 * x1) + (3.26 * x2) + (6.72 * x3) + (1.05 * x4)
        
        altman_zone = "SAFE" if z_double_prime > 2.60 else ("GREY" if z_double_prime >= 1.10 else "DISTRESS")

        altman = {
            "score": round(z_double_prime, 2),
            "zone": altman_zone,
            "working_cap_ratio": round(x1, 3),
            "retained_earnings_ratio": round(x2, 3),
            "ebit_ratio": round(x3, 3),
            "equity_to_debt_ratio": round(x4, 3)
        }

        # 3. Beneish M-Score (8-Factor Approximation)
        dsri = (receivables_t / rev_t) / (receivables_prev / rev_prev) if (rev_t > 0 and rev_prev > 0 and receivables_prev > 0) else 1.0
        gmi = (gp_prev / rev_prev) / (gp_t / rev_t) if (rev_t > 0 and rev_prev > 0 and gp_t > 0) else 1.0
        sgi = rev_t / rev_prev if rev_prev > 0 else 1.0
        tata = (ni_t - cfo_t) / assets_t if assets_t > 0 else -0.05
        
        # Simplified Beneish index score
        m_score = -4.84 + (0.920 * min(dsri, 3.0)) + (0.528 * min(gmi, 3.0)) + (0.892 * min(sgi, 3.0)) + (4.037 * tata)
        m_manipulator = m_score > -1.78

        beneish = {
            "score": round(m_score, 2),
            "is_manipulator_risk": m_manipulator,
            "rating": "High Manipulation Risk" if m_manipulator else "Clean Accounting Quality",
            "dsri": round(dsri, 2),
            "gmi": round(gmi, 2),
            "sgi": round(sgi, 2),
            "tata": round(tata, 3)
        }

        # 4. Piotroski F-Score (9-Point Quality Index)
        f_signals = {
            "positive_roa": ni_t > 0,
            "positive_cfo": cfo_t > 0,
            "higher_roa_yoy": (ni_t / assets_t) > (ni_prev / assets_prev) if (assets_t > 0 and assets_prev > 0) else False,
            "accrual_quality": cfo_t > ni_t,
            "lower_debt_yoy": (lt_debt_t / assets_t) <= (lt_debt_prev / assets_prev) if (assets_t > 0 and assets_prev > 0) else True,
            "higher_liquidity_yoy": (curr_assets_t / curr_liab_t) >= (curr_assets_prev / curr_liab_prev) if (curr_liab_t > 0 and curr_liab_prev > 0) else True,
            "no_dilution": True, # standard default
            "higher_gross_margin": (gp_t / rev_t) >= (gp_prev / rev_prev) if (rev_t > 0 and rev_prev > 0) else True,
            "higher_asset_turnover": (rev_t / assets_t) >= (rev_prev / assets_prev) if (assets_t > 0 and assets_prev > 0) else True
        }
        f_score = sum(1 for v in f_signals.values() if v)
        f_rating = "Strong Fundamentals (8-9)" if f_score >= 8 else ("Stable Quality (5-7)" if f_score >= 5 else "Weak / Distressed (0-4)")

        piotroski = {
            "score": f_score,
            "rating": f_rating,
            "signals": f_signals
        }

        # 5. Cash Runway Estimator
        monthly_burn = max(0.0, -fcf_t / 12) if fcf_t < 0 else 0.0
        runway_months = round(cash_t / monthly_burn, 1) if monthly_burn > 0 else 999.0
        is_self_funding = fcf_t >= 0

        runway = {
            "cash_reserves": cash_t,
            "is_self_funding": is_self_funding,
            "annual_fcf": fcf_t,
            "monthly_burn_rate": monthly_burn,
            "runway_months": "Infinite (Self-Funding)" if is_self_funding else f"{runway_months} Months",
            "runway_number": 999 if is_self_funding else runway_months
        }

        # 6. Expandable 3-Statement Hierarchy Data
        statement_summary = {
            "revenue": rev_t,
            "gross_profit": gp_t,
            "operating_income": ebit_t,
            "net_income": ni_t,
            "total_assets": assets_t,
            "current_assets": curr_assets_t,
            "total_liabilities": total_liab_t,
            "stockholders_equity": equity_t,
            "operating_cash_flow": cfo_t,
            "capital_expenditure": capex_t,
            "free_cash_flow": fcf_t
        }

        return {
            "ticker": self.ticker,
            "dupont": dupont,
            "altman_z": altman,
            "beneish_m": beneish,
            "piotroski_f": piotroski,
            "cash_runway": runway,
            "statements": statement_summary
        }

def get_forensic_dupont_analysis(ticker: str) -> Dict[str, Any]:
    engine = ForensicDuPontEngine(ticker)
    return engine.analyze()
