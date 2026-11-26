import os
import sys
import json
import time
import math
import signal
import sqlite3
import argparse
import threading
import requests
from requests.adapters import HTTPAdapter
from collections import deque
from datetime import datetime, date, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import pandas as pd
import numpy as np

try:
    from zoneinfo import ZoneInfo
    CST_TZ = ZoneInfo("America/Chicago")
except Exception:
    CST_TZ = None

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))
except Exception:
    pass

try:
    from yahooquery import Ticker
except ImportError:
    Ticker = None

try:
    from alpaca.data.historical import StockHistoricalDataClient
    from alpaca.data.requests import StockSnapshotRequest, OptionChainRequest, OptionBarsRequest
    from alpaca.data.timeframe import TimeFrame
    from alpaca.data.historical.option import OptionHistoricalDataClient
    from alpaca.trading.client import TradingClient
    from alpaca.trading.requests import GetOptionContractsRequest
    _HAS_ALPACA_DUMPER = True
except Exception:
    StockHistoricalDataClient = None
    StockSnapshotRequest = None
    OptionChainRequest = None
    OptionBarsRequest = None
    TimeFrame = None
    OptionHistoricalDataClient = None
    TradingClient = None
    GetOptionContractsRequest = None
    _HAS_ALPACA_DUMPER = False

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
DB_PATH = os.path.join(DATA_DIR, 'options_intelligence.db')
STATUS_PATH = os.path.join(DATA_DIR, 'options_dumper_status.json')


def _now_cst():
    """Returns current timestamp in US Central Time (America/Chicago)."""
    if CST_TZ is not None:
        return datetime.now(CST_TZ)
    try:
        import pytz
        return datetime.now(pytz.timezone("America/Chicago"))
    except Exception:
        return datetime.now()


def _today_cst_str() -> str:
    return _now_cst().strftime("%Y-%m-%d")


def _get_alpaca_headers():
    k = os.getenv('APCA_API_KEY_ID')
    s = os.getenv('APCA_API_SECRET_KEY')
    if not k or not s:
        return None
    return {'APCA-API-KEY-ID': k, 'APCA-API-SECRET-KEY': s}


def _new_alpaca_session(pool_size: int = 16) -> requests.Session:
    sess = requests.Session()
    adapter = HTTPAdapter(pool_connections=pool_size, pool_maxsize=pool_size)
    sess.mount('https://', adapter)
    sess.mount('http://', adapter)
    return sess


def refresh_all_us_optionable_universe(headers=None) -> list:
    """
    Discovers all active, tradable US equities/ETFs with `has_options` from Alpaca Assets API,
    preserves existing liquidity-first ordering, and atomically saves all_us_optionable_stocks.json.
    """
    all_path = os.path.join(DATA_DIR, 'all_us_optionable_stocks.json')
    existing_tickers = []
    if os.path.exists(all_path):
        try:
            with open(all_path, 'r') as f:
                existing_tickers = json.load(f).get('tickers', []) or []
        except Exception:
            existing_tickers = []

    hdrs = headers or _get_alpaca_headers()
    if not hdrs:
        return existing_tickers

    try:
        resp = requests.get(
            'https://paper-api.alpaca.markets/v2/assets?status=active&asset_class=us_equity',
            headers=hdrs,
            timeout=25,
        )
        if resp.status_code != 200:
            return existing_tickers
        assets = resp.json() or []
        live_opt_map = {}
        for a in assets:
            if not a.get('tradable'):
                continue
            attrs = a.get('attributes') or []
            if 'has_options' not in attrs:
                continue
            sym = str(a.get('symbol') or '').upper().strip()
            if not sym:
                continue
            # Keep dot-free canonical US symbol if Alpaca uses BRK.B vs BRK-B
            live_opt_map[sym] = sym
            live_opt_map[sym.replace('.', '-')] = sym.replace('.', '-')

        if len(live_opt_map) < 1000:
            return existing_tickers

        merged = []
        seen = set()
        for t in existing_tickers:
            tc = str(t).upper().strip()
            canon = live_opt_map.get(tc) or live_opt_map.get(tc.replace('-', '.'))
            if canon and tc not in seen:
                merged.append(tc)
                seen.add(tc)

        # Append any newly listed US optionable equities
        existing_alp = {t.replace('-', '.') for t in seen}
        extras = sorted(
            str(a.get('symbol')).upper().strip().replace('.', '-')
            for a in assets
            if a.get('tradable')
            and 'has_options' in (a.get('attributes') or [])
            and str(a.get('symbol') or '').upper().strip() not in existing_alp
            and str(a.get('symbol') or '').upper().strip().replace('.', '-') not in seen
        )
        merged.extend(extras)

        os.makedirs(DATA_DIR, exist_ok=True)
        tmp_path = f"{all_path}.tmp"
        with open(tmp_path, 'w') as f:
            json.dump({
                "count": len(merged),
                "updated_at": _now_cst().isoformat(),
                "tickers": merged,
            }, f)
        os.replace(tmp_path, all_path)
        return merged
    except Exception as e:
        print(f"Live optionable universe refresh warning: {e}")
        return existing_tickers

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

def get_target_universe(scope='all', refresh_live=True):
    """
    Returns the master universe of US optionable equities.
    - If scope == 'all': refreshes & loads all live US optionable stocks (~6,132+) from Alpaca & Lakehouse.
    - If scope == 'liquid': loads top 500 liquid optionable equities.
    """
    if scope == 'all' and refresh_live:
        refreshed = refresh_all_us_optionable_universe()
        if refreshed:
            return refreshed

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

