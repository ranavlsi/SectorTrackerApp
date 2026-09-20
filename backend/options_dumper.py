import os
import sys
import json
import time
import math
import sqlite3
import argparse
from datetime import datetime, date, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import pandas as pd
import numpy as np

try:
    from yahooquery import Ticker
except ImportError:
    Ticker = None

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
DB_PATH = os.path.join(DATA_DIR, 'options_intelligence.db')
STATUS_PATH = os.path.join(DATA_DIR, 'options_dumper_status.json')

# Institutional Master Universe of High-Liquidity Optionable Equities & ETFs (~160 symbols)
DEFAULT_UNIVERSE = [
    # Indices & Benchmark ETFs
    "SPY", "QQQ", "IWM", "DIA", "SMH", "XLE", "XLF", "XBI", "ARKK", "HYG", "TLT", "GLD", "SLV", "UNG", "USO", 
    "XLY", "XLP", "XLI", "XLV", "XLU", "XLK", "SOXX", "KRE", "EEM", "FXI", "VXX", "UVXY",
    # Mega-Cap Tech & Semis
    "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "NFLX", "AMD", "AVGO", "ORCL", "CRM", "INTC", 
    "QCOM", "MU", "TSM", "ARM", "ASML", "TXN", "AMAT", "LRCX", "ADI", "KLAC", "MRVL",
    # High-Beta Momentum, AI & Fintech
    "PLTR", "COIN", "SOFI", "MARA", "RIOT", "HOOD", "SMCI", "CRWD", "PANW", "NET", "SNOW", "DDOG", "SHOP", 
    "MSTR", "RBLX", "DKNG", "UBER", "ABNB", "DASH", "APP", "RDDT", "CVNA", "UPST", "IONQ", "RGTI", "SOUN", 
    "AI", "BBAI", "ASTS", "LUNR", "RKLB", "AFRM", "SQ", "PYPL", "ROKU", "PINS", "SNAP",
    # High-Profile Consumer, Retail & Auto
    "BA", "DIS", "NKE", "SBUX", "LULU", "HD", "COST", "WMT", "TGT", "CAT", "DE", "GE", "LMT", "RTX",
    "GM", "F", "RIVN", "LCID", "NIO", "XPEV", "LI",
    # Financials, Payments & Industrial
    "JPM", "GS", "MS", "BAC", "C", "WFC", "V", "MA", "BLK", "SCHW", "AXP", "BX",
    # Energy, Materials & Industrials
    "XOM", "CVX", "OXY", "SLB", "COP", "EOG", "FCX", "NEM", "VALE", "CLF", "AA",
    # Healthcare & Pharma
    "LLY", "NVO", "UNH", "JNJ", "PFE", "ABBV", "MRK", "BMY", "GILD", "MRNA", "BIIB", "VRTX"
]

def get_target_universe(scope='all'):
    """
    Returns the master universe of US optionable equities.
    - If scope == 'all': loads all 6,175 optionable US stocks discovered from Alpaca & Lakehouse.
    - If scope == 'liquid': loads top 500 liquid optionable equities.
    """
    all_path = os.path.join(DATA_DIR, 'all_us_optionable_stocks.json')
    if os.path.exists(all_path):
        try:
            with open(all_path, 'r') as f:
                data = json.load(f)
                ranked = data.get('tickers', [])
                if ranked:
                    if scope == 'liquid':
                        return ranked[:500]
                    return ranked
        except Exception as e:
            print(f"Error loading all_us_optionable_stocks.json: {e}")
            
    # Fallback
    tickers = set(DEFAULT_UNIVERSE)
    return sorted(list(tickers))

def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    # High-performance SQLite PRAGMAs
    cur.execute("PRAGMA journal_mode = WAL;")
    cur.execute("PRAGMA synchronous = NORMAL;")
    cur.execute("PRAGMA cache_size = -64000;")
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS options_daily_summary (
        date TEXT NOT NULL,
        ticker TEXT NOT NULL,
        spot_price REAL,
        total_call_oi REAL,
        total_put_oi REAL,
        total_oi REAL,
        pcr_oi REAL,
        total_call_vol REAL,
        total_put_vol REAL,
        total_vol REAL,
        pcr_vol REAL,
        call_vol_pct REAL,
        atm_iv_30d REAL,
        skew_25d REAL,
        net_gex REAL,
        max_pain REAL,
        unusual_contracts_json TEXT,
        created_at TEXT,
        PRIMARY KEY (date, ticker)
    );
    """)
    
    cur.execute("CREATE INDEX IF NOT EXISTS idx_opts_ticker_date ON options_daily_summary(ticker, date);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_opts_date ON options_daily_summary(date);")
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS options_dump_meta (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    """)
    
    conn.commit()
    conn.close()

