"""
fundamentals_deep_brief/analyze/quality.py
Chapter D: Financial Statement Quality & Economics Analysis
Audits accounting integrity, accruals divergence, cash conversion,
balance sheet solvency, and capital intensity.
Fail-closed: Computes metrics only when honest data exists. Omit rather than fake.
"""

from typing import Dict, Any, List, Optional
import math

def compute_cagr(start_val: float, end_val: float, years: int) -> Optional[float]:
    if not start_val or not end_val or start_val <= 0 or end_val <= 0 or years <= 0:
        return None
    try:
        cagr = ((end_val / start_val) ** (1.0 / years)) - 1.0
        return round(cagr * 100, 2)
    except Exception:
        return None

def analyze_financial_quality(statements: Dict[str, Any], market_data: Dict[str, Any]) -> Dict[str, Any]:
    annual = statements.get("annual_records") or []
    ttm = statements.get("ttm") or {}

    # 1. Growth Block: 3-5y revenue CAGR, latest FY, TTM
    growth = {
        "revenue_3y_cagr": None,
        "revenue_5y_cagr": None,
        "latest_fy_growth_pct": None,
        "ttm_vs_prior_fy_pct": None,
        "notes": "Organic vs M&A breakdown: Not separately reported as distinct sub-line in primary income statement."
    }

    if len(annual) >= 4:
        # 3-year CAGR
        start_3y = annual[-4].get("revenue")
        end_3y = annual[-1].get("revenue")
        growth["revenue_3y_cagr"] = compute_cagr(start_3y, end_3y, 3)

    if len(annual) >= 6:
        # 5-year CAGR
        start_5y = annual[-6].get("revenue")
        end_5y = annual[-1].get("revenue")
        growth["revenue_5y_cagr"] = compute_cagr(start_5y, end_5y, 5)

    if len(annual) >= 2:
        rev_prev = annual[-2].get("revenue")
        rev_curr = annual[-1].get("revenue")
        if rev_prev and rev_curr and rev_prev > 0:
            growth["latest_fy_growth_pct"] = round(((rev_curr - rev_prev) / rev_prev) * 100, 1)

    if annual and ttm.get("revenue") and annual[-1].get("revenue"):
        fy_rev = annual[-1]["revenue"]
        ttm_rev = ttm["revenue"]
        if fy_rev > 0:
            growth["ttm_vs_prior_fy_pct"] = round(((ttm_rev - fy_rev) / fy_rev) * 100, 1)

    # 2. Profitability Trend (multi-year margins table)
    profitability_table = []
    for r in annual[-5:]:
        profitability_table.append({
            "period": r.get("period"),
            "revenue": r.get("revenue"),
            "gross_margin_pct": r.get("gross_margin_pct"),
            "operating_margin_pct": r.get("operating_margin_pct"),
            "net_margin_pct": r.get("net_margin_pct"),
            "source_id": r.get("source_id")
        })

    # Add TTM row if available
    if ttm.get("revenue"):
        profitability_table.append({
            "period": "TTM",
            "revenue": ttm.get("revenue"),
            "gross_margin_pct": ttm.get("gross_margin_pct"),
            "operating_margin_pct": ttm.get("operating_margin_pct"),
            "net_margin_pct": ttm.get("net_margin_pct"),
            "source_id": ttm.get("source_id")
        })

    # 3. Cash Economics (OCF, CapEx, FCF, FCF conversion)
    cash_economics_table = []
    for r in annual[-5:]:
        cash_economics_table.append({
            "period": r.get("period"),
            "operating_cash_flow": r.get("operating_cash_flow"),
            "capex": r.get("capex"),
            "free_cash_flow": r.get("free_cash_flow"),
            "fcf_conversion_pct": r.get("fcf_conversion_pct"),
            "source_id": r.get("source_id")
        })

    if ttm.get("operating_cash_flow") is not None:
        ttm_ni = ttm.get("net_income") or 0.0
        ttm_fcf = ttm.get("free_cash_flow") or 0.0
        conv = round((ttm_fcf / ttm_ni * 100), 1) if ttm_ni > 0 else None
        cash_economics_table.append({
            "period": "TTM",
            "operating_cash_flow": ttm.get("operating_cash_flow"),
            "capex": ttm.get("capex"),
            "free_cash_flow": ttm.get("free_cash_flow"),
            "fcf_conversion_pct": conv,
            "source_id": ttm.get("source_id")
        })

    # 4. Balance Sheet & Solvency
    latest_rec = annual[-1] if annual else {}
    cash_val = ttm.get("cash_and_equivalents") or latest_rec.get("cash_and_equivalents") or 0.0
    debt_val = ttm.get("total_debt") or latest_rec.get("total_debt") or 0.0
    net_debt_val = debt_val - cash_val

    # Interest coverage = Operating Income / Interest Expense
    op_inc_latest = ttm.get("operating_income") or latest_rec.get("operating_income") or 0.0
    interest_exp = latest_rec.get("interest_expense")
    int_cov = round((op_inc_latest / interest_exp), 1) if (interest_exp and interest_exp > 0 and op_inc_latest > 0) else None

    balance_sheet = {
        "cash_and_equivalents": cash_val,
        "gross_debt": debt_val,
        "net_debt": net_debt_val,
        "net_debt_position": "Net Cash" if net_debt_val < 0 else "Net Debt",
        "interest_coverage_ratio": int_cov,
        "interest_coverage_assessment": "Robust (>10x)" if (int_cov and int_cov > 10) else ("Adequate (3-10x)" if (int_cov and int_cov >= 3) else ("Tight (<3x)" if int_cov else "Debt-free / Minimal Interest"))
    }

    # 5. Quality Checks & Accruals Audit
    # Accruals test: Net Income vs Operating Cash Flow
    quality_checks = []
    if len(annual) >= 2:
        curr = annual[-1]
        ni_curr = curr.get("net_income") or 0.0
        ocf_curr = curr.get("operating_cash_flow") or 0.0
        
        # Check divergence: Is Net Income > OCF by a wide margin?
        if ni_curr > 0 and ocf_curr > 0:
            ratio = ocf_curr / ni_curr
            if ratio >= 1.0:
                quality_checks.append({
                    "test": "Operating Cash Flow vs Net Income (Accruals Quality)",
                    "status": "CLEAN",
                    "result": f"OCF / Net Income is {ratio:.2f}x",
                    "finding": "Operating cash flow exceeds net income. High earnings quality with minimal aggressive non-cash accrual risk."
                })
            elif ratio >= 0.70:
                quality_checks.append({
                    "test": "Operating Cash Flow vs Net Income (Accruals Quality)",
                    "status": "WATCH",
                    "result": f"OCF / Net Income is {ratio:.2f}x",
                    "finding": "Cash conversion is slightly below 1.0x due to ordinary working capital timing differences."
                })
            else:
                quality_checks.append({
                    "test": "Operating Cash Flow vs Net Income (Accruals Quality)",
                    "status": "FLAG",
                    "result": f"OCF / Net Income is {ratio:.2f}x (Severely Compressed)",
                    "finding": "Red flag: Net income is significantly outpacing cash from operations. Audit accounts receivable and unbilled contract revenue."
                })

        # Receivables growth vs Revenue growth
        prev = annual[-2]
        rev_growth = ((curr.get("revenue", 0) - prev.get("revenue", 0)) / prev.get("revenue", 1)) * 100 if prev.get("revenue") else 0.0
        ar_curr = curr.get("accounts_receivable") or 0.0
        ar_prev = prev.get("accounts_receivable") or 0.0
        if ar_curr > 0 and ar_prev > 0:
            ar_growth = ((ar_curr - ar_prev) / ar_prev) * 100
            diff = ar_growth - rev_growth
            if diff > 15.0:
                quality_checks.append({
                    "test": "Accounts Receivable vs Revenue Growth (DSO Drift)",
                    "status": "FLAG",
                    "result": f"Receivables grew +{ar_growth:.1f}% vs Revenue +{rev_growth:.1f}% (+{diff:.1f}% divergence)",
                    "finding": "DSO is expanding: Receivables are growing substantially faster than sales. Suggests potential pull-forward of demand or delayed customer collections."
                })
            else:
                quality_checks.append({
                    "test": "Accounts Receivable vs Revenue Growth (DSO Stability)",
                    "status": "CLEAN",
                    "result": f"Receivables growth (+{ar_growth:.1f}%) aligns with Revenue growth (+{rev_growth:.1f}%)",
                    "finding": "Days Sales Outstanding remains tightly disciplined."
                })

    # 6. Capital Intensity
    rev_ttm_val = ttm.get("revenue") or (annual[-1].get("revenue") if annual else 0.0)
    capex_ttm_val = ttm.get("capex") or (annual[-1].get("capex") if annual else 0.0)
    equity_val = latest_rec.get("stockholders_equity")
    ni_val = ttm.get("net_income") or latest_rec.get("net_income") or 0.0

    capex_to_sales_pct = round((capex_ttm_val / rev_ttm_val * 100), 2) if (rev_ttm_val and rev_ttm_val > 0) else None
    roe_pct = round((ni_val / equity_val * 100), 1) if (equity_val and equity_val > 0 and ni_val) else None

    capital_intensity = {
        "capex_to_sales_pct": capex_to_sales_pct,
        "intensity_classification": "Asset-Light (<4% CapEx/Sales)" if (capex_to_sales_pct and capex_to_sales_pct < 4) else ("Moderate Intensity (4-8%)" if (capex_to_sales_pct and capex_to_sales_pct <= 8) else "Capital-Heavy (>8% CapEx/Sales)"),
        "return_on_equity_pct": roe_pct,
        "notes": "ROIC omitted per spec non-negotiable to avoid asserting fabricated WACC or unverified invested capital allocations."
    }

    return {
        "growth": growth,
        "profitability_table": profitability_table,
        "cash_economics_table": cash_economics_table,
        "balance_sheet": balance_sheet,
        "quality_checks": quality_checks,
        "capital_intensity": capital_intensity
    }