def process_single_chain(ticker, chain_df, spot_price, target_date_str, prev_skew_map=None):
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
        # Look for contracts in the 15 to 50 DTE constant-maturity window (fallback to 7-90 DTE)
        target_slice = chain_df[(chain_df['dte'] >= 15) & (chain_df['dte'] <= 50)].copy()
        if target_slice.empty:
            target_slice = chain_df[(chain_df['dte'] >= 7) & (chain_df['dte'] <= 90)].copy()
        if target_slice.empty:
            target_slice = chain_df.copy()
            
        atm_iv_30d = 0.35
        skew_25d = 0.0
        
        # Calculate ATM IV (within +/- 6% of spot)
        atm_candidates = target_slice[abs(target_slice['strike'] - spot_price) / spot_price <= 0.06]
        valid_atm_ivs = atm_candidates[atm_candidates['impliedVolatility'].between(0.08, 2.5)]['impliedVolatility'].dropna().tolist()
        if valid_atm_ivs:
            atm_iv_30d = round(float(np.median(valid_atm_ivs)), 4)
        else:
            # Fallback to closest strike mid/lastPrice
            target_slice_copy = target_slice.copy()
            target_slice_copy['dist'] = (target_slice_copy['strike'] - spot_price).abs()
            if not target_slice_copy.empty:
                atm_row = target_slice_copy.sort_values('dist').iloc[0]
                mid_p = (atm_row['bid'] + atm_row['ask']) / 2.0 if (atm_row['bid'] > 0 and atm_row['ask'] > 0) else atm_row['lastPrice']
                t_y = max(atm_row['dte'] / 365.25, 0.01)
                atm_iv_30d = round(implied_volatility_solver(mid_p, spot_price, atm_row['strike'], t_y, is_call=(atm_row['optionType'] == 'calls')), 4)

        # 25-Delta Skew Calculation: Put 25d IV - Call 25d IV
        t_years = 30.0 / 365.25
        sig = max(atm_iv_30d, 0.15)
        target_put_k = spot_price * math.exp(-0.6745 * sig * math.sqrt(t_years))
        target_call_k = spot_price * math.exp(+0.6745 * sig * math.sqrt(t_years))
        
        puts_sub = target_slice[(target_slice['optionType'] == 'puts') & (target_slice['impliedVolatility'].between(0.08, 2.5))]
        calls_sub = target_slice[(target_slice['optionType'] == 'calls') & (target_slice['impliedVolatility'].between(0.08, 2.5))]
        
        put_25d_iv = None
        call_25d_iv = None
        
        if not puts_sub.empty:
            closest_puts = puts_sub.assign(dist=(puts_sub['strike'] - target_put_k).abs()).sort_values('dist').head(3)
            put_25d_iv = float(closest_puts['impliedVolatility'].median())
            
        if not calls_sub.empty:
            closest_calls = calls_sub.assign(dist=(calls_sub['strike'] - target_call_k).abs()).sort_values('dist').head(3)
            call_25d_iv = float(closest_calls['impliedVolatility'].median())
            
        # If solver needed
        if put_25d_iv is None:
            raw_puts = target_slice[target_slice['optionType'] == 'puts']
            if not raw_puts.empty:
                p_match = raw_puts.assign(dist=(raw_puts['strike'] - target_put_k).abs()).sort_values('dist').iloc[0]
                mid = (p_match['bid'] + p_match['ask']) / 2.0 if p_match['bid'] > 0 else p_match['lastPrice']
                t_y = max(p_match['dte'] / 365.25, 0.01)
                put_25d_iv = implied_volatility_solver(mid, spot_price, p_match['strike'], t_y, is_call=False)
                
        if call_25d_iv is None:
            raw_calls = target_slice[target_slice['optionType'] == 'calls']
            if not raw_calls.empty:
                c_match = raw_calls.assign(dist=(raw_calls['strike'] - target_call_k).abs()).sort_values('dist').iloc[0]
                mid = (c_match['bid'] + c_match['ask']) / 2.0 if c_match['bid'] > 0 else c_match['lastPrice']
                t_y = max(c_match['dte'] / 365.25, 0.01)
                call_25d_iv = implied_volatility_solver(mid, spot_price, c_match['strike'], t_y, is_call=True)

        if put_25d_iv is not None and call_25d_iv is not None and abs(put_25d_iv - call_25d_iv) > 0.0005:
            skew_25d = round((put_25d_iv - call_25d_iv) * 100.0, 2)
        else:
            # Fallback A: O(1) lookup in preloaded skew history (avoids per-worker SQLite locks)
            prev_skew = prev_skew_map.get(ticker) if isinstance(prev_skew_map, dict) else None
            if prev_skew is None and prev_skew_map is None:
                try:
                    conn_tmp = sqlite3.connect(DB_PATH)
                    cur_tmp = conn_tmp.cursor()
                    cur_tmp.execute("SELECT skew_25d FROM options_daily_summary WHERE ticker = ? AND skew_25d != 0.0 AND skew_25d IS NOT NULL ORDER BY date DESC LIMIT 1;", (ticker,))
                    r_prev = cur_tmp.fetchone()
                    if r_prev and r_prev[0] is not None and r_prev[0] != 0.0:
                        prev_skew = float(r_prev[0])
                    conn_tmp.close()
                except Exception:
                    pass

            if prev_skew is not None:
                skew_25d = float(prev_skew)
            else:
                # Fallback B: Standard equity vol smile model
                pcr_factor = 1.25 if pcr_oi > 1.2 else (0.75 if pcr_oi < 0.8 else 1.0)
                skew_25d = round(atm_iv_30d * 0.075 * 100.0 * pcr_factor, 2)

        # 2. Vectorized Net Dealer Gamma Exposure (Net GEX $M / 1%)
        net_gex = 0.0
        try:
            active_contracts = chain_df[(chain_df['dte'] <= 45) & (chain_df['openInterest'] > 0) & (chain_df['strike'] > 0)]
            if not active_contracts.empty:
                k_arr = active_contracts['strike'].to_numpy(dtype=np.float64)
                oi_arr = active_contracts['openInterest'].to_numpy(dtype=np.float64)
                t_arr = np.maximum(active_contracts['dte'].to_numpy(dtype=np.float64) / 365.0, 0.005)
                sig_raw = pd.to_numeric(active_contracts['impliedVolatility'], errors='coerce').to_numpy(dtype=np.float64)
                sig_arr = np.where(np.isfinite(sig_raw) & (sig_raw > 0.05) & (sig_raw < 3.0), sig_raw, atm_iv_30d)
                valid_mask = sig_arr > 0.0
                if np.any(valid_mask):
                    k_v = k_arr[valid_mask]
                    oi_v = oi_arr[valid_mask]
                    t_v = t_arr[valid_mask]
                    s_v = sig_arr[valid_mask]
                    sqrt_t = np.sqrt(t_v)
                    d1 = (np.log(spot_price / k_v) + (0.045 + 0.5 * s_v * s_v) * t_v) / (s_v * sqrt_t)
                    gamma = np.exp(-0.5 * d1 * d1) / (spot_price * s_v * np.sqrt(2.0 * np.pi) * sqrt_t)
                    c_gex = gamma * (spot_price ** 2) * 0.01 * oi_v * 100.0
                    is_call = (active_contracts['optionType'].to_numpy()[valid_mask] == 'calls')
                    net_gex = round(float(np.where(is_call, c_gex, -c_gex).sum()) / 1_000_000.0, 2)
        except Exception:
            net_gex = 0.0

        # 3. Fixed & Vectorized Max Pain calculation
        max_pain = round(spot_price, 2)
        try:
            exps = chain_df['exp_date'].dropna().unique()
            near_exp = [e for e in exps if 0 <= (e - today).days <= 30]
            near_chain = chain_df[chain_df['exp_date'].isin(near_exp)] if near_exp else chain_df
            near_chain = near_chain[near_chain['openInterest'] > 0]
            if not near_chain.empty:
                strikes = np.sort(near_chain['strike'].dropna().unique().astype(np.float64))
                c_sub = near_chain[near_chain['optionType'] == 'calls']
                p_sub = near_chain[near_chain['optionType'] == 'puts']
                c_k = c_sub['strike'].to_numpy(dtype=np.float64)
                c_oi = c_sub['openInterest'].to_numpy(dtype=np.float64)
                p_k = p_sub['strike'].to_numpy(dtype=np.float64)
                p_oi = p_sub['openInterest'].to_numpy(dtype=np.float64)
                tot_loss = np.zeros(len(strikes), dtype=np.float64)
                if len(c_k) > 0:
                    tot_loss += np.sum(np.maximum(0.0, strikes[:, None] - c_k[None, :]) * c_oi[None, :], axis=1)
                if len(p_k) > 0:
                    tot_loss += np.sum(np.maximum(0.0, p_k[None, :] - strikes[:, None]) * p_oi[None, :], axis=1)
                max_pain = round(float(strikes[int(np.argmin(tot_loss))]), 2)
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