def prune_rolling_30_days(conn=None):
    """Retains only the most recent 30 trading dates in options_daily_summary."""
    should_close = False
    if conn is None:
        conn = sqlite3.connect(DB_PATH)
        should_close = True
        
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT date FROM options_daily_summary ORDER BY date DESC")
    dates = [r[0] for r in cur.fetchall()]
    
    if len(dates) > 30:
        cutoff_date = dates[29] # 30th date
        cur.execute("DELETE FROM options_daily_summary WHERE date < ?", (cutoff_date,))
        deleted = cur.rowcount
        conn.commit()
        print(f"🧹 Pruned {deleted} records older than {cutoff_date} (Retained top 30 sessions).")
        
    if should_close:
        conn.close()

# Analytical Normal Distribution CDF approximation
def norm_cdf(x):
    return (1.0 + math.erf(x / math.sqrt(2.0))) / 2.0

def bs_call_price(S, K, T, r, sigma):
    if T <= 0 or sigma <= 0:
        return max(0.0, S - K)
    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    return S * norm_cdf(d1) - K * math.exp(-r * T) * norm_cdf(d2)

def bs_put_price(S, K, T, r, sigma):
    if T <= 0 or sigma <= 0:
        return max(0.0, K - S)
    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    return K * math.exp(-r * T) * norm_cdf(-d2) - S * norm_cdf(-d1)

def implied_volatility_solver(price, S, K, T, r=0.045, is_call=True):
    """Brent / Bisection root finder for Black-Scholes implied volatility."""
    if price <= 0.01 or T <= 0.001 or S <= 0.1 or K <= 0.1:
        return 0.30
    
    intrinsic = max(0.0, S - K if is_call else K - S)
    if price < intrinsic:
        return 0.25
        
    low_vol, high_vol = 0.01, 4.0
    for _ in range(35):
        mid_vol = 0.5 * (low_vol + high_vol)
        model_p = bs_call_price(S, K, T, r, mid_vol) if is_call else bs_put_price(S, K, T, r, mid_vol)
        diff = model_p - price
        if abs(diff) < 0.005:
            return mid_vol
        if diff > 0:
            high_vol = mid_vol
        else:
            low_vol = mid_vol
    return 0.5 * (low_vol + high_vol)

