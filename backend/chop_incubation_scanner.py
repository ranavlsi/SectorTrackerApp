import os
import sys
import json
import duckdb
import pandas as pd
import numpy as np

# Ensure backend modules can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from trade_council import TradeCouncil
from stock_personality_engine import (
    classify_personality, 
    calculate_adr_metrics, 
    detect_guardian_ma, 
    detect_character_change
)

LAKEHOUSE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'daily_ohlcv.parquet')

EXCLUDED_TICKERS = {
    'SPY', 'QQQ', 'IWM', 'DIA', 'TZA', 'SOXL', 'SOXS', 'NVDL', 'MSTU', 'MSTZ',
    'CONL', 'FNGU', 'FNGD', 'TQQQ', 'SQQQ', 'UPRO', 'SPXU', 'UVXY', 'VXX',
    'BWET', 'GUSH', 'DRIP', 'LABU', 'LABD', 'BOIL', 'KOLD', 'YINN', 'YANG',
    'BITX', 'BITO', 'TSLL', 'TSLS', 'TECL', 'TECS', 'FAS', 'FAZ', 'XHLD', 'CCUP',
    'UTZ', 'ARX', 'EWZ', 'XLF', 'XLE', 'XLK', 'SMH', 'IGV', 'IBIT', 'ETHE', 'GDX',
    'XLI', 'XLY', 'XLP', 'XLV', 'XLU', 'XLRE', 'FXI', 'EEM', 'KWEB'
}