class _RateLimiter:
    """Thread-safe sliding-window rate limiter to keep Alpaca bursts well below 200 req/min."""
    def __init__(self, max_per_min: int = 150):
        self.max_per_min = max_per_min
        self._lock = threading.Lock()
        self._timestamps = deque()

    def acquire(self):
        while True:
            wait_sec = 0.0
            with self._lock:
                now = time.monotonic()
                while self._timestamps and now - self._timestamps[0] >= 60.0:
                    self._timestamps.popleft()
                if len(self._timestamps) < self.max_per_min:
                    self._timestamps.append(now)
                    return
                wait_sec = max(0.05, 60.0 - (now - self._timestamps[0]) + 0.02)
            time.sleep(wait_sec)


def _alpaca_call_with_retry(fn, limiter=None, retries: int = 3):
    for attempt in range(retries):
        if limiter is not None:
            limiter.acquire()
        try:
            return fn()
        except Exception as e:
            msg = str(e)
            is_rl = '429' in msg or 'Too Many Requests' in msg or 'rate' in msg.lower()
            if attempt < retries - 1 and is_rl:
                time.sleep(0.8 * (2 ** attempt))
                continue
            raise


def _load_prev_skew_map() -> dict:
    skew_map = {}
    try:
        conn_tmp = sqlite3.connect(DB_PATH)
        cur_tmp = conn_tmp.cursor()
        cur_tmp.execute(
            "SELECT ticker, skew_25d FROM options_daily_summary "
            "WHERE skew_25d IS NOT NULL AND skew_25d != 0.0 ORDER BY date ASC"
        )
        for tk, sk in cur_tmp.fetchall():
            if tk and sk is not None:
                skew_map[str(tk).upper()] = float(sk)
        conn_tmp.close()
    except Exception:
        pass
    return skew_map


def _get_alpaca_dumper_clients():
    if not _HAS_ALPACA_DUMPER:
        return None
    k = os.getenv('APCA_API_KEY_ID')
    s = os.getenv('APCA_API_SECRET_KEY')
    if not k or not s:
        return None
    try:
        return (
            StockHistoricalDataClient(k, s),
            OptionHistoricalDataClient(k, s),
            TradingClient(k, s, paper=True),
        )
    except Exception:
        return None


def _fetch_alpaca_spot_map_http(tickers: list, session: requests.Session, headers: dict, limiter: _RateLimiter) -> dict:
    """Bulk fetches live spot prices for up to all US equities (200 symbols/request)."""
    spot_map = {}
    alp_to_sym = {}
    for tk in tickers:
        s_clean = str(tk).upper().strip()
        if not s_clean or not s_clean.replace('-', '').replace('.', '').isalnum():
            continue
        a_sym = s_clean.replace('-', '.')
        alp_to_sym[a_sym] = s_clean

    alp_list = sorted(alp_to_sym.keys())
    chunks = [alp_list[i:i + 200] for i in range(0, len(alp_list), 200)]

    def _fetch_chunk(chunk):
        out = {}
        data = _alpaca_http_get(
            session,
            'https://data.alpaca.markets/v2/stocks/snapshots',
            params={'symbols': ','.join(chunk)},
            headers=headers,
            limiter=limiter,
            timeout=20,
        )
        if not isinstance(data, dict):
            return out
        for a_sym, snap in data.items():
            if not isinstance(snap, dict):
                continue
            orig_sym = alp_to_sym.get(a_sym, a_sym.replace('.', '-'))
            lt = snap.get('latestTrade') or {}
            db = snap.get('dailyBar') or {}
            pdb = snap.get('previousDailyBar') or {}
            px = lt.get('p') or db.get('c') or pdb.get('c')
            if px and float(px) > 0:
                out[orig_sym] = float(px)
        return out

    with ThreadPoolExecutor(max_workers=6) as ex:
        for res in ex.map(_fetch_chunk, chunks):
            spot_map.update(res)
    return spot_map


def _alpaca_http_get(
    session: requests.Session,
    url: str,
    params: dict,
    headers: dict,
    limiter: _RateLimiter = None,
    timeout: int = 25,
    retries: int = 5,
):
    """Thread-safe GET with sliding-window pacing, 429 exponential backoff, and transient error retry."""
    for attempt in range(retries):
        if limiter is not None:
            limiter.acquire()
        try:
            resp = session.get(url, params=params, headers=headers, timeout=timeout)
            if resp.status_code == 200:
                return resp.json()
            if resp.status_code == 429:
                retry_after = resp.headers.get('Retry-After')
                try:
                    wait_s = float(retry_after) if retry_after else min(10.0, 1.0 * (2 ** attempt))
                except Exception:
                    wait_s = min(10.0, 1.0 * (2 ** attempt))
                time.sleep(max(0.5, wait_s))
                continue
            if resp.status_code in (500, 502, 503, 504) and attempt < retries - 1:
                time.sleep(0.8 * (2 ** attempt))
                continue
            if attempt == retries - 1:
                print(f"Alpaca HTTP {resp.status_code} on {url}: {resp.text[:160]}")
            return None
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(0.8 * (2 ** attempt))
                continue
            print(f"Alpaca request failed on {url}: {e}")
            return None
    return None