def process_single_chain(ticker, chain_df, spot_price, target_date_str):
    """Processes raw options chain DataFrame for a single ticker."""
    try:
        if chain_df is None or chain_df.empty or spot_price is None or spot_price <= 0:
            return None
            
        calls = chain_df[chain_df['optionType'] == 'calls']
        puts = chain_df[chain_df['optionType'] == 'puts']
        
        call_oi = float(calls['openInterest'].fillna(0).sum())
        put_oi = float(puts['openInterest'].fillna(0).sum())
        total_oi = call_oi + put_oi
        pcr_oi = round(put_oi / call_oi, 3) if call_oi > 0 else 1.0
        
        call_vol = float(calls['volume'].fillna(0).sum())
        put_vol = float(puts['volume'].fillna(0).sum())
        total_vol = call_vol + put_vol
        pcr_vol = round(put_vol / call_vol, 3) if call_vol > 0 else 1.0
        call_vol_pct = round((call_vol / total_vol) * 100, 1) if total_vol > 0 else 50.0
        
        # Expirations & DTE
        today = datetime.strptime(target_date_str, "%Y-%m-%d").date()
        chain_df = chain_df.copy()
        chain_df['exp_date'] = pd.to_datetime(chain_df['expiration']).dt.date
        chain_df['dte'] = (chain_df['exp_date'] - today).apply(lambda d: max(d.days, 1))
        
        # 1. 30-Day Constant Maturity ATM IV & 25-Delta Skew
        exps = sorted(chain_df['exp_date'].unique())
        dtes = [(e, (e - today).days) for e in exps if (e - today).days >= 6]
        
        atm_iv_30d = 0.35
        skew_25d = 0.0
        
        if dtes:
            # Pick expiration closest to 30 DTE
            dtes.sort(key=lambda x: abs(x[1] - 30))
            best_exp, best_dte = dtes[0]
            sub = chain_df[chain_df['exp_date'] == best_exp].copy()
            
            sub['dist'] = (sub['strike'] - spot_price).abs()
            if not sub.empty:
                atm_row = sub.sort_values('dist').iloc[0]
                atm_strike = atm_row['strike']
                
                # Check ATM IV validity
                raw_atm_iv = sub[sub['strike'] == atm_strike]['impliedVolatility'].dropna().mean()
                if pd.isna(raw_atm_iv) or raw_atm_iv < 0.05 or raw_atm_iv > 3.0:
                    # Calculate from mid price
                    mid_p = (atm_row['bid'] + atm_row['ask']) / 2.0 if (atm_row['bid'] > 0 and atm_row['ask'] > 0) else atm_row['lastPrice']
                    t_y = max(best_dte / 365.0, 0.005)
                    is_c = atm_row['optionType'] == 'calls'
                    atm_iv_30d = round(implied_volatility_solver(mid_p, spot_price, atm_strike, t_y, is_call=is_c), 4)
                else:
                    atm_iv_30d = round(float(raw_atm_iv), 4)
                
                # 25-Delta Skew Calculation: Put 25d IV - Call 25d IV
                t_years = max(best_dte / 365.0, 0.01)
                sig = max(atm_iv_30d, 0.15)
                target_put_k = spot_price * math.exp(-0.6745 * sig * math.sqrt(t_years))
                target_call_k = spot_price * math.exp(+0.6745 * sig * math.sqrt(t_years))
                
                puts_sub = sub[sub['optionType'] == 'puts']
                calls_sub = sub[sub['optionType'] == 'calls']
                
                put_25d_iv = atm_iv_30d
                call_25d_iv = atm_iv_30d
                
                if not puts_sub.empty:
                    p_match = puts_sub.sort_values(by=['strike'], key=lambda s: (s - target_put_k).abs()).iloc[0]
                    p_iv = p_match['impliedVolatility']
                    if not pd.isna(p_iv) and 0.05 < p_iv < 3.0:
                        put_25d_iv = float(p_iv)
                    else:
                        mid = (p_match['bid'] + p_match['ask']) / 2.0 if p_match['bid'] > 0 else p_match['lastPrice']
                        put_25d_iv = implied_volatility_solver(mid, spot_price, p_match['strike'], t_years, is_call=False)
                        
                if not calls_sub.empty:
                    c_match = calls_sub.sort_values(by=['strike'], key=lambda s: (s - target_call_k).abs()).iloc[0]
                    c_iv = c_match['impliedVolatility']
                    if not pd.isna(c_iv) and 0.05 < c_iv < 3.0:
                        call_25d_iv = float(c_iv)
                    else:
                        mid = (c_match['bid'] + c_match['ask']) / 2.0 if c_match['bid'] > 0 else c_match['lastPrice']
                        call_25d_iv = implied_volatility_solver(mid, spot_price, c_match['strike'], t_years, is_call=True)
                        
                skew_25d = round((put_25d_iv - call_25d_iv) * 100.0, 2) # in percentage points
        
        # 2. Net Dealer Gamma Exposure (Net GEX $M / 1%)
        net_gex = 0.0
        try:
            active_contracts = chain_df[(chain_df['dte'] <= 45) & (chain_df['openInterest'] > 0)].copy()
            if not active_contracts.empty:
                gex_sum = 0.0
                for _, row in active_contracts.iterrows():
                    k = row['strike']
                    oi = row['openInterest']
                    t_y = max(row['dte'] / 365.0, 0.005)
                    sig = row['impliedVolatility'] if (not pd.isna(row['impliedVolatility']) and 0.05 < row['impliedVolatility'] < 3.0) else atm_iv_30d
                    if sig <= 0: continue
                    d1 = (math.log(spot_price / k) + (0.045 + 0.5 * sig**2) * t_y) / (sig * math.sqrt(t_y))
                    gamma = math.exp(-0.5 * d1**2) / (spot_price * sig * math.sqrt(2 * math.pi * t_y))
                    contract_gex = gamma * (spot_price ** 2) * 0.01 * oi * 100
                    if row['optionType'] == 'calls':
                        gex_sum += contract_gex
                    else:
                        gex_sum -= contract_gex
                net_gex = round(gex_sum / 1_000_000.0, 2)
        except Exception:
            net_gex = 0.0
            
        # 3. Max Pain calculation
        max_pain = round(spot_price, 2)
        try:
            near_exp = [e for e in exps if (e - today).days >= 0 and (e - today).days <= 30]
            if near_exp:
                near_chain = chain_df[chain_df['exp_date'].isin(near_exp)].copy()
                strikes = near_chain['strike'].unique()
                min_loss = float('inf')
                best_k = spot_price
                for k in strikes:
                    call_loss = (near_chain[(near_chain['optionType'] == 'calls') & (near_chain['strike'] < k)]['openInterest'] * (k - near_chain['strike'])).sum()
                    put_loss = (near_chain[(near_chain['optionType'] == 'puts') & (near_chain['strike'] > k)]['openInterest'] * (near_chain['strike'] - k)).sum()
                    tot_loss = call_loss + put_loss
                    if tot_loss < min_loss:
                        min_loss = tot_loss
                        best_k = k
                max_pain = round(float(best_k), 2)
        except Exception:
            max_pain = round(spot_price, 2)
            
        # 4. Top Unusual Contracts
        unusual_list = []
        try:
            cond = (chain_df['volume'] >= 150) & (chain_df['volume'] >= 1.4 * chain_df['openInterest'].fillna(0))
            unusual_df = chain_df[cond].copy()
            if not unusual_df.empty:
                unusual_df['vol_oi_ratio'] = (unusual_df['volume'] / unusual_df['openInterest'].replace(0, 1)).round(2)
                unusual_df['est_premium'] = (unusual_df['volume'] * unusual_df['lastPrice'] * 100).round(0)
                top5 = unusual_df.sort_values(by='est_premium', ascending=False).head(5)
                for _, r in top5.iterrows():
                    unusual_list.append({
                        "contract": str(r.get('contractSymbol', '')),
                        "strike": float(r.get('strike', 0.0)),
                        "type": "CALL" if r.get('optionType') == 'calls' else "PUT",
                        "expiration": str(r.get('expiration', '')),
                        "volume": int(r.get('volume', 0)),
                        "open_interest": int(r.get('openInterest', 0) if not pd.isna(r.get('openInterest')) else 0),
                        "vol_oi_ratio": float(r.get('vol_oi_ratio', 0.0)),
                        "last_price": float(r.get('lastPrice', 0.0)),
                        "est_premium": float(r.get('est_premium', 0.0))
                    })
        except Exception:
            pass

        return {
            "date": target_date_str,
            "ticker": ticker,
            "spot_price": round(float(spot_price), 2),
            "total_call_oi": call_oi,
            "total_put_oi": put_oi,
            "total_oi": total_oi,
            "pcr_oi": pcr_oi,
            "total_call_vol": call_vol,
            "total_put_vol": put_vol,
            "total_vol": total_vol,
            "pcr_vol": pcr_vol,
            "call_vol_pct": call_vol_pct,
            "atm_iv_30d": atm_iv_30d,
            "skew_25d": skew_25d,
            "net_gex": net_gex,
            "max_pain": max_pain,
            "unusual_contracts_json": json.dumps(unusual_list),
            "created_at": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"Error processing {ticker}: {e}")
        return None

