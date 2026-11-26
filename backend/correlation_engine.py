import yfinance as yf
import pandas as pd
import numpy as np
import json
import os
import datetime
import math
import threading
import warnings

try:
    from market_health_engine import _YF_LOCK as _SHARED_YF_LOCK
except Exception:
    _SHARED_YF_LOCK = threading.Lock()

_CORR_MACRO_BOUNDS = {
    "^TNX": (0.3, 12.0),
    "DX-Y.NYB": (70.0, 135.0),
    "CL=F": (15.0, 200.0),
    "GC=F": (900.0, 9000.0),
    "BTC-USD": (5000.0, 500000.0),
    "^VIX": (7.0, 95.0),
}

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
    with _SHARED_YF_LOCK:
        df = yf.download(all_tickers, period="120d", interval="1d", group_by="ticker", progress=False, threads=False)
    
    closes = pd.DataFrame()
    for t in all_tickers:
        if t in df and not df[t]['Close'].empty:
            s = df[t]['Close'].dropna()
            s.index = pd.to_datetime(s.index).tz_localize(None).normalize()
            s = s[~s.index.duplicated(keep='last')]
            if len(s) >= 20:
                if t in _CORR_MACRO_BOUNDS:
                    lo, hi = _CORR_MACRO_BOUNDS[t]
                    if not (lo <= float(s.median()) <= hi and lo <= float(s.iloc[-1]) <= hi):
                        try:
                            with _SHARED_YF_LOCK:
                                s2 = yf.Ticker(t).history(period="120d", interval="1d")['Close'].dropna()
                            s2.index = pd.to_datetime(s2.index).tz_localize(None).normalize()
                            s2 = s2[~s2.index.duplicated(keep='last')]
                            if len(s2) >= 20:
                                s = s2
                        except Exception:
                            pass
                closes[t] = s

    # Overlay Lakehouse daily closes for all Equities, Sector ETFs & Benchmarks so today's candle is never missing
    lakehouse_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'daily_ohlcv.parquet')
    if os.path.exists(lakehouse_path):
        try:
            import duckdb
            eq_tickers = list(SECTOR_ETFS.keys()) + BENCHMARKS + STOCKS_UNIVERSE
            in_list = ",".join([f"'{x}'" for x in eq_tickers])
            q = f"""
                SELECT 
                    Ticker,
                    CAST(Date AS DATE) AS TradeDate,
                    LAST(Close ORDER BY Date) AS Close
                FROM read_parquet('{lakehouse_path}')
                WHERE Ticker IN ({in_list}) AND Date >= current_date() - INTERVAL 140 DAY
                GROUP BY Ticker, CAST(Date AS DATE)
                ORDER BY TradeDate ASC
            """
            lh_df = duckdb.query(q).to_df()
            if not lh_df.empty:
                lh_piv = lh_df.pivot(index='TradeDate', columns='Ticker', values='Close')
                lh_piv.index = pd.to_datetime(lh_piv.index).tz_localize(None).normalize()
                lh_piv = lh_piv[~lh_piv.index.duplicated(keep='last')].sort_index()
                # Reindex closes to union of dates up to latest Lakehouse equity date
                max_eq_date = lh_piv.index.max()
                union_idx = closes.index.union(lh_piv.index).sort_values()
                union_idx = union_idx[union_idx <= max_eq_date]
                closes = closes.reindex(union_idx)
                for col in lh_piv.columns:
                    if col in closes.columns:
                        closes[col] = lh_piv[col].combine_first(closes[col])
                    else:
                        closes[col] = lh_piv[col]
        except Exception as lh_err:
            print(f"Lakehouse overlay warning in correlation_engine: {lh_err}")

    # Heal trailing NaN on Macro Drivers (e.g. BTC-USD or ^TNX) via fast_info if needed
    for m_sym in MACRO_DRIVERS.keys():
        if m_sym in closes.columns and pd.isna(closes[m_sym].iloc[-1]):
            try:
                lp = yf.Ticker(m_sym).fast_info.get('lastPrice')
                if lp and lp > 0:
                    closes.loc[closes.index[-1], m_sym] = float(lp)
            except Exception:
                pass

    closes = closes.sort_index().ffill(limit=2)
    returns = closes.pct_change(fill_method=None).dropna(how='all')
    corr_matrix = returns.corr(min_periods=20).fillna(0.0).round(2)
    
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
                "sparkline_20d": [round(float(v), 2) for v in s.iloc[-20:].tolist()],
                "description": meta["description"],
                "transmission": meta["transmission"],
                "bull_sectors": meta["bull_sectors"],
                "bear_sectors": meta["bear_sectors"]
            }

    # 2. Determine Active Macro Regime
    spy_ret_1d = round(((closes['SPY'].iloc[-1] - closes['SPY'].iloc[-2]) / closes['SPY'].iloc[-2]) * 100, 2) if 'SPY' in closes and len(closes['SPY']) > 1 else 0.0
    spy_ret_20d = round(((closes['SPY'].iloc[-1] - closes['SPY'].iloc[-21]) / closes['SPY'].iloc[-21]) * 100, 2) if 'SPY' in closes and len(closes['SPY']) > 20 else 0.0
    vix_val = macro_quotes.get("^VIX", {}).get("current_price", 15.0)
    oil_chg = macro_quotes.get("CL=F", {}).get("change_20d", 0)
    tnx_chg = macro_quotes.get("^TNX", {}).get("change_20d", 0)
    dxy_val = macro_quotes.get("DX-Y.NYB", {}).get("current_price", 100.0)

    # 4-Quadrant Economic Engine: Growth (SPY 20D & VIX) vs Inflation/Yields (10Y Yield 20D & Oil 20D)
    is_growth_rising = spy_ret_20d > -2.0 and vix_val < 21.0
    is_inflation_yields_rising = (tnx_chg > 1.0 or oil_chg > 2.5)

    if is_growth_rising and is_inflation_yields_rising:
        regime_id = "REFLATION"
        regime_name = "Reflationary Expansion"
        regime_desc = "Both Growth and Inflation/Yields are rising. Expanding economic activity fuels corporate revenue and capex, while elevated yields and commodity inputs lift cost curves. Capital aggressively rotates from long-duration bond proxies and unprofitable tech into cyclicals, energy, materials, and asset-sensitive banks."
        favored = ["XLE (Energy)", "XLF (Financials)", "XLI (Industrials)", "XLB (Materials)"]
        unfavored = ["XLU (Utilities)", "XLRE (Real Estate)", "TLT (Long Treasuries)"]
        prob = 78
        driver_summary = f"Growth Resilient & Expanding (SPY 20D: {spy_ret_20d:+}%); Yields/Inflation Rising (10Y Yield: {macro_quotes.get('^TNX', {}).get('current_price', '4.84')}%, 20D: {tnx_chg:+}%, Oil 20D: {oil_chg:+}%). Broad cyclical participation."
    elif is_growth_rising and not is_inflation_yields_rising and vix_val < 20.0:
        regime_id = "GOLDILOCKS"
        regime_name = "Goldilocks / Disinflationary Expansion"
        regime_desc = "Growth is expanding while inflation and bond yields are softening with compliant volatility (VIX < 20). This provides the optimal runway for Technology, Growth, and Semiconductors via valuation multiple expansion."
        favored = ["XLK (Technology)", "SMH (Semiconductors)", "XLY (Consumer Discretionary)"]
        unfavored = ["XLU (Utilities)", "XLE (Energy)", "Cash / T-Bills"]
        prob = 76
        driver_summary = f"VIX ({vix_val}) in calm regime; Oil 20D ({oil_chg:+}%) & 10Y Yields ({tnx_chg:+}% 20D) softening; Equity Trend Constructive (SPY 20D: {spy_ret_20d:+}%)."
    elif not is_growth_rising and is_inflation_yields_rising:
        regime_id = "STAGFLATION"
        regime_name = "Stagflationary Pressure"
        regime_desc = "Growth is contracting while inflation and yields remain stubborn or rising with elevated volatility. Cost-push inflation from energy and borrowing costs collides with softening corporate earnings. Defensive capital preservation dominates."
        favored = ["GC=F (Gold)", "XLE (Upstream Energy)", "Cash / Ultra-Short T-Bills"]
        unfavored = ["XLY (Consumer Discretionary)", "XLI (Industrials)", "High-P/E Tech"]
        prob = 72
        driver_summary = f"Oil/Yields pressuring corporate margins; VIX elevated ({vix_val}); S&P 500 under pressure (SPY 20D: {spy_ret_20d:+}%, 1D: {spy_ret_1d:+}%)."
    elif not is_growth_rising and not is_inflation_yields_rising:
        regime_id = "DEFLATION"
        regime_name = "Deflationary / Risk-Off De-Leveraging"
        regime_desc = "Both Growth and Inflation/Yields are decelerating amid elevated volatility (VIX > 21). Institutional de-risking pulls equity multiples, bond yields, and cyclical commodities lower simultaneously, sparking a flight to safety in sovereign bonds, gold, and defensive cash-flow sectors."
        favored = ["TLT (Long Treasuries)", "XLU (Utilities)", "XLV (Healthcare)", "GC=F (Gold)"]
        unfavored = ["SMH (Semiconductors)", "XLK (High-Beta Tech)", "XLE (Cyclical Energy)"]
        prob = 82 if vix_val >= 25.0 else 72
        driver_summary = f"Volatility Shock (VIX: {vix_val}) & Equity Drawdown (SPY 1D: {spy_ret_1d:+}%, 20D: {spy_ret_20d:+}%) paired with falling 10Y Yields ({tnx_chg:+}% 20D) and Crude Oil ({oil_chg:+}% 20D)."
    else:
        regime_id = "NEUTRAL_TRANSITION"
        regime_name = "Consolidating / Mixed Transition"
        regime_desc = "Cross-currents across rates, currencies, and corporate earnings. Focus strictly on top relative-strength industry groups and selective setups."
        favored = ["High Relative Strength Leaders", "XLF (Financials)", "SMH (Semiconductors)"]
        unfavored = ["Low Relative Strength Laggards", "High-Debt Small Caps"]
        prob = 62
        driver_summary = f"Mixed macro signals across yields ({tnx_chg:+}% 20D), VIX ({vix_val}), and Dollar ({dxy_val})."

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
        
        # Most positive and most negative correlated individual stocks (with guaranteed fallback so no card is ever empty)
        pos_corrs = driver_corrs[driver_corrs > 0.12].sort_values(ascending=False).head(10)
        if len(pos_corrs) < 5:
            pos_corrs = driver_corrs.sort_values(ascending=False).head(8)
        neg_corrs = driver_corrs[driver_corrs < -0.12].sort_values(ascending=True).head(10)
        if len(neg_corrs) < 5:
            neg_corrs = driver_corrs.sort_values(ascending=True).head(8)
        
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
            "current_price": driver_info.get("current_price"),
            "unit": meta["unit"],
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

    # 6. 12-Week Macro Quadrant Trajectory Trail (5 trading days apart, ending at latest bar)
    regime_trail = []
    if 'SPY' in closes.columns and len(closes) >= 25:
        n_bars = len(closes)
        trail_indices = sorted(set([max(21, n_bars - 1 - 5 * k) for k in range(12)]))[-12:]
        for idx_t in trail_indices:
            dt_t = closes.index[idx_t]
            is_last = (idx_t == n_bars - 1)
            spy_s = closes['SPY'].iloc[:idx_t + 1].dropna()
            vix_s = closes['^VIX'].iloc[:idx_t + 1].dropna() if '^VIX' in closes.columns else pd.Series(dtype=float)
            tnx_s = closes['^TNX'].iloc[:idx_t + 1].dropna() if '^TNX' in closes.columns else pd.Series(dtype=float)
            oil_s = closes['CL=F'].iloc[:idx_t + 1].dropna() if 'CL=F' in closes.columns else pd.Series(dtype=float)

            spy_20d_t = ((float(spy_s.iloc[-1]) - float(spy_s.iloc[-21])) / float(spy_s.iloc[-21]) * 100.0) if len(spy_s) > 20 and spy_s.iloc[-21] > 0 else 0.0
            vix_t = float(vix_s.iloc[-1]) if len(vix_s) > 0 else 16.0
            tnx_20d_t = ((float(tnx_s.iloc[-1]) - float(tnx_s.iloc[-21])) / float(tnx_s.iloc[-21]) * 100.0) if len(tnx_s) > 20 and tnx_s.iloc[-21] > 0 else 0.0
            oil_20d_t = ((float(oil_s.iloc[-1]) - float(oil_s.iloc[-21])) / float(oil_s.iloc[-21]) * 100.0) if len(oil_s) > 20 and oil_s.iloc[-21] > 0 else 0.0

            g_up = (spy_20d_t > -2.0) and (vix_t < 21.0)
            i_up = (tnx_20d_t > 1.0) or (oil_20d_t > 2.5)
            if is_last and regime_id in ("REFLATION", "GOLDILOCKS", "STAGFLATION", "DEFLATION"):
                q_t = regime_id
                g_up = regime_id in ("REFLATION", "GOLDILOCKS")
                i_up = regime_id in ("REFLATION", "STAGFLATION")
            elif g_up and i_up:
                q_t = "REFLATION"
            elif g_up and not i_up and vix_t < 20.0:
                q_t = "GOLDILOCKS"
            elif (not g_up) and i_up:
                q_t = "STAGFLATION"
            elif (not g_up) and (not i_up):
                q_t = "DEFLATION"
            else:
                q_t = "GOLDILOCKS" if g_up else "DEFLATION"

            g_mag = max(0.35, min(3.0, abs((spy_20d_t + 2.0) / 4.0) + ((max(0.0, 21.0 - vix_t) / 6.0) if g_up else (max(0.0, vix_t - 21.0) / 8.0))))
            growth_score = round(g_mag if g_up else -g_mag, 2)
            i_mag = max(0.35, min(3.0, max(abs(tnx_20d_t - 1.0) / 3.5, abs(oil_20d_t - 2.5) / 8.0)))
            inflation_score = round(i_mag if i_up else -i_mag, 2)

            regime_trail.append({
                "date": dt_t.strftime('%Y-%m-%d'),
                "label": dt_t.strftime('%m/%d'),
                "growth_score": growth_score,
                "inflation_score": inflation_score,
                "quadrant": q_t,
            })

    trade_date_str = closes.index[-1].strftime('%Y-%m-%d') if len(closes) > 0 else datetime.date.today().strftime('%Y-%m-%d')

    results = {
        "version": "3.0",
        "trade_date": trade_date_str,
        "last_updated": datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "macro_quotes": macro_quotes,
        "active_regime": active_regime,
        "regime_trail": regime_trail,
        "scenarios": scenarios,
        "cross_asset_matrix": matrix_data,
        "sector_sensitivities": sector_sensitivities
    }

    def sanitize_for_json(obj):
        if isinstance(obj, float):
            if math.isnan(obj) or math.isinf(obj):
                return None
            return obj
        elif isinstance(obj, dict):
            return {k: sanitize_for_json(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [sanitize_for_json(x) for x in obj]
        return obj

    results = sanitize_for_json(results)

    output_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'correlation_results.json')
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=4, allow_nan=False)
        
    print(f"Institutional Macro Matrix & Correlation Engine scan complete. Output saved to {output_path}")
    return results

if __name__ == "__main__":
    run_correlation_engine()