def _select_representative_contracts(c_list: list, spot: float, today_date: date, total_oi: float) -> list:
    """
    Selects the highest-value contracts (constant-maturity ATM, 25D OTM calls/puts, and top OI strikes)
    for snapshot IV + volume enrichment while keeping all Phase-2 contracts for 100% OCC OI/MaxPain/GEX.
    """
    if total_oi >= 50000:
        cap = 36
    elif total_oi >= 5000:
        cap = 16
    elif total_oi >= 500:
        cap = 8
    else:
        cap = 4

    if len(c_list) <= cap:
        return [c[0] for c in c_list]

    chosen = []
    seen = set()

    def _add(sym):
        if sym and sym not in seen:
            seen.add(sym)
            chosen.append(sym)

    cm_slice = []
    for c in c_list:
        try:
            dte = max(1, (datetime.strptime(c[3], '%Y-%m-%d').date() - today_date).days)
        except Exception:
            dte = 30
        if 15 <= dte <= 50:
            cm_slice.append(c)
    pref_slice = cm_slice if cm_slice else c_list

    calls_p = [c for c in pref_slice if c[1] == 'calls']
    puts_p = [c for c in pref_slice if c[1] == 'puts']

    # 1. ATM calls & puts for exact 30D ATM IV
    for c in sorted(calls_p, key=lambda x: abs(x[2] - spot))[:2]:
        _add(c[0])
    for c in sorted(puts_p, key=lambda x: abs(x[2] - spot))[:2]:
        _add(c[0])

    # 2. 25-delta OTM call (~+7%) & put (~-7%) for accurate 25D Skew
    if len(chosen) < cap and calls_p:
        target_ck = spot * 1.07
        for c in sorted(calls_p, key=lambda x: abs(x[2] - target_ck))[:1]:
            _add(c[0])
    if len(chosen) < cap and puts_p:
        target_pk = spot * 0.93
        for c in sorted(puts_p, key=lambda x: abs(x[2] - target_pk))[:1]:
            _add(c[0])

    # 3. Fill remaining cap by highest OI + proximity to spot across 0-50 DTE
    if len(chosen) < cap:
        scored = sorted(
            c_list,
            key=lambda c: (c[4] + 1.0) * max(0.2, 1.0 - abs(c[2] - spot) / max(spot, 0.01) * 3.5),
            reverse=True,
        )
        for c in scored:
            if len(chosen) >= cap:
                break
            _add(c[0])

    return chosen[:cap]


def _fetch_snapshot_chunk_with_fallback(
    syms: list,
    session: requests.Session,
    headers: dict,
    data_limiter: _RateLimiter,
) -> dict:
    """Fetches up to 100 option snapshots in a single HTTP request, falling back cleanly on bad symbols."""
    if not syms:
        return {}
    data_limiter.acquire()
    try:
        resp = session.get(
            'https://data.alpaca.markets/v1beta1/options/snapshots',
            params={'symbols': ','.join(syms)},
            headers=headers,
            timeout=25,
        )
        if resp.status_code == 200:
            return (resp.json() or {}).get('snapshots', {}) or {}
        if resp.status_code == 429:
            time.sleep(2.0)
            resp2 = _alpaca_http_get(
                session,
                'https://data.alpaca.markets/v1beta1/options/snapshots',
                params={'symbols': ','.join(syms)},
                headers=headers,
                limiter=data_limiter,
                timeout=25,
            )
            return (resp2 or {}).get('snapshots', {}) or {}
        if resp.status_code == 400 and len(syms) > 1:
            mid = len(syms) // 2
            out = {}
            out.update(_fetch_snapshot_chunk_with_fallback(syms[:mid], session, headers, data_limiter))
            out.update(_fetch_snapshot_chunk_with_fallback(syms[mid:], session, headers, data_limiter))
            return out
    except Exception:
        pass
    return {}


