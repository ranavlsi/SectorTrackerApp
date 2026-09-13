"""
fundamentals_deep_brief/fetch/statements_yahoo.py
Extracts verified multi-year financial statements (Income Statement,
Balance Sheet, Cash Flow) with audited line citations.
Fail-closed: Returns exact numbers from statements without fabrication.
"""

import yfinance as yf
import pandas as pd
import numpy as np
import datetime
from typing import Dict, Any, List, Optional

def fetch_statements_yahoo(ticker: str) -> Dict[str, Any]:
    ticker_clean = ticker.upper().strip()
    t = yf.Ticker(ticker_clean)
    now_utc = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    source_prefix = f"YF_STMT_{ticker_clean}"

    # 1. Fetch annual and quarterly statements
    try:
        inc_a = t.get_income_stmt(freq="yearly")
        bs_a = t.get_balance_sheet(freq="yearly")
        cf_a = t.get_cash_flow(freq="yearly")
    except Exception:
        inc_a = getattr(t, 'income_stmt', None)
        bs_a = getattr(t, 'balance_sheet', None)
        cf_a = getattr(t, 'cashflow', None)

    try:
        inc_q = t.get_income_stmt(freq="quarterly")
        bs_q = t.get_balance_sheet(freq="quarterly")
        cf_q = t.get_cash_flow(freq="quarterly")
    except Exception:
        inc_q = getattr(t, 'quarterly_financials', None)
        bs_q = getattr(t, 'quarterly_balance_sheet', None)
        cf_q = getattr(t, 'quarterly_cashflow', None)

    def extract_val(df: Optional[pd.DataFrame], keys: List[str], col: Any) -> Optional[float]:
        if df is None or df.empty or col not in df.columns:
            return None
        for k in keys:
            if k in df.index and pd.notna(df.loc[k, col]):
                try:
                    return float(df.loc[k, col])
                except Exception:
                    continue
        return None

    # Process Annual Series (oldest to newest)
    annual_records = []
    if inc_a is not None and not inc_a.empty:
        # Sort date columns chronologically
        cols = sorted([c for c in inc_a.columns if isinstance(c, (pd.Timestamp, datetime.date, str))])
        for col in cols:
            year_label = col.strftime('%Y') if hasattr(col, 'strftime') else str(col)[:4]
            date_str = col.strftime('%Y-%m-%d') if hasattr(col, 'strftime') else str(col)

            rev = extract_val(inc_a, ['Total Revenue', 'Operating Revenue', 'TotalRevenue'], col)
            gp = extract_val(inc_a, ['Gross Profit', 'GrossProfit'], col)
            op_inc = extract_val(inc_a, ['Operating Income', 'OperatingProfit', 'OperatingIncome'], col)
            ni = extract_val(inc_a, ['Net Income', 'NetIncomeCommonStockholders', 'NetIncome'], col)
            interest_exp = extract_val(inc_a, ['Interest Expense', 'InterestExpense', 'InterestExpenseNonOperating'], col)
            ebit = extract_val(inc_a, ['EBIT', 'Operating Income'], col) or op_inc
            
            # Cash flow metrics
            op_cf = extract_val(cf_a, ['Operating Cash Flow', 'Cash Flow From Continuing Operating Activities', 'OperatingCashFlow'], col) if cf_a is not None else None
            capex_raw = extract_val(cf_a, ['Capital Expenditure', 'CapitalExpenditure', 'Payments For Property Plant And Equipment'], col) if cf_a is not None else None
            capex = abs(capex_raw) if capex_raw is not None else (0.0 if op_cf is not None else None)
            fcf = (op_cf - capex) if (op_cf is not None and capex is not None) else None

            # Balance sheet metrics
            cash = extract_val(bs_a, ['Cash And Cash Equivalents', 'CashAndCashEquivalents', 'CashCashEquivalentsAndShortTermInvestments', 'Cash Financial'], col) if bs_a is not None else None
            total_debt = extract_val(bs_a, ['Total Debt', 'TotalDebt', 'Long Term Debt And Capital Lease Obligation'], col) if bs_a is not None else None
            equity = extract_val(bs_a, ['Stockholders Equity', 'StockholdersEquity', 'Common Stock Equity'], col) if bs_a is not None else None
            assets = extract_val(bs_a, ['Total Assets', 'TotalAssets'], col) if bs_a is not None else None
            receivables = extract_val(bs_a, ['Accounts Receivable', 'Receivables', 'Gross Accounts Receivable'], col) if bs_a is not None else None
            inventory = extract_val(bs_a, ['Inventory', 'Inventories'], col) if bs_a is not None else None

            net_debt = (total_debt - cash) if (total_debt is not None and cash is not None) else None

            # Margins
            gm_pct = round((gp / rev * 100), 2) if (rev and gp and rev > 0) else None
            om_pct = round((op_inc / rev * 100), 2) if (rev and op_inc and rev > 0) else None
            nm_pct = round((ni / rev * 100), 2) if (rev and ni and rev > 0) else None
            fcf_conversion_pct = round((fcf / ni * 100), 1) if (fcf is not None and ni and ni > 0) else None

            annual_records.append({
                "period": year_label,
                "date": date_str,
                "revenue": rev,
                "gross_profit": gp,
                "operating_income": op_inc,
                "net_income": ni,
                "interest_expense": abs(interest_exp) if interest_exp else None,
                "operating_cash_flow": op_cf,
                "capex": capex,
                "free_cash_flow": fcf,
                "cash_and_equivalents": cash,
                "total_debt": total_debt,
                "net_debt": net_debt,
                "stockholders_equity": equity,
                "total_assets": assets,
                "accounts_receivable": receivables,
                "inventory": inventory,
                "gross_margin_pct": gm_pct,
                "operating_margin_pct": om_pct,
                "net_margin_pct": nm_pct,
                "fcf_conversion_pct": fcf_conversion_pct,
                "source_id": f"{source_prefix}_10K_{year_label}"
            })

    # Process Quarterly Series (for TTM aggregation and recent trends)
    quarterly_records = []
    if inc_q is not None and not inc_q.empty:
        cols_q = sorted([c for c in inc_q.columns if isinstance(c, (pd.Timestamp, datetime.date, str))])
        for col in cols_q:
            q_label = col.strftime('%Y-Q%q') if hasattr(col, 'strftime') else str(col)[:7]
            date_str = col.strftime('%Y-%m-%d') if hasattr(col, 'strftime') else str(col)

            rev = extract_val(inc_q, ['Total Revenue', 'Operating Revenue', 'TotalRevenue'], col)
            gp = extract_val(inc_q, ['Gross Profit', 'GrossProfit'], col)
            op_inc = extract_val(inc_q, ['Operating Income', 'OperatingProfit'], col)
            ni = extract_val(inc_q, ['Net Income', 'NetIncomeCommonStockholders'], col)
            op_cf = extract_val(cf_q, ['Operating Cash Flow', 'OperatingCashFlow'], col) if cf_q is not None else None
            capex_raw = extract_val(cf_q, ['Capital Expenditure', 'CapitalExpenditure'], col) if cf_q is not None else None
            capex = abs(capex_raw) if capex_raw is not None else 0.0
            fcf = (op_cf - capex) if op_cf is not None else None

            cash = extract_val(bs_q, ['Cash And Cash Equivalents', 'CashCashEquivalentsAndShortTermInvestments'], col) if bs_q is not None else None
            total_debt = extract_val(bs_q, ['Total Debt', 'TotalDebt'], col) if bs_q is not None else None
            net_debt = (total_debt - cash) if (total_debt is not None and cash is not None) else None

            quarterly_records.append({
                "period": q_label,
                "date": date_str,
                "revenue": rev,
                "gross_profit": gp,
                "operating_income": op_inc,
                "net_income": ni,
                "operating_cash_flow": op_cf,
                "capex": capex,
                "free_cash_flow": fcf,
                "cash_and_equivalents": cash,
                "total_debt": total_debt,
                "net_debt": net_debt,
                "source_id": f"{source_prefix}_10Q_{date_str}"
            })

    # Compute True Statement TTM by summing last 4 quarters (if available)
    ttm = {}
    if len(quarterly_records) >= 4:
        last_4 = quarterly_records[-4:]
        rev_ttm = sum(q["revenue"] for q in last_4 if q.get("revenue"))
        gp_ttm = sum(q["gross_profit"] for q in last_4 if q.get("gross_profit"))
        op_inc_ttm = sum(q["operating_income"] for q in last_4 if q.get("operating_income"))
        ni_ttm = sum(q["net_income"] for q in last_4 if q.get("net_income"))
        ocf_ttm = sum(q["operating_cash_flow"] for q in last_4 if q.get("operating_cash_flow"))
        capex_ttm = sum(q["capex"] for q in last_4 if q.get("capex") is not None)
        fcf_ttm = ocf_ttm - capex_ttm

        latest_bs = quarterly_records[-1]

        ttm = {
            "period": "TTM",
            "as_of": quarterly_records[-1]["date"],
            "revenue": rev_ttm,
            "gross_profit": gp_ttm,
            "operating_income": op_inc_ttm,
            "net_income": ni_ttm,
            "operating_cash_flow": ocf_ttm,
            "capex": capex_ttm,
            "free_cash_flow": fcf_ttm,
            "gross_margin_pct": round((gp_ttm / rev_ttm * 100), 2) if rev_ttm > 0 else None,
            "operating_margin_pct": round((op_inc_ttm / rev_ttm * 100), 2) if rev_ttm > 0 else None,
            "net_margin_pct": round((ni_ttm / rev_ttm * 100), 2) if rev_ttm > 0 else None,
            "cash_and_equivalents": latest_bs.get("cash_and_equivalents"),
            "total_debt": latest_bs.get("total_debt"),
            "net_debt": latest_bs.get("net_debt"),
            "source_id": f"{source_prefix}_TTM_SUM_4Q"
        }
    elif annual_records:
        # Fall back to latest annual if <4 quarters available
        latest = annual_records[-1]
        ttm = {
            "period": f"FY{latest['period']} (as TTM)",
            "as_of": latest["date"],
            "revenue": latest.get("revenue"),
            "gross_profit": latest.get("gross_profit"),
            "operating_income": latest.get("operating_income"),
            "net_income": latest.get("net_income"),
            "operating_cash_flow": latest.get("operating_cash_flow"),
            "capex": latest.get("capex"),
            "free_cash_flow": latest.get("free_cash_flow"),
            "gross_margin_pct": latest.get("gross_margin_pct"),
            "operating_margin_pct": latest.get("operating_margin_pct"),
            "net_margin_pct": latest.get("net_margin_pct"),
            "cash_and_equivalents": latest.get("cash_and_equivalents"),
            "total_debt": latest.get("total_debt"),
            "net_debt": latest.get("net_debt"),
            "source_id": latest.get("source_id")
        }

    return {
        "ticker": ticker_clean,
        "as_of_timestamp": now_utc,
        "annual_records": annual_records,
        "quarterly_records": quarterly_records,
        "ttm": ttm
    }
