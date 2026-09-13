import yfinance as yf
import pandas as pd
import numpy as np
import json
import os
import datetime
import warnings

warnings.filterwarnings('ignore')

MACRO_DRIVERS = {
    "^TNX": {
        "name": "10-Yr US Treasury Yield",
        "short_name": "10-Yr Yield",
        "category": "Interest Rates & Cost of Capital",
        "unit": "%",
        "description": "Benchmark risk-free rate dictating discount rates and consumer borrowing costs.",
        "transmission": "Rising yields increase the discount rate on future earnings (compressing high-P/E growth stocks) while boosting bank Net Interest Margins. Falling yields unleash equity valuation multiple expansion.",
        "bull_sectors": [
            {"sector": "Financials (XLF)", "reason": "Expanding net interest margin on lending books"},
            {"sector": "Energy (XLE)", "reason": "Associated with economic expansion and commodity inflation"}
        ],
        "bear_sectors": [
            {"sector": "Real Estate (XLRE)", "reason": "High debt service and competition with higher bond yields"},
            {"sector": "Utilities (XLU)", "reason": "Bond-proxy dividend yields lose relative appeal"}
        ]
    },
    "DX-Y.NYB": {
        "name": "US Dollar Index (DXY)",
        "short_name": "US Dollar (DXY)",
        "category": "Currencies & Global Liquidity",
        "unit": "pts",
        "description": "Measures USD purchasing power against major global currencies (EUR, JPY, GBP, CAD).",
        "transmission": "A strengthening Dollar tightens global financial conditions, denting multinational foreign revenues and commodity prices. A softer Dollar fuels rallies in Gold, Emerging Markets, and Big Tech.",
        "bull_sectors": [
            {"sector": "Small Caps (IWM)", "reason": "Pure US domestic revenue, insulated from foreign currency translation"},
            {"sector": "US Retailers", "reason": "Cheaper foreign import goods reduce cost of goods sold"}
        ],
        "bear_sectors": [
            {"sector": "Materials (XLB)", "reason": "Global commodities priced in USD become more expensive overseas"},
            {"sector": "Multinational Tech (XLK)", "reason": "Foreign revenue currency translation drag"}
        ]
    },
    "CL=F": {
        "name": "WTI Crude Oil",
        "short_name": "Crude Oil",
        "category": "Energy & Headline Inflation",
        "unit": "$/bbl",
        "description": "Prime industrial commodity and prime driver of headline Consumer Price Index (CPI) volatility.",
        "transmission": "Surging oil acts as a direct consumer tax, increasing airline, logistics, and manufacturing costs. Plunging oil frees consumer disposable cash and dramatically expands logistics margins.",
        "bull_sectors": [
            {"sector": "Energy (XLE)", "reason": "Direct upstream cash flow generation and dividend expansion"},
            {"sector": "Oil Services", "reason": "Drilling, capex, and equipment utilization surge"}
        ],
        "bear_sectors": [
            {"sector": "Airlines & Transports", "reason": "Jet fuel represents 25-35% of total airline operating expenses"},
            {"sector": "Consumer Discretionary (XLY)", "reason": "Higher pump prices cannibalize discretionary retail spending"}
        ]
    },
    "GC=F": {
        "name": "Gold (COMEX)",
        "short_name": "Gold",
        "category": "Safe Haven & Debasement Hedge",
        "unit": "$/oz",
        "description": "Historical monetary anchor and supreme hedge against negative real rates and sovereign debasement.",
        "transmission": "Gold surges when real yields fall or geopolitical and fiscal risks escalate. Soft gold reflects confidence in fiat stability and risk-seeking capital deployment.",
        "bull_sectors": [
            {"sector": "Gold Miners (GDX)", "reason": "Operating leverage to spot gold price appreciation"},
            {"sector": "Materials (XLB)", "reason": "Broad commodity and hard asset revaluation"}
        ],
        "bear_sectors": [
            {"sector": "High-Beta Financials", "reason": "Flight-to-safety flows indicate sovereign or banking stress"}
        ]
    },
    "BTC-USD": {
        "name": "Bitcoin",
        "short_name": "Bitcoin",
        "category": "Digital Asset & Liquidity Beta",
        "unit": "$",
        "description": "Pristine market barometer of global fiat money supply (M2) expansion and speculative risk tolerance.",
        "transmission": "Bitcoin front-runs broader speculative equity cycles by 2-4 weeks. When BTC accelerates with rising net ETF inflows, speculative tech, fintech, and semiconductor momentum invariably follows.",
        "bull_sectors": [
            {"sector": "Fintech & Digital Assets", "reason": "Direct transaction volume and institutional custody fee growth"},
            {"sector": "Semiconductors & AI Compute (SMH)", "reason": "High-beta liquidity correlation and high-performance compute demand"}
        ],
        "bear_sectors": [
            {"sector": "Consumer Staples (XLP)", "reason": "Capital rotates aggressively into high-velocity growth assets"}
        ]
    },
    "^VIX": {
        "name": "CBOE Volatility Index (VIX)",
        "short_name": "VIX",
        "category": "Market Sentiment & Dealer Gamma",
        "unit": "pts",
        "description": "30-day implied volatility of the S&P 500, measuring market fear and options hedging demand.",
        "transmission": "Sub-16 VIX signals positive dealer gamma (market makers dampen volatility by buying dips). VIX > 20 signals negative gamma, where institutional hedging accelerates market drawdowns.",
        "bull_sectors": [
            {"sector": "Healthcare (XLV)", "reason": "Inelastic consumer demand and defensive corporate balance sheets"},
            {"sector": "Consumer Staples (XLP)", "reason": "Reliable cash flow and low economic cyclicality"}
        ],
        "bear_sectors": [
            {"sector": "High-Beta Tech & Growth", "reason": "Multiples compress rapidly as volatility-targeting funds de-risk"}
        ]
    }
}