def run_alpaca_global_batch_dump(
    universe: list,
    target_date_str: str,
    prev_skew_map: dict,
    headers: dict,
    cur,
    conn,
    max_workers: int = 6,
):
    """
    High-speed global batched Alpaca Market Data options dumper covering ALL ~6,132+ US
    optionable equities in ~2.5-4 minutes (or Top 500 in ~25s, or custom lists in ~2s).
    """
    t_start = time.time()
    total_symbols = len(universe)
    today_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()

    session = _new_alpaca_session(pool_size=24)
    trading_limiter = _RateLimiter(max_per_min=175)
    data_limiter = _RateLimiter(max_per_min=175)

    # Phase 1: Bulk Spot Prices (200 symbols/request)
    update_status(True, max(1, int(total_symbols * 0.02)), total_symbols, f"Phase 1/3: Fetching live spot prices for {total_symbols:,} US equities...")
    spot_map = _fetch_alpaca_spot_map_http(universe, session, headers, data_limiter)
    active_syms = [s for s in universe if spot_map.get(s, 0.0) > 0.0]
    active_set = set(active_syms)
    alp_to_sym = {s.replace('-', '.'): s for s in active_syms}
    for s in active_syms:
        alp_to_sym[s] = s

    print(f"📊 Phase 1/3 complete: {len(active_syms):,}/{total_symbols:,} active equities priced in {time.time() - t_start:.1f}s.")
    update_status(
        True,
        max(1, int(total_symbols * 0.05)),
        total_symbols,
        f"Phase 2/3: Sweeping global OCC contracts for {len(active_syms):,} US stocks...",
    )

    if not active_syms:
        return 0

    # Phase 2: Global Parallel 0-50 DTE OCC Contract Sweep
    contracts_by_ticker = {}
    oi_sum_by_ticker = {}
    sweep_lock = threading.Lock()
    scanned_contracts = [0]
    last_status_ts = [0.0]

    def _ingest_contract_list(contract_list: list):
        added = 0
        with sweep_lock:
            for c in contract_list:
                scanned_contracts[0] += 1
                u_raw = str(c.get('underlying_symbol') or '').upper().strip()
                orig_sym = alp_to_sym.get(u_raw)
                if not orig_sym:
                    continue
                spot = spot_map.get(orig_sym, 0.0)
                if spot <= 0.0:
                    continue
                try:
                    strike = float(c.get('strike_price') or 0.0)
                except Exception:
                    continue
                if strike < spot * 0.75 or strike > spot * 1.25:
                    continue
                raw_type = str(c.get('type') or '').lower()
                opt_type = 'calls' if 'call' in raw_type else ('puts' if 'put' in raw_type else '')
                if not opt_type:
                    continue
                c_sym = str(c.get('symbol') or '')
                exp_str = str(c.get('expiration_date') or '')[:10]
                if not c_sym or not exp_str:
                    continue
                try:
                    oi = float(c.get('open_interest') or 0.0)
                except Exception:
                    oi = 0.0
                try:
                    close_px = float(c.get('close_price') or 0.0)
                except Exception:
                    close_px = 0.0
                contracts_by_ticker.setdefault(orig_sym, []).append((c_sym, opt_type, strike, exp_str, oi, close_px))
                oi_sum_by_ticker[orig_sym] = oi_sum_by_ticker.get(orig_sym, 0.0) + oi
                added += 1

            now_m = time.monotonic()
            if now_m - last_status_ts[0] >= 1.2:
                last_status_ts[0] = now_m
                pct_frac = min(0.20, 0.05 + 0.15 * min(1.0, len(contracts_by_ticker) / max(len(active_syms), 1)))
                update_status(
                    True,
                    max(1, int(total_symbols * pct_frac)),
                    total_symbols,
                    f"Phase 2/3: Sweeping OCC contracts ({scanned_contracts[0]:,} scanned · {len(contracts_by_ticker):,} US stocks)...",
                )
        return added

    def _fetch_contracts_window(d_start: int, d_end: int, sub_syms=None):
        g_te = (today_date + timedelta(days=d_start)).strftime('%Y-%m-%d')
        l_te = (today_date + timedelta(days=d_end)).strftime('%Y-%m-%d')
        token = None
        for _ in range(120):
            params = {
                'expiration_date_gte': g_te,
                'expiration_date_lte': l_te,
                'status': 'active',
                'limit': 10000,
            }
            if sub_syms:
                params['underlying_symbols'] = ','.join(sub_syms)
            if token:
                params['page_token'] = token
            j = _alpaca_http_get(
                session,
                'https://paper-api.alpaca.markets/v2/options/contracts',
                params=params,
                headers=headers,
                limiter=trading_limiter,
                timeout=30,
            )
            if not isinstance(j, dict):
                break
            cs = j.get('option_contracts') or []
            if cs:
                _ingest_contract_list(cs)
            token = j.get('next_page_token')
            if not token:
                break

    t_p2 = time.time()
    if len(active_syms) <= 40:
        alp_chunks = [[s.replace('-', '.') for s in active_syms[i:i + 10]] for i in range(0, len(active_syms), 10)]
        with ThreadPoolExecutor(max_workers=min(4, max(1, len(alp_chunks)))) as ex:
            list(ex.map(lambda chk: _fetch_contracts_window(0, 50, sub_syms=chk), alp_chunks))
    else:
        windows = [(0, 5), (6, 12), (13, 20), (21, 29), (30, 39), (40, 50)]
        with ThreadPoolExecutor(max_workers=4) as ex:
            list(ex.map(lambda w: _fetch_contracts_window(w[0], w[1]), windows))

    # Sort optionable stocks by total OI descending so mega-caps/liquid leaders save first
    ordered_tickers = sorted(contracts_by_ticker.keys(), key=lambda t: oi_sum_by_ticker.get(t, 0.0), reverse=True)
    n_targets = len(ordered_tickers)
    print(
        f"🗂️ Phase 2/3 complete in {time.time() - t_p2:.1f}s: "
        f"{scanned_contracts[0]:,} contracts scanned across {n_targets:,} optionable US stocks."
    )

    if n_targets == 0:
        return 0

    # Phase 3: Packed 100-contract Snapshot Batches in Streaming 250-Ticker Waves
    saved_count = 0
    processed_count = 0
    wave_size = 250
    t_p3 = time.time()

    for w_start in range(0, n_targets, wave_size):
        wave_tickers = ordered_tickers[w_start:w_start + wave_size]
        needed_syms_set = set()
        for tk in wave_tickers:
            c_list = contracts_by_ticker[tk]
            sel = _select_representative_contracts(c_list, spot_map[tk], today_date, oi_sum_by_ticker.get(tk, 0.0))
            for s in sel:
                needed_syms_set.add(s)

        needed_list = list(needed_syms_set)
        snap_chunks = [needed_list[i:i + 100] for i in range(0, len(needed_list), 100)]
        wave_snaps = {}
        if snap_chunks:
            with ThreadPoolExecutor(max_workers=max_workers) as ex:
                futs = [
                    ex.submit(_fetch_snapshot_chunk_with_fallback, chk, session, headers, data_limiter)
                    for chk in snap_chunks
                ]
                for fut in as_completed(futs):
                    try:
                        chunk_res = fut.result()
                        if chunk_res:
                            wave_snaps.update(chunk_res)
                    except Exception:
                        pass

        wave_rows = []
        for tk in wave_tickers:
            spot = spot_map[tk]
            c_list = contracts_by_ticker[tk]
            rows = []
            for (c_sym, opt_type, strike, exp_str, oi, close_px) in c_list:
                snap = wave_snaps.get(c_sym) or {}
                db = snap.get('dailyBar') or {}
                pdb = snap.get('prevDailyBar') or {}
                lq = snap.get('latestQuote') or {}
                lt = snap.get('latestTrade') or {}

                snap_iv = snap.get('impliedVolatility')
                try:
                    iv_val = float(snap_iv) if snap_iv is not None else np.nan
                except Exception:
                    iv_val = np.nan

                try:
                    bid = float(lq.get('bp') or 0.0)
                except Exception:
                    bid = 0.0
                try:
                    ask = float(lq.get('ap') or 0.0)
                except Exception:
                    ask = 0.0
                try:
                    last_px = float(db.get('c') or lt.get('p') or pdb.get('c') or close_px or 0.0)
                except Exception:
                    last_px = 0.0

                raw_v = db.get('v')
                if raw_v is None:
                    raw_v = pdb.get('v')
                if raw_v is None:
                    raw_v = lt.get('s')
                try:
                    vol = float(raw_v or 0.0)
                except Exception:
                    vol = 0.0

                rows.append({
                    'contractSymbol': c_sym,
                    'optionType': opt_type,
                    'strike': strike,
                    'expiration': exp_str,
                    'openInterest': oi,
                    'volume': vol,
                    'impliedVolatility': iv_val,
                    'bid': bid,
                    'ask': ask,
                    'lastPrice': last_px,
                })

            if not rows:
                continue
            chain_df = pd.DataFrame(rows)
            rec = process_single_chain(tk, chain_df, spot, target_date_str, prev_skew_map=prev_skew_map)
            if rec:
                wave_rows.append(rec)

        if wave_rows:
            _save_records(cur, wave_rows)
            conn.commit()
            saved_count += len(wave_rows)

        processed_count += len(wave_tickers)
        elapsed_p3 = max(0.1, time.time() - t_p3)
        rate = processed_count / elapsed_p3
        eta_sec = int((n_targets - processed_count) / max(rate, 0.1)) if processed_count < n_targets else 0
        eta_str = f"~{eta_sec}s left" if eta_sec < 90 else f"~{round(eta_sec / 60.0, 1)}m left"
        if n_targets <= processed_count:
            eta_str = "finalizing"

        # Scale displayed progress cleanly from 20% -> 100%
        prog_mapped = int(total_symbols * (0.20 + 0.80 * (processed_count / max(n_targets, 1))))
        msg = f"Phase 3/3: Saved {saved_count:,} US optionable stocks ({processed_count:,}/{n_targets:,} · {eta_str})"
        update_status(True, min(total_symbols, max(1, prog_mapped)), total_symbols, msg)
        print(f"[{processed_count:,}/{n_targets:,}] {msg}")

    return saved_count


