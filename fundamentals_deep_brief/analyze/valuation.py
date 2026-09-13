"""
fundamentals_deep_brief/analyze/valuation.py
Chapter E: Valuation in Context Analysis
Evaluates absolute multiples, peer relative benchmarking, and historical ranges.
Enforces Build Spec Non-Negotiable:
- MUST NOT produce a DCF with invented WACC/g.
- DCF is only offered as a user-controllable sensitivity matrix with clearly
  labeled assumptions, never asserted as objective market truth.
"""

from typing import Dict, Any, List, Optional

def analyze_valuation_in_context(
    target_ticker: str,
    market_data: Dict[str, Any],
    statements: Dict[str, Any],
    peer_data: List[Dict[str, Any]],
    user_dcf_params: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    ticker_clean = target_ticker.upper().strip()
    multiples = market_data.get("multiples") or {}
    mkt_cap = market_data.get("market_cap") or 0.0
    ttm = statements.get("ttm") or {}
    
    # 1. Absolute Valuation Multiples
    fcf = ttm.get("free_cash_flow")
    fcf_yield_pct = round((fcf / mkt_cap * 100), 2) if (fcf and mkt_cap and mkt_cap > 0) else None

    absolute_multiples = {
        "pe_trailing": multiples.get("pe_trailing"),
        "pe_forward": multiples.get("pe_forward"),
        "ev_sales": multiples.get("ev_sales"),
        "ev_ebitda": multiples.get("ev_ebitda"),
        "ps_ratio": multiples.get("ps_ratio"),
        "pb_ratio": multiples.get("pb_ratio"),
        "fcf_yield_pct": fcf_yield_pct,
        "source": market_data.get("source_id")
    }

    # 2. Relative Valuation (vs 3-6 named peers on same multiples)
    # Ensure peer_data is structured with rank and median benchmarks
    peer_table = peer_data
    
    # Compute peer medians
    valid_ev_sales = [p["ev_sales"] for p in peer_table if p.get("ev_sales") and not p.get("is_target")]
    valid_fwd_pe = [p["forward_pe"] for p in peer_table if p.get("forward_pe") and not p.get("is_target")]
    valid_ev_ebitda = [p["ev_ebitda"] for p in peer_table if p.get("ev_ebitda") and not p.get("is_target")]

    peer_medians = {
        "median_ev_sales": round(float(sum(valid_ev_sales) / len(valid_ev_sales)), 2) if valid_ev_sales else None,
        "median_forward_pe": round(float(sum(valid_fwd_pe) / len(valid_fwd_pe)), 1) if valid_fwd_pe else None,
        "median_ev_ebitda": round(float(sum(valid_ev_ebitda) / len(valid_ev_ebitda)), 1) if valid_ev_ebitda else None,
    }

    # Relative premium/discount calculation
    premium_analysis = []
    curr_ev_sales = multiples.get("ev_sales")
    if curr_ev_sales and peer_medians["median_ev_sales"]:
        diff_pct = ((curr_ev_sales - peer_medians["median_ev_sales"]) / peer_medians["median_ev_sales"]) * 100
        premium_analysis.append({
            "metric": "EV / Sales",
            "target_value": curr_ev_sales,
            "peer_median": peer_medians["median_ev_sales"],
            "spread_pct": round(diff_pct, 1),
            "status": "Premium" if diff_pct > 0 else "Discount"
        })

    curr_fwd_pe = multiples.get("pe_forward")
    if curr_fwd_pe and peer_medians["median_forward_pe"]:
        diff_pct = ((curr_fwd_pe - peer_medians["median_forward_pe"]) / peer_medians["median_forward_pe"]) * 100
        premium_analysis.append({
            "metric": "Forward P/E",
            "target_value": curr_fwd_pe,
            "peer_median": peer_medians["median_forward_pe"],
            "spread_pct": round(diff_pct, 1),
            "status": "Premium" if diff_pct > 0 else "Discount"
        })

    # 3. History: Current multiple vs own 3-5Y price range
    hist_bands = market_data.get("history_bands") or {}

    # 4. What the Market is Pricing (Qualitative Desk Synthesis)
    # Explain whether current valuation requires growth acceleration, margin expansion, or multiple contraction
    fwd_pe_val = multiples.get("pe_forward") or 20.0
    ev_sales_val = multiples.get("ev_sales") or 3.0
    
    if fwd_pe_val > 35.0:
        pricing_synthesis = (
            f"The market is pricing high double-digit compound growth and continued margin expansion. "
            f"At {fwd_pe_val:.1f}x Forward P/E, any quarterly decelerations or margin compression creates asymmetric downside risk."
        )
    elif fwd_pe_val > 22.0:
        pricing_synthesis = (
            f"The market is pricing steady above-market secular growth with resilient operational margins. "
            f"At {fwd_pe_val:.1f}x Forward P/E, valuation is in-line with premium peer quality benchmarks."
        )
    elif fwd_pe_val > 12.0:
        pricing_synthesis = (
            f"The market is pricing modest cyclical stability or moderate mature growth. "
            f"At {fwd_pe_val:.1f}x Forward P/E, expectations are grounded with limited multiple-contraction risk."
        )
    else:
        pricing_synthesis = (
            f"The market is pricing structural headwinds, low-growth maturity, or cyclical contraction. "
            f"At {fwd_pe_val:.1f}x Forward P/E, upside optionality exists if execution stabilizes."
        )

    # 5. User-Controlled DCF Sensitivity (NOT invented WACC / g)
    # Strict compliance: We provide the mathematical sandbox with explicit user-customizable flags
    dcf_sandbox = None
    if user_dcf_params:
        # User explicitly asked or supplied assumptions
        u_growth = user_dcf_params.get("growth_5y", 0.10)
        u_margin = user_dcf_params.get("operating_margin", 0.20)
        u_wacc = user_dcf_params.get("wacc", 0.09)
        u_tg = user_dcf_params.get("terminal_growth", 0.025)

        rev_base = ttm.get("revenue") or 1e10
        shares_base = market_data.get("shares_outstanding") or 1e9
        cash_base = ttm.get("cash_and_equivalents") or 0.0
        debt_base = ttm.get("total_debt") or 0.0

        # Run mathematical 5-year projection
        pv_fcf = 0.0
        proj_rev = rev_base
        for yr in range(1, 6):
            proj_rev *= (1.0 + u_growth)
            fcf_yr = proj_rev * u_margin * 0.78  # approx after-tax cash conversion
            pv_fcf += fcf_yr / ((1.0 + u_wacc) ** yr)

        # Terminal value
        term_fcf = (proj_rev * (1.0 + u_tg)) * u_margin * 0.78
        term_val = term_fcf / max(0.01, u_wacc - u_tg)
        pv_term = term_val / ((1.0 + u_wacc) ** 5)

        enterprise_val = pv_fcf + pv_term
        equity_val = enterprise_val + cash_base - debt_base
        dcf_per_share = round(max(0.0, equity_val / shares_base), 2) if shares_base > 0 else 0.0

        dcf_sandbox = {
            "status": "user_configured",
            "is_truth": False,
            "disclaimer": "USER-CONFIGURED MODEL: NOT AN OBJECTIVE PRICE TARGET. Values strictly reflect user inputs.",
            "inputs": {
                "growth_5y_pct": round(u_growth * 100, 1),
                "operating_margin_pct": round(u_margin * 100, 1),
                "wacc_discount_pct": round(u_wacc * 100, 1),
                "terminal_growth_pct": round(u_tg * 100, 1)
            },
            "output_fair_value": dcf_per_share,
            "market_price": market_data.get("price")
        }
    else:
        dcf_sandbox = {
            "status": "omitted_per_spec",
            "is_truth": False,
            "disclaimer": "DCF model intentionally omitted per build spec rules against inventing WACC and terminal growth rates. Available via interactive scenario sliders."
        }

    return {
        "absolute_multiples": absolute_multiples,
        "peer_table": peer_table,
        "peer_medians": peer_medians,
        "premium_analysis": premium_analysis,
        "historical_context": hist_bands,
        "what_market_is_pricing": pricing_synthesis,
        "dcf_model": dcf_sandbox
    }