SECTOR_ETFS = {
    "XLK": "Technology",
    "XLF": "Financials",
    "XLE": "Energy",
    "XLI": "Industrials",
    "XLU": "Utilities",
    "XLV": "Healthcare",
    "XLY": "Discretionary",
    "XLP": "Staples",
    "XLB": "Materials",
    "SMH": "Semiconductors"
}

BENCHMARKS = ["SPY", "QQQ"]

# Diverse multi-sector stock universe for correlation mappings
STOCKS_UNIVERSE = [
    "NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "AVGO", "AMD", "QCOM", 
    "JPM", "BAC", "GS", "MS", "V", "MA",
    "XOM", "CVX", "COP", "EOG", "SLB", "MPC",
    "CAT", "DE", "GE", "BA", "PWR", "ETN",
    "HD", "LOW", "NKE", "MCD", "SBUX",
    "COST", "WMT", "PG", "KO", "PEP",
    "LLY", "UNH", "JNJ", "ABBV", "PFE",
    "NEE", "DUK", "SO", "D",
    "NEM", "FCX", "SHW", "ECL",
    "PLTR", "NET", "CRWD", "COIN"
]

def run_correlation_engine():
    print("Executing Institutional Macro Matrix & Correlation Engine...")
    
    all_tickers = list(MACRO_DRIVERS.keys()) + list(SECTOR_ETFS.keys()) + BENCHMARKS + STOCKS_UNIVERSE
    df = yf.download(all_tickers, period="90d", interval="1d", group_by="ticker", progress=False)
    
    closes = pd.DataFrame()
    for t in all_tickers:
        if t in df and not df[t]['Close'].empty:
            s = df[t]['Close'].dropna()
            if len(s) >= 20:
                closes[t] = s
                
    returns = closes.pct_change().dropna()
    corr_matrix = returns.corr().round(2)
    
    # 1. Macro Driver Quotes & Trends
    macro_quotes = {}
    for sym, meta in MACRO_DRIVERS.items():
        if sym in closes:
            s = closes[sym].dropna()
            latest = float(s.iloc[-1])
            prev_1d = float(s.iloc[-2]) if len(s) > 1 else latest
            prev_5d = float(s.iloc[-6]) if len(s) > 5 else latest
            prev_20d = float(s.iloc[-21]) if len(s) > 20 else latest
            
            chg_1d = round(((latest - prev_1d) / prev_1d) * 100, 2)
            chg_5d = round(((latest - prev_5d) / prev_5d) * 100, 2)
            chg_20d = round(((latest - prev_20d) / prev_20d) * 100, 2)
            
            trend = "Rising" if chg_5d > 1.0 else ("Falling" if chg_5d < -1.0 else "Neutral")
            
            macro_quotes[sym] = {
                "symbol": sym,
                "name": meta["name"],
                "short_name": meta["short_name"],
                "category": meta["category"],
                "unit": meta["unit"],
                "current_price": round(latest, 2),
                "change_1d": chg_1d,
                "change_5d": chg_5d,
                "change_20d": chg_20d,
                "trend": trend,
                "description": meta["description"],
                "transmission": meta["transmission"],
                "bull_sectors": meta["bull_sectors"],
                "bear_sectors": meta["bear_sectors"]
            }

    # 2. Determine Active Macro Regime
    spy_ret_20d = macro_quotes.get("SPY", {}).get("change_20d", 0) if "SPY" in macro_quotes else (
        round(((closes['SPY'].iloc[-1] - closes['SPY'].iloc[-21]) / closes['SPY'].iloc[-21]) * 100, 2) if 'SPY' in closes else 1.5
    )
    vix_val = macro_quotes.get("^VIX", {}).get("current_price", 15.0)
    oil_chg = macro_quotes.get("CL=F", {}).get("change_20d", 0)
    tnx_chg = macro_quotes.get("^TNX", {}).get("change_20d", 0)
    dxy_val = macro_quotes.get("DX-Y.NYB", {}).get("current_price", 100.0)

    # Regime Logic
    # 4-Quadrant Economic Engine: Growth (SPY/QQQ) vs Inflation (10Y Yields, Oil, Commodities)
    # Reflation vs Stagflation threshold calibration:
    # SPY short-term pullbacks (-1% to -2%) during yield/commodity rallies reflect Reflationary Rotation, not economic stagflation.
    # Stagflation requires genuine growth breakdown (SPY 20D < -3.5%) coupled with high volatility (VIX > 22).
    is_growth_rising = spy_ret_20d > -2.5 and vix_val < 22.0
    is_inflation_yields_rising = (tnx_chg > 1.5 or oil_chg > 3.0 or macro_quotes.get("^TNX", {}).get("current_price", 0) >= 4.3)

    if is_growth_rising and is_inflation_yields_rising:
        regime_id = "REFLATION"
        regime_name = "Reflationary Expansion"
        regime_desc = "Both Growth and Inflation/Yields are rising. Expanding economic activity fuels corporate revenue and capex, while elevated yields and commodity inputs lift cost curves. Capital aggressively rotates from long-duration bond proxies and unprofitable tech into cyclicals, energy, materials, and asset-sensitive banks."
        favored = ["XLE (Energy)", "XLF (Financials)", "XLI (Industrials)", "XLB (Materials)"]
        unfavored = ["XLU (Utilities)", "XLRE (Real Estate)", "TLT (Long Treasuries)"]
        prob = 78
        driver_summary = f"Growth Resilient & Expanding (SPY 20D: {spy_ret_20d:+}%); Yields/Inflation Elevated (10Y Yield: {macro_quotes.get('^TNX', {}).get('current_price', '4.97')}%, 20D: {tnx_chg:+}%, Oil 20D: {oil_chg:+}%). Broad cyclical participation."
    elif is_growth_rising and not is_inflation_yields_rising and vix_val < 18.0:
        regime_id = "GOLDILOCKS"
        regime_name = "Goldilocks / Disinflationary Expansion"
        regime_desc = "Growth is expanding while inflation and bond yields are softening with compliant volatility (VIX < 18). This provides the optimal runway for Technology, Growth, and Semiconductors via valuation multiple expansion."
        favored = ["XLK (Technology)", "SMH (Semiconductors)", "XLY (Consumer Discretionary)"]
        unfavored = ["XLU (Utilities)", "XLE (Energy)", "Cash / T-Bills"]
        prob = 74
        driver_summary = f"VIX ({vix_val}) in low-volatility regime; Oil 20D ({oil_chg:+}%) contained; Yields softening; Equity Trend Strong."
    elif not is_growth_rising and (oil_chg > 5.0 or tnx_chg > 5.0) and vix_val >= 22.0:
        regime_id = "STAGFLATION"
        regime_name = "Stagflationary Pressure"
        regime_desc = "Growth is contracting while inflation and yields remain stubborn or rising with elevated volatility. Cost-push inflation from energy and borrowing costs collides with softening corporate earnings. Defensive capital preservation dominates."
        favored = ["GC=F (Gold)", "XLE (Upstream Energy)", "Cash / Ultra-Short T-Bills"]
        unfavored = ["XLY (Consumer Discretionary)", "XLI (Industrials)", "High-P/E Tech"]
        prob = 65
        driver_summary = f"Oil/Yields compressing corporate margins; VIX elevated ({vix_val}); S&P 500 decelerating ({spy_ret_20d:+}%)."
    elif not is_growth_rising and not is_inflation_yields_rising:
        regime_id = "DEFLATION"
        regime_name = "Deflationary Contraction"
        regime_desc = "Both Growth and Inflation are decelerating. Demand destruction pulls commodity prices down while central banks ease policy, sparking a flight to safety in sovereign bonds and recession-resilient sectors."
        favored = ["TLT (Long Treasuries)", "XLU (Utilities)", "XLV (Healthcare)"]
        unfavored = ["XLE (Energy)", "XLB (Materials)", "XLF (Banks)"]
        prob = 70
        driver_summary = f"Growth contracting ({spy_ret_20d:+}%); Inflation falling; Sovereign bonds and defensive yield in demand."
    else:
        regime_id = "NEUTRAL_TRANSITION"
        regime_name = "Consolidating / Mixed Transition"
        regime_desc = "Cross-currents across rates, currencies, and corporate earnings. Focus strictly on top relative-strength industry groups and selective setups."
        favored = ["High Relative Strength Leaders", "XLF (Financials)", "SMH (Semiconductors)"]
        unfavored = ["Low Relative Strength Laggards", "High-Debt Small Caps"]
        prob = 58
        driver_summary = f"Mixed macro signals across yields ({tnx_chg:+}% 20D) and Dollar ({dxy_val})."

    active_regime = {
        "id": regime_id,
        "name": regime_name,
        "description": regime_desc,
        "favored_sectors": favored,
        "unfavored_sectors": unfavored,
        "confidence": prob,
        "driver_summary": driver_summary
    }

    # 3. Two-Way Actionable Scenarios for each Macro Driver
    scenarios = []
    for driver_sym, meta in MACRO_DRIVERS.items():
        if driver_sym not in corr_matrix.columns:
            continue
            
        driver_corrs = corr_matrix[driver_sym].drop(index=list(MACRO_DRIVERS.keys()) + BENCHMARKS + list(SECTOR_ETFS.keys()), errors='ignore')
        
        # Most positive and most negative correlated individual stocks
        pos_corrs = driver_corrs[driver_corrs > 0.15].sort_values(ascending=False).head(10)
        neg_corrs = driver_corrs[driver_corrs < -0.15].sort_values(ascending=True).head(10)
        
        # Format stock items with current prices and 1d change
        def build_stock_items(series, action_type):
            items = []
            for t, c in series.items():
                price = float(closes[t].iloc[-1]) if t in closes else 0.0
                prev = float(closes[t].iloc[-2]) if t in closes and len(closes[t]) > 1 else price
                chg = round(((price - prev) / prev) * 100, 2) if prev > 0 else 0.0
                items.append({
                    "ticker": t,
                    "corr": float(c),
                    "action": action_type,
                    "price": round(price, 2),
                    "change_pct": chg
                })
            return items

        driver_info = macro_quotes.get(driver_sym, {})
        
        scenarios.append({
            "driver": meta["short_name"],
            "full_name": meta["name"],
            "symbol": driver_sym,
            "category": meta["category"],
            "current_value": f"{driver_info.get('current_price', '-')} {meta['unit']}",
            "change_1d": driver_info.get("change_1d", 0.0),
            "trend": driver_info.get("trend", "Neutral"),
            "transmission": meta["transmission"],
            "if_up": {
                "label": f"If {meta['short_name']} Rallies ↗️",
                "narrative": f"Higher {meta['short_name']} triggers capital rotation into inflation/rate beneficiary assets while pressuring rate-sensitive debtors.",
                "favored_sectors": meta["bull_sectors"],
                "winning_stocks": build_stock_items(pos_corrs, "buy"),
                "at_risk_stocks": build_stock_items(neg_corrs, "avoid")
            },
            "if_down": {
                "label": f"If {meta['short_name']} Pulls Back ↘️",
                "narrative": f"Softening {meta['short_name']} provides valuation multiple expansion and relieves borrowing cost pressure.",
                "favored_sectors": meta["bear_sectors"],
                "winning_stocks": build_stock_items(neg_corrs, "buy"),
                "at_risk_stocks": build_stock_items(pos_corrs, "avoid")
            }
        })

    # 4. Cross-Asset Correlation Heatmap Matrix
    matrix_assets = ["SPY", "QQQ", "^TNX", "DX-Y.NYB", "CL=F", "GC=F", "BTC-USD", "^VIX"] + list(SECTOR_ETFS.keys())
    available_assets = [a for a in matrix_assets if a in corr_matrix.columns]
    
    asset_labels = {
        "SPY": "S&P 500",
        "QQQ": "Nasdaq 100",
        "^TNX": "10Y Yield",
        "DX-Y.NYB": "US Dollar",
        "CL=F": "Crude Oil",
        "GC=F": "Gold",
        "BTC-USD": "Bitcoin",
        "^VIX": "VIX",
        "XLK": "Tech (XLK)",
        "XLF": "Fin (XLF)",
        "XLE": "Energy (XLE)",
        "XLI": "Ind (XLI)",
        "XLU": "Util (XLU)",
        "XLV": "Health (XLV)",
        "XLY": "Disc (XLY)",
        "XLP": "Staples (XLP)",
        "XLB": "Mat (XLB)",
        "SMH": "Semis (SMH)"
    }
    
    sub_corr = corr_matrix.loc[available_assets, available_assets]
    matrix_data = {
        "assets": [{"symbol": a, "label": asset_labels.get(a, a)} for a in available_assets],
        "values": sub_corr.to_dict()
    }

    # 5. Sector Sensitivities Table
    sector_sensitivities = []
    for sec_sym, sec_name in SECTOR_ETFS.items():
        if sec_sym in corr_matrix.columns:
            sec_corrs = corr_matrix[sec_sym]
            sector_sensitivities.append({
                "symbol": sec_sym,
                "name": sec_name,
                "corr_tnx": float(sec_corrs.get("^TNX", 0.0)),
                "corr_dxy": float(sec_corrs.get("DX-Y.NYB", 0.0)),
                "corr_oil": float(sec_corrs.get("CL=F", 0.0)),
                "corr_gold": float(sec_corrs.get("GC=F", 0.0)),
                "corr_spy": float(sec_corrs.get("SPY", 0.0))
            })
            
    # Sort sector sensitivities by correlation to TNX descending
    sector_sensitivities.sort(key=lambda x: x["corr_tnx"], reverse=True)

    results = {
        "last_updated": datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "macro_quotes": macro_quotes,
        "active_regime": active_regime,
        "scenarios": scenarios,
        "cross_asset_matrix": matrix_data,
        "sector_sensitivities": sector_sensitivities
    }

    output_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'correlation_results.json')
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=4)
        
    print(f"Institutional Macro Matrix & Correlation Engine scan complete. Output saved to {output_path}")
    return results

if __name__ == "__main__":
    run_correlation_engine()