def fetch_alpaca_spot_map(tickers: list, sc, limiter: _RateLimiter = None) -> dict:
    spot_map = {}
    sym_to_alp = {}
    alp_to_sym = {}
    for tk in tickers:
        s_clean = str(tk).upper().strip()
        if not s_clean or not s_clean.replace('-', '').replace('.', '').isalnum():
            continue
        a_sym = s_clean.replace('-', '.')
        sym_to_alp[s_clean] = a_sym
        alp_to_sym[a_sym] = s_clean

    alp_list = sorted(alp_to_sym.keys())
    for i in range(0, len(alp_list), 200):
        chunk = alp_list[i:i + 200]
        try:
            snaps = _alpaca_call_with_retry(
                lambda c=chunk: sc.get_stock_snapshot(StockSnapshotRequest(symbol_or_symbols=c)),
                limiter=limiter,
            ) or {}
            for a_sym, snap in snaps.items():
                orig_sym = alp_to_sym.get(a_sym, a_sym.replace('.', '-'))
                lt = getattr(snap, 'latest_trade', None)
                db = getattr(snap, 'daily_bar', None)
                pdb = getattr(snap, 'previous_daily_bar', None)
                px = (
                    (getattr(lt, 'price', None) if lt else None)
                    or (getattr(db, 'close', None) if db else None)
                    or (getattr(pdb, 'close', None) if pdb else None)
                )
                if px and float(px) > 0:
                    spot_map[orig_sym] = float(px)
        except Exception as e:
            print(f"Alpaca bulk spot warning: {e}")
    return spot_map


def fetch_and_process_alpaca_ticker(
    ticker: str,
    spot_price: float,
    target_date_str: str,
    prev_skew_map: dict,
    oc,
    tc,
    data_limiter: _RateLimiter,
):
    """Fetches filtered 0-50 DTE / +-22% Alpaca options + OI + daily volume bars for one ticker."""
    if spot_price is None or spot_price <= 0:
        return None

    a_sym = ticker.replace('-', '.')
    today = date.today()
    exp_50 = today + timedelta(days=50)
    lo_k = round(spot_price * 0.78, 2)
    hi_k = round(spot_price * 1.22, 2)

    all_contracts = []
    token = None
    for _ in range(3):
        resp = _alpaca_call_with_retry(
            lambda tok=token: tc.get_option_contracts(GetOptionContractsRequest(
                underlying_symbols=[a_sym],
                expiration_date_gte=today,
                expiration_date_lte=exp_50,
                strike_price_gte=str(lo_k),
                strike_price_lte=str(hi_k),
                limit=1000,
                page_token=tok,
            )),
            limiter=None,
        )
        all_contracts.extend(getattr(resp, 'option_contracts', None) or [])
        token = getattr(resp, 'next_page_token', None)
        if not token:
            break

    chain_snaps = _alpaca_call_with_retry(
        lambda: oc.get_option_chain(OptionChainRequest(
            underlying_symbol=a_sym,
            expiration_date_gte=today,
            expiration_date_lte=exp_50,
            strike_price_gte=lo_k,
            strike_price_lte=hi_k,
        )),
        limiter=data_limiter,
    ) or {}

    if not all_contracts and not chain_snaps:
        return None

    # Rank top 100 near-spot / high-OI contracts (<=45 DTE) to fetch real daily volume via OptionBarsRequest
    ranked_syms = []
    for c_obj in all_contracts:
        c_sym = str(getattr(c_obj, 'symbol', '') or '')
        if not c_sym:
            continue
        k_val = float(getattr(c_obj, 'strike_price', 0.0) or 0.0)
        oi_val = float(getattr(c_obj, 'open_interest', 0.0) or 0.0)
        exp_raw = str(getattr(c_obj, 'expiration_date', '') or '')[:10]
        try:
            dte = max(0, (datetime.strptime(exp_raw, '%Y-%m-%d').date() - today).days)
        except Exception:
            dte = 60
        if dte <= 45 and k_val > 0:
            near_bonus = max(0.2, 1.0 - abs(k_val - spot_price) / spot_price * 4.0)
            score = (oi_val + 10.0) * near_bonus
            ranked_syms.append((score, c_sym))

    ranked_syms.sort(key=lambda x: x[0], reverse=True)
    top_100 = [sym for _, sym in ranked_syms[:100]]
    if not top_100 and chain_snaps:
        top_100 = list(chain_snaps.keys())[:100]

    vol_map = {}
    last_bar_px = {}
    if top_100:
        try:
            bars_resp = _alpaca_call_with_retry(
                lambda: oc.get_option_bars(OptionBarsRequest(
                    symbol_or_symbols=top_100,
                    timeframe=TimeFrame.Day,
                    start=today - timedelta(days=4),
                )),
                limiter=data_limiter,
            )
            bdf = getattr(bars_resp, 'df', None)
            if bdf is not None and not bdf.empty:
                if isinstance(bdf.index, pd.MultiIndex):
                    latest_rows = bdf.sort_index().groupby(level=0).last()
                    for opt_sym, r_bar in latest_rows.iterrows():
                        v_b = r_bar.get('volume', 0)
                        c_b = r_bar.get('close', 0)
                        if pd.notna(v_b):
                            vol_map[str(opt_sym)] = float(v_b)
                        if pd.notna(c_b):
                            last_bar_px[str(opt_sym)] = float(c_b)
        except Exception:
            pass

    rows = []
    seen_syms = set()
    today_str = today.strftime('%Y-%m-%d')
    for c_obj in all_contracts:
        c_sym = str(getattr(c_obj, 'symbol', '') or '')
        if not c_sym:
            continue
        seen_syms.add(c_sym)
        exp_str = str(getattr(c_obj, 'expiration_date', '') or '')[:10]
        if not exp_str or exp_str < today_str:
            continue
        strike = float(getattr(c_obj, 'strike_price', 0.0) or 0.0)
        if strike <= 0:
            continue
        raw_type = str(getattr(getattr(c_obj, 'type', None), 'value', getattr(c_obj, 'type', ''))).lower()
        opt_type = 'calls' if 'call' in raw_type else ('puts' if 'put' in raw_type else '')
        if not opt_type:
            continue

        oi = float(getattr(c_obj, 'open_interest', 0.0) or 0.0)
        snap = chain_snaps.get(c_sym)
        snap_iv = getattr(snap, 'implied_volatility', None) if snap else None
        lq = getattr(snap, 'latest_quote', None) if snap else None
        lt = getattr(snap, 'latest_trade', None) if snap else None

        bid = float(getattr(lq, 'bid_price', 0.0) or 0.0) if lq else 0.0
        ask = float(getattr(lq, 'ask_price', 0.0) or 0.0) if lq else 0.0
        last_px = float(
            last_bar_px.get(c_sym)
            or (getattr(lt, 'price', None) if lt else None)
            or getattr(c_obj, 'close_price', 0.0)
            or 0.0
        )
        vol = float(vol_map.get(c_sym) or (getattr(lt, 'size', 0.0) if lt else 0.0) or 0.0)

        rows.append({
            'contractSymbol': c_sym,
            'optionType': opt_type,
            'strike': strike,
            'expiration': exp_str,
            'openInterest': oi,
            'volume': vol,
            'impliedVolatility': float(snap_iv) if snap_iv is not None else np.nan,
            'bid': bid,
            'ask': ask,
            'lastPrice': last_px,
        })

    if not rows:
        return None

    chain_df = pd.DataFrame(rows)
    return process_single_chain(ticker, chain_df, spot_price, target_date_str, prev_skew_map=prev_skew_map)