def scan_chop_incubation_leaders(min_avg_vol=10_000_000, min_dollar_vol=15_000_000, max_dist_high=22.0, min_rs_excess=2.0, max_results=50):
    """
    Scans the historical Lakehouse database for stocks adhering to William O'Neil's 
    5 Market Chop Rules for Next-Leg Leaders:
    1. Institutional Mega-Volume: Average daily volume >= 10,000,000 shares.
    2. Stage 2 Trend Defense: Price > 50-SMA and 50-SMA > 200-SMA.
    3. Unbroken 52-Week High: Price resting 2.0% to 22.0% under ceiling (coiling pre-breakout).
    4. Anti-Buyout / Flatline Shield: Rejects stocks pinned at buyout tender prices (ADR < 1.6% or 20d Range < 3.5%).
    5. Anti-Extension Shield: Rejects stocks extended >10% from 20-SMA or >30% from 50-SMA (anti-chasing).
    6. Outperforming Relative Strength: RS Line vs SPY > 3-month baseline.
    7. Volume Dry-Up (VDU): 5-day volume contracting relative to 50-day average.
    8. Guardian MA Respect: Holding institutional defense average without 21-SMA sell breakdown.
    """
    if not os.path.exists(LAKEHOUSE_PATH):
        print(f"Lakehouse path not found: {LAKEHOUSE_PATH}")
        return []

    con = duckdb.connect()
    try:
        query = f"""
            SELECT * 
            FROM read_parquet('{LAKEHOUSE_PATH}') 
            WHERE Date >= current_date() - interval '1 year' 
            ORDER BY Date
        """
        lake_df = con.execute(query).df()
    finally:
        con.close()

    grouped = lake_df.groupby('Ticker')
    if 'SPY' not in grouped.groups:
        print("SPY benchmark missing from Lakehouse.")
        return []

    spy_df = grouped.get_group('SPY').set_index('Date')
    spy_close = spy_df['Close']
    spy_ret_3m = (spy_close.iloc[-1] - spy_close.iloc[-63]) / spy_close.iloc[-63] if len(spy_close) >= 63 else 0.0

    candidates = []

    for ticker, group in grouped:
        if ticker in EXCLUDED_TICKERS:
            continue
        
        df = group.set_index('Date').dropna()
        if len(df) < 120:
            continue

        close = float(df['Close'].iloc[-1])
        if close < 5.0:
            continue

        # Rule 1: Institutional Mega-Liquidity (User Requirement: Average Volume >= 10M shares)
        avg_vol20 = float(df['Volume'].tail(20).mean())
        if avg_vol20 < min_avg_vol:
            continue

        dollar_vol = avg_vol20 * close
        if dollar_vol < min_dollar_vol:
            continue

        # Anti-Buyout / Arbitrage Flatline Shield (The UTZ / ARX Rule)
        adr_20 = float(((df['High'] - df['Low']) / df['Close']).tail(20).mean() * 100.0)
        close_range_20 = float((df['Close'].tail(20).max() - df['Close'].tail(20).min()) / df['Close'].tail(20).min() * 100.0)
        if adr_20 < 1.6 or close_range_20 < 3.5:
            continue

        sma20 = float(df['Close'].rolling(20).mean().iloc[-1])
        sma50 = float(df['Close'].rolling(50).mean().iloc[-1])
        sma200 = float(df['Close'].rolling(min(200, len(df))).mean().iloc[-1])

        # Rule 2: Holding 50-day line in Stage 2
        if close < sma50 or sma50 < (sma200 * 0.98):
            continue

        # Rule 3: Pre-Breakout Base Incubation (The Unbroken 52-Week High Rule)
        # CRITICAL: Stocks that have ALREADY broken their 52-week high are disqualified!
        # The stock must be COILING INSIDE THE BASE UNDER THE CEILING:
        # - The peak was set at least 6 trading days ago (base duration >= 6 sessions)
        # - Current price is resting 2.0% to 22.0% BELOW the 52-week high (unbroken pivot)
        highs_252 = df['High'].tail(min(252, len(df)))
        high_52w = float(highs_252.max())
        days_since_high = int(len(highs_252) - 1 - highs_252.values.argmax())
        dist_under_high = float(((high_52w - close) / high_52w) * 100.0)

        if days_since_high < 6:
            continue  # Disqualify: Printed a new 52-week high within the last 5 sessions (not a completed resting base)

        if dist_under_high < 2.0 or dist_under_high > 22.0:
            continue  # Disqualify: If < 2.0%, the 52w high is already broken or breaking out today; if > 22%, base is too deep

        # Rule 4: Anti-Extension to 20-SMA (Tight consolidation along moving averages)
        ext_20sma = ((close - sma20) / sma20) * 100.0
        ext_50sma = ((close - sma50) / sma50) * 100.0
        if ext_20sma > 7.0 or ext_20sma < -6.0 or ext_50sma > 30.0:
            continue

        # Rule 5: RS Outperformance vs SPY (3-month excess return)
        ret_3m = float((close - df['Close'].iloc[-63]) / df['Close'].iloc[-63]) if len(df) >= 63 else 0.0
        rs_excess = float((ret_3m - spy_ret_3m) * 100.0)
        if rs_excess < min_rs_excess:
            continue

        # Rule 6: Volume Dry-Up (VDU) inside the base
        vol5 = float(df['Volume'].tail(5).mean())
        vol50 = float(df['Volume'].tail(50).mean())
        vdu = float(vol5 / vol50) if vol50 > 0 else 1.0
        if vdu > 1.25:
            continue  # Reject erratic volume blowouts

        # Rule 7: Ross Haber Personality & Guardian MA Integrity
        adr = calculate_adr_metrics(df) if calculate_adr_metrics else {"adr_10d": 2.5, "adr_20d": 2.5, "adr_50d": 2.5}
        char = detect_character_change(df, adr['adr_10d'], adr['adr_50d']) if detect_character_change else {}
        
        # Exclude stocks currently in aggressive institutional breakdown below 21-SMA
        if char.get('character_change_detected') and char.get('warning_level') == 'HIGH':
            continue

        guardian = detect_guardian_ma(df) if detect_guardian_ma else {"guardian_ma": "21-SMA", "respect_score": 70.0}
        plan = TradeCouncil.evaluate(ticker, df)

        # Disqualify if TradeCouncil has already marked it as an active 52-Week High Breakout
        if plan['setup_type'] == "52-Week High Breakout":
            continue

        # Composite O'Neil Incubation Score
        ideal_dist_bonus = max(0.0, 15.0 - abs(dist_under_high - 5.0) * 2.0)
        vdu_bonus = 25.0 if vdu <= 0.75 else (15.0 if vdu <= 0.90 else 5.0)
        score = (min(rs_excess, 80.0) * 0.40) + ideal_dist_bonus + vdu_bonus + (guardian['respect_score'] * 0.25)

        metric_str = f"Vol: {avg_vol20/1e6:.1f}M | Base: {days_since_high}d (-{dist_under_high:.1f}% to ATH) | VDU: {vdu:.2f}x | {guardian['guardian_ma']}"

        candidates.append({
            "ticker": ticker,
            "metric": metric_str,
            "score": round(score, 2),
            "close": round(close, 2),
            "dist_52w": round(dist_under_high, 1),
            "rs_excess_3m": round(rs_excess, 1),
            "vdu_ratio": round(vdu, 2),
            "guardian_ma": guardian['guardian_ma'],
            "guardian_fidelity": guardian['respect_score'],
            "setup_type": plan['setup_type'],
            "entry": plan.get('entry_str', round(plan.get('entry', 0), 2)),
            "stop_loss": plan.get('stop_loss', 0),
            "profit_target": plan.get('profit_target', 0),
            "dollar_vol_m": round(dollar_vol / 1_000_000, 1)
        })

    # Sort candidates by composite incubation score descending
    candidates.sort(key=lambda x: x['score'], reverse=True)
    return candidates[:max_results]

def update_screener_results_file(output_path=None):
    """
    Runs the chop incubation scanner and updates screener_results.json.
    """
    if output_path is None:
        output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'screener_results.json')
    
    print("Running William O'Neil Next-Leg Chop Incubation Screener...")
    candidates = scan_chop_incubation_leaders()
    print(f"Found {len(candidates)} Next-Leg Incubation Leaders.")

    existing_data = {}
    if os.path.exists(output_path):
        try:
            with open(output_path, 'r') as f:
                existing_data = json.load(f)
        except Exception as e:
            print(f"Notice: Could not load existing screener_results: {e}")

    # Inject chop incubation leaders into the screener payload
    existing_data["chop_incubation_leaders"] = [
        {
            "ticker": c["ticker"],
            "metric": c["metric"],
            "score": c["score"]
        }
        for c in candidates
    ]

    with open(output_path, 'w') as f:
        json.dump(existing_data, f, indent=2)

    print(f"Successfully updated {output_path} with {len(candidates)} Next-Leg Leaders.")
    return candidates

if __name__ == "__main__":
    leaders = update_screener_results_file()
    for l in leaders[:10]:
        print(f"• {l['ticker']:<5} | {l['metric']} | Score: {l['score']}")