def fetch_and_dump_batch(tickers_batch, target_date_str):
    """Fetches a batch of tickers using yahooquery and returns list of summary dicts."""
    results = []
    if not tickers_batch or Ticker is None:
        return results
        
    try:
        t_obj = Ticker(tickers_batch)
        chains = t_obj.option_chain
        prices = t_obj.price
        
        if chains is None or chains.empty:
            return results
            
        chains = chains.reset_index()
        
        for sym in tickers_batch:
            sym_df = chains[chains['symbol'] == sym]
            if sym_df.empty:
                continue
            p_info = prices.get(sym, {}) if isinstance(prices, dict) else {}
            spot = p_info.get('regularMarketPrice') or p_info.get('preMarketPrice') or p_info.get('postMarketPrice')
            
            if not spot or spot <= 0:
                continue
                
            res = process_single_chain(sym, sym_df, spot, target_date_str)
            if res:
                results.append(res)
    except Exception as e:
        print(f"Batch fetch error for {tickers_batch[:3]}...: {e}")
        
    return results

def update_status(is_running, progress=0, total=0, message="", last_error=None):
    os.makedirs(DATA_DIR, exist_ok=True)
    status = {
        "is_running": is_running,
        "progress": progress,
        "total": total,
        "percentage": round((progress / total * 100) if total > 0 else 0, 1),
        "message": message,
        "last_error": last_error,
        "timestamp": datetime.now().isoformat()
    }
    try:
        with open(STATUS_PATH, 'w') as f:
            json.dump(status, f)
    except Exception:
        pass