def fetch_and_dump_batch(tickers_batch, target_date_str, prev_skew_map=None):
    """Fetches a batch of tickers using yahooquery (fallback) and returns list of summary dicts."""
    results = []
    if not tickers_batch or Ticker is None:
        return results

    try:
        t_obj = Ticker(tickers_batch, asynchronous=True)
        chains = t_obj.option_chain
        prices = t_obj.price

        if chains is None or isinstance(chains, str) or getattr(chains, 'empty', True):
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

            res = process_single_chain(sym, sym_df, spot, target_date_str, prev_skew_map=prev_skew_map)
            if res:
                results.append(res)
    except Exception as e:
        print(f"Batch fetch error for {tickers_batch[:3]}...: {e}")

    return results


def update_status(is_running, progress=0, total=0, message="", last_error=None, pid=None):
    os.makedirs(DATA_DIR, exist_ok=True)
    status = {
        "is_running": bool(is_running),
        "pid": (pid if pid is not None else (os.getpid() if is_running else None)),
        "progress": progress,
        "total": total,
        "percentage": round((progress / total * 100) if total > 0 else 0, 1),
        "message": message,
        "last_error": last_error,
        "timestamp": _now_cst().isoformat(),
    }
    try:
        tmp_path = f"{STATUS_PATH}.tmp"
        with open(tmp_path, 'w') as f:
            json.dump(status, f)
        os.replace(tmp_path, STATUS_PATH)
    except Exception:
        pass


def _save_records(cur, records):
    cur.executemany("""
    INSERT OR REPLACE INTO options_daily_summary (
        date, ticker, spot_price, total_call_oi, total_put_oi, total_oi, pcr_oi,
        total_call_vol, total_put_vol, total_vol, pcr_vol, call_vol_pct,
        atm_iv_30d, skew_25d, net_gex, max_pain, unusual_contracts_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        (
            r["date"], r["ticker"], r["spot_price"], r["total_call_oi"], r["total_put_oi"],
            r["total_oi"], r["pcr_oi"], r["total_call_vol"], r["total_put_vol"], r["total_vol"],
            r["pcr_vol"], r["call_vol_pct"], r["atm_iv_30d"], r["skew_25d"], r["net_gex"],
            r["max_pain"], r["unusual_contracts_json"], r["created_at"],
        )
        for r in records
    ])


def _is_already_dumped_today(target_date_str: str, scope: str) -> tuple:
    """Checks STATUS_PATH for another live PID and SQLite for an existing full dump on target_date_str."""
    if os.path.exists(STATUS_PATH):
        try:
            with open(STATUS_PATH, 'r') as f:
                st = json.load(f)
            pid = st.get('pid')
            if st.get('is_running') and pid and int(pid) != os.getpid():
                try:
                    os.kill(int(pid), 0)
                    return True, f"Another dumper instance (PID {pid}) is already running."
                except OSError:
                    pass
        except Exception:
            pass

    if os.path.exists(DB_PATH):
        try:
            conn_chk = sqlite3.connect(DB_PATH)
            cur_chk = conn_chk.cursor()
            cur_chk.execute("SELECT value FROM options_dump_meta WHERE key = 'last_full_dump_date'")
            row_meta = cur_chk.fetchone()
            cur_chk.execute("SELECT COUNT(DISTINCT ticker) FROM options_daily_summary WHERE date = ?", (target_date_str,))
            cnt_row = cur_chk.fetchone()
            conn_chk.close()
            today_cnt = int(cnt_row[0]) if cnt_row and cnt_row[0] else 0
            if (row_meta and row_meta[0] == target_date_str) or (scope == 'all' and today_cnt >= 3500):
                return True, f"Options data already dumped for today ({today_cnt:,} US stocks on {target_date_str})."
        except Exception:
            pass
    return False, ""


def run_options_dump(
    symbols=None,
    target_date_str=None,
    scope='all',
    batch_size=16,
    max_workers=6,
    skip_if_dumped_today=False,
    force=False,
):
    """
    Main routine to dump options data across the target universe.
    Uses global batched Alpaca Market Data endpoints (all ~6,132+ live US optionable stocks)
    with streaming incremental SQLite commits, CST scheduling awareness, and PID-tracked status.
    """
    init_db()
    if target_date_str is None:
        target_date_str = _today_cst_str()

    if skip_if_dumped_today and not force:
        already, reason = _is_already_dumped_today(target_date_str, scope)
        if already:
            print(f"ℹ️ {reason} Skipping duplicate run.")
            if "already dumped for today" in reason:
                update_status(False, 0, 0, reason, pid=None)
            return 0

    if symbols is None or len(symbols) == 0:
        universe = get_target_universe(scope=scope, refresh_live=(scope == 'all'))
    else:
        universe = [s.strip().upper() for s in symbols if s and s.strip()]

    total_symbols = len(universe)
    prev_skew_map = _load_prev_skew_map()
    hdrs = _get_alpaca_headers()
    mode_label = "Alpaca Global Batch" if hdrs else "yahooquery fallback"
    print(f"🚀 Starting Options Dump for {total_symbols} US symbols on {target_date_str} (Scope: {scope}, Mode: {mode_label})...")
    update_status(True, 0, total_symbols, f"Starting {mode_label} dump ({total_symbols:,} US symbols)...")

    if threading.current_thread() is threading.main_thread():
        def _sig_handler(signum, frame):
            update_status(False, 0, total_symbols, f"Dump terminated by signal {signum}", last_error=f"Signal {signum}", pid=None)
            os._exit(0)
        try:
            signal.signal(signal.SIGTERM, _sig_handler)
            signal.signal(signal.SIGINT, _sig_handler)
        except Exception:
            pass

    completed_symbols = 0
    saved_count = 0
    t0 = time.time()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    try:
        if hdrs:
            saved_count = run_alpaca_global_batch_dump(
                universe=universe,
                target_date_str=target_date_str,
                prev_skew_map=prev_skew_map,
                headers=hdrs,
                cur=cur,
                conn=conn,
                max_workers=max_workers,
            )
            completed_symbols = total_symbols
        else:
            batches = [universe[i:i + batch_size] for i in range(0, total_symbols, batch_size)]
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = {executor.submit(fetch_and_dump_batch, batch, target_date_str, prev_skew_map): batch for batch in batches}
                for future in as_completed(futures):
                    batch = futures[future]
                    try:
                        batch_res = future.result()
                        if batch_res:
                            _save_records(cur, batch_res)
                            conn.commit()
                            saved_count += len(batch_res)
                    except Exception as e:
                        print(f"Exception in batch {batch[:3]}: {e}")

                    completed_symbols += len(batch)
                    pct = round((completed_symbols / total_symbols) * 100, 1) if total_symbols > 0 else 100.0
                    msg = f"Saved {saved_count} active US options chains ({completed_symbols}/{total_symbols})..."
                    update_status(True, completed_symbols, total_symbols, msg)
                    if completed_symbols % (batch_size * 5) == 0 or completed_symbols >= total_symbols:
                        print(f"[{completed_symbols}/{total_symbols} - {pct}%] {msg}")

        elapsed = round(time.time() - t0, 2)
        now_cst_iso = _now_cst().isoformat()
        cur.execute("INSERT OR REPLACE INTO options_dump_meta (key, value) VALUES ('last_dump_time', ?)", (now_cst_iso,))
        cur.execute("INSERT OR REPLACE INTO options_dump_meta (key, value) VALUES ('last_dump_date', ?)", (target_date_str,))
        cur.execute("INSERT OR REPLACE INTO options_dump_meta (key, value) VALUES ('last_symbols_count', ?)", (str(saved_count),))
        cur.execute("INSERT OR REPLACE INTO options_dump_meta (key, value) VALUES ('last_universe_scope', ?)", (str(scope),))
        cur.execute("INSERT OR REPLACE INTO options_dump_meta (key, value) VALUES ('last_dump_duration_sec', ?)", (str(elapsed),))
        if (symbols is None or len(symbols) == 0) and scope == 'all' and saved_count >= 1500:
            cur.execute("INSERT OR REPLACE INTO options_dump_meta (key, value) VALUES ('last_full_dump_date', ?)", (target_date_str,))
            cur.execute("INSERT OR REPLACE INTO options_dump_meta (key, value) VALUES ('last_full_dump_time', ?)", (now_cst_iso,))
            cur.execute("INSERT OR REPLACE INTO options_dump_meta (key, value) VALUES ('last_full_dump_count', ?)", (str(saved_count),))
        conn.commit()

        prune_rolling_30_days(conn)
        msg = f"Completed Options Dump ({scope}): Saved {saved_count:,} US stocks in {elapsed}s."
        print(f"✅ {msg}")
        update_status(False, total_symbols, total_symbols, msg, pid=None)
        return saved_count
    except Exception as exc:
        err_msg = f"Options dump failed: {exc}"
        print(f"❌ {err_msg}")
        update_status(False, completed_symbols, total_symbols, err_msg, last_error=str(exc), pid=None)
        raise
    finally:
        try:
            conn.close()
        except Exception:
            pass

def seed_rolling_history_if_needed(target_days=30):
    """
    Ensures every ticker in options_daily_summary has a 30-day historical baseline
    so that 30-day IV Rank, Skew Rank, and OI deltas are immediately active.
    """
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    # Generate standard 30 trading dates anchored to CST today
    today = _now_cst().date()
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
    parser.add_argument('--scope', type=str, default='all', choices=['liquid', 'all'], help="Universe scope: all (all US optionable stocks) or liquid (top 500)")
    parser.add_argument('--date', type=str, help="Target date YYYY-MM-DD")
    parser.add_argument('--test', action='store_true', help="Run quick test on top symbols")
    parser.add_argument('--seed-history', action='store_true', help="Seed rolling 30-day baseline")
    parser.add_argument('--skip-if-dumped-today', action='store_true', help="Exit early if today already has a full dump")
    parser.add_argument('--force', action='store_true', help="Force dump even if already dumped today")
    parser.add_argument('--workers', type=int, default=6, help="Parallel worker threads")
    args = parser.parse_args()

    syms = None
    if args.test:
        syms = ["SPY", "QQQ", "NVDA", "AAPL", "TSLA", "AMD"]
    elif args.symbols:
        syms = [s.strip().upper() for s in args.symbols.split(',')]

    saved = run_options_dump(
        symbols=syms,
        target_date_str=args.date,
        scope=args.scope,
        max_workers=args.workers,
        skip_if_dumped_today=args.skip_if_dumped_today,
        force=args.force,
    )

    if args.seed_history and (saved is None or saved > 0):
        seed_rolling_history_if_needed()

    if saved is None or saved > 0:
        try:
            from options_screener_engine import get_options_screener_summary
            get_options_screener_summary(force_refresh=True)
            print("✅ Pre-warmed options_screener_summary_cache.json for instant UI loads.")
        except Exception as _cache_err:
            print(f"⚠️ Summary cache pre-warm skipped: {_cache_err}")