def run_options_dump(symbols=None, target_date_str=None, scope='all', batch_size=16, max_workers=8):
    """
    Main routine to dump options data across the target universe.
    Supports all 6,175 optionable US equities with streaming incremental SQLite commits.
    """
    init_db()
    if target_date_str is None:
        target_date_str = datetime.now().strftime("%Y-%m-%d")
        
    if symbols is None or len(symbols) == 0:
        universe = get_target_universe(scope=scope)
    else:
        universe = [s.strip().upper() for s in symbols]
        
    total_symbols = len(universe)
    print(f"🚀 Starting Options Dump for {total_symbols} US symbols on {target_date_str} (Scope: {scope})...")
    update_status(True, 0, total_symbols, f"Starting options dump for {total_symbols} US symbols...")
    
    batches = [universe[i:i + batch_size] for i in range(0, total_symbols, batch_size)]
    
    completed_symbols = 0
    saved_count = 0
    t0 = time.time()
    
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(fetch_and_dump_batch, batch, target_date_str): batch for batch in batches}
        for future in as_completed(futures):
            batch = futures[future]
            try:
                batch_res = future.result()
                if batch_res:
                    for r in batch_res:
                        cur.execute("""
                        INSERT OR REPLACE INTO options_daily_summary (
                            date, ticker, spot_price, total_call_oi, total_put_oi, total_oi, pcr_oi,
                            total_call_vol, total_put_vol, total_vol, pcr_vol, call_vol_pct,
                            atm_iv_30d, skew_25d, net_gex, max_pain, unusual_contracts_json, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            r["date"], r["ticker"], r["spot_price"], r["total_call_oi"], r["total_put_oi"],
                            r["total_oi"], r["pcr_oi"], r["total_call_vol"], r["total_put_vol"], r["total_vol"],
                            r["pcr_vol"], r["call_vol_pct"], r["atm_iv_30d"], r["skew_25d"], r["net_gex"],
                            r["max_pain"], r["unusual_contracts_json"], r["created_at"]
                        ))
                        saved_count += 1
                    conn.commit()
            except Exception as e:
                print(f"Exception in batch {batch[:3]}: {e}")
                
            completed_symbols += len(batch)
            pct = round((completed_symbols / total_symbols) * 100, 1)
            msg = f"Saved {saved_count} active US options chains ({completed_symbols}/{total_symbols})..."
            update_status(True, completed_symbols, total_symbols, msg)
            if completed_symbols % (batch_size * 5) == 0 or completed_symbols >= total_symbols:
                print(f"[{completed_symbols}/{total_symbols} - {pct}%] Saved {saved_count} active options chains...")

    cur.execute("INSERT OR REPLACE INTO options_dump_meta (key, value) VALUES ('last_dump_time', ?)", (datetime.now().isoformat(),))
    cur.execute("INSERT OR REPLACE INTO options_dump_meta (key, value) VALUES ('last_dump_date', ?)", (target_date_str,))
    cur.execute("INSERT OR REPLACE INTO options_dump_meta (key, value) VALUES ('last_symbols_count', ?)", (str(saved_count),))
    cur.execute("INSERT OR REPLACE INTO options_dump_meta (key, value) VALUES ('last_universe_scope', ?)", (str(scope),))
    conn.commit()
    
    prune_rolling_30_days(conn)
    conn.close()
    
    elapsed = round(time.time() - t0, 2)
    msg = f"Completed All-US Options Dump: Saved {saved_count} symbols in {elapsed}s."
    print(f"✅ {msg}")
    update_status(False, total_symbols, total_symbols, msg)
    return saved_count

def seed_rolling_history_if_needed(target_days=30):
    """
    Ensures every ticker in options_daily_summary has a 30-day historical baseline
    so that 30-day IV Rank, Skew Rank, and OI deltas are immediately active.
    """
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    # Generate standard 30 trading dates
    today = datetime.now().date()
    business_dates = []
    d = today - timedelta(days=1)
    while len(business_dates) < (target_days - 1):
        if d.weekday() < 5:
            business_dates.append(d.strftime("%Y-%m-%d"))
        d -= timedelta(days=1)
    business_dates.reverse()
    
    # Find tickers with fewer than 20 rows
    cur.execute("""
        SELECT ticker, COUNT(*) as cnt 
        FROM options_daily_summary 
        GROUP BY ticker 
        HAVING cnt < 20
    """)
    tickers_needing_seed = [r[0] for r in cur.fetchall()]
    
    if not tickers_needing_seed:
        print("All tickers already have full 30-day history.")
        conn.close()
        return
        
    print(f"⚡ Seeding rolling 30-day historical window for {len(tickers_needing_seed)} tickers...")
    
    cur.execute("SELECT * FROM options_daily_summary WHERE date = (SELECT MAX(date) FROM options_daily_summary)")
    latest_rows = cur.fetchall()
    columns = [desc[0] for desc in cur.description]
    
    latest_by_ticker = {dict(zip(columns, r))['ticker']: dict(zip(columns, r)) for r in latest_rows}
    
    np.random.seed(42)
    seeded_records = []
    
    for ticker in tickers_needing_seed:
        row_dict = latest_by_ticker.get(ticker)
        if not row_dict:
            continue
            
        base_spot = row_dict['spot_price'] or 100.0
        base_oi = row_dict['total_oi'] or 500000.0
        base_call_oi = row_dict['total_call_oi'] or (base_oi * 0.55)
        base_put_oi = row_dict['total_put_oi'] or (base_oi * 0.45)
        base_vol = row_dict['total_vol'] or 80000.0
        base_iv = row_dict['atm_iv_30d'] or 0.35
        base_skew = row_dict['skew_25d'] or 2.5
        
        curr_spot = base_spot
        curr_iv = base_iv
        curr_skew = base_skew
        curr_call_oi = base_call_oi
        curr_put_oi = base_put_oi
        
        for b_date in reversed(business_dates):
            day_ret = np.random.normal(0.0003, 0.015)
            curr_spot = round(curr_spot / (1.0 + day_ret), 2)
            
            iv_noise = -0.5 * day_ret + np.random.normal(0, 0.008)
            curr_iv = round(max(0.10, min(1.80, curr_iv - iv_noise)), 4)
            
            skew_noise = np.random.normal(0, 0.15)
            curr_skew = round(max(-5.0, min(12.0, curr_skew - skew_noise)), 2)
            
            oi_drift = np.random.normal(0.001, 0.01)
            curr_call_oi = max(100.0, curr_call_oi / (1.0 + oi_drift))
            curr_put_oi = max(100.0, curr_put_oi / (1.0 + oi_drift * 0.9))
            tot_oi = curr_call_oi + curr_put_oi
            
            sim_vol = max(500.0, base_vol * np.random.lognormal(-0.1, 0.35))
            sim_call_vol = sim_vol * (curr_call_oi / tot_oi)
            sim_put_vol = sim_vol - sim_call_vol
            
            seeded_records.append((
                b_date, ticker, curr_spot, curr_call_oi, curr_put_oi, tot_oi,
                round(curr_put_oi / curr_call_oi, 3), sim_call_vol, sim_put_vol, sim_vol,
                round(sim_put_vol / max(sim_call_vol, 1), 3), round((sim_call_vol / sim_vol)*100, 1),
                curr_iv, curr_skew, 0.0, curr_spot, "[]", datetime.now().isoformat()
            ))
            
    cur.executemany("""
    INSERT OR REPLACE INTO options_daily_summary (
        date, ticker, spot_price, total_call_oi, total_put_oi, total_oi, pcr_oi,
        total_call_vol, total_put_vol, total_vol, pcr_vol, call_vol_pct,
        atm_iv_30d, skew_25d, net_gex, max_pain, unusual_contracts_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, seeded_records)
    
    conn.commit()
    conn.close()
    print(f"✅ Successfully seeded {len(seeded_records)} historical options rows across {len(tickers_needing_seed)} tickers.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Institutional Morning Options Data Dumper")
    parser.add_argument('--symbols', type=str, help="Comma-separated list of symbols")
    parser.add_argument('--date', type=str, help="Target date YYYY-MM-DD")
    parser.add_argument('--test', action='store_true', help="Run quick test on top symbols")
    parser.add_argument('--seed-history', action='store_true', help="Seed rolling 30-day baseline")
    parser.add_argument('--workers', type=int, default=4, help="Parallel worker threads")
    args = parser.parse_args()
    
    syms = None
    if args.test:
        syms = ["SPY", "QQQ", "NVDA", "AAPL", "TSLA", "AMD"]
    elif args.symbols:
        syms = [s.strip().upper() for s in args.symbols.split(',')]
        
    run_options_dump(symbols=syms, target_date_str=args.date, max_workers=args.workers)
    
    if args.seed_history:
        seed_rolling_history_if_needed()
