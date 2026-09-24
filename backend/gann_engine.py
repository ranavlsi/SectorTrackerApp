"""
Gann Quantitative Analysis Engine (W.D. Gann Geometric & Cycle Terminal) - Upgraded v3.0
========================================================================================
Implements institutional W.D. Gann price and time methodologies:
  1. Dual Anchor Detection & Dynamic Gann Box (Square of High and Low, Midpoints, X-Diagonals).
  2. The Second Square: Forward Box Projection Engine (Predictive expansion into next square).
  3. W.D. Gann Mechanical Swing Chart Engine (Minor, 2-Day Intermediate, and 3-Day Main Swings).
  4. Dual Gann Fan (Ascending from Low + Descending from High) with Intersection Cross Nodes.
  5. Square of 9 Numerical Spiral Matrix (81-cell concentric matrix with Cardinal & Fixed cross).
  6. Master Time Cycle Confluence Engine: combining Trading Bar Counts (Gann/Fibonacci numbers),
     Solar Calendar Cycles, and Weekly Square of 52 / Square of 144 cycles.
  7. Three Canonical Squaring Methods: Squaring the Range, Squaring the Low, Squaring the High.
  8. Octave 8ths Grid (0/8 to 8/8) with Confluence Detection.
  9. Gann Pyramiding Trade Playbook (3-tier capital allocation & trailing angle ratchet).
"""

import os
import math
import datetime
import numpy as np
import pandas as pd
import yfinance as yf

# Liquid core universe for screening
CORE_GANN_UNIVERSE = [
    "SPY", "QQQ", "NVDA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "TSLA",
    "AMD", "AVGO", "SMCI", "ARM", "PLTR", "COIN", "NFLX", "OXY", "XYL"
]

def fetch_ohlcv_from_lakehouse(ticker, lookback_days=320):
    """Attempts to load daily OHLCV from the local Lakehouse parquet database."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    lakehouse_path = os.path.join(base_dir, 'lakehouse', 'daily_bars.parquet')
    if not os.path.exists(lakehouse_path):
        return None
    try:
        df = pd.read_parquet(lakehouse_path)
        if 'ticker' in df.columns:
            df = df[df['ticker'].str.upper() == ticker.upper()].copy()
        elif 'Symbol' in df.columns:
            df = df[df['Symbol'].str.upper() == ticker.upper()].copy()
        else:
            return None
        if df.empty:
            return None
        date_col = 'date' if 'date' in df.columns else 'Date'
        df[date_col] = pd.to_datetime(df[date_col])
        df = df.sort_values(date_col).reset_index(drop=True)
        col_map = {c: c.capitalize() for c in df.columns}
        df = df.rename(columns=col_map)
        df['Date'] = pd.to_datetime(df['Date'])
        cutoff = datetime.datetime.now() - datetime.timedelta(days=lookback_days * 1.5)
        df = df[df['Date'] >= cutoff].reset_index(drop=True)
        if len(df) >= 30:
            return df[['Date', 'Open', 'High', 'Low', 'Close', 'Volume']].copy()
        return None
    except Exception:
        return None

def fetch_ohlcv_from_yfinance(ticker, lookback_days=320):
    """Fetches high-quality daily OHLCV directly via yfinance as fallback."""
    try:
        t = yf.Ticker(ticker.upper())
        df = t.history(period=f"{max(lookback_days, 180)}d", interval="1d")
        if df is None or len(df) < 25:
            return None
        df = df.reset_index()
        df['Date'] = pd.to_datetime(df['Date']).dt.tz_localize(None)
        df = df.sort_values('Date').reset_index(drop=True)
        return df[['Date', 'Open', 'High', 'Low', 'Close', 'Volume']].copy()
    except Exception:
        return None

def get_stock_data(ticker, lookback_days=350):
    """Loads OHLCV from lakehouse if present, otherwise fetches from Yahoo Finance."""
    df = fetch_ohlcv_from_lakehouse(ticker, lookback_days)
    if df is None or len(df) < 30:
        df = fetch_ohlcv_from_yfinance(ticker, lookback_days)
    if df is not None:
        df = df.dropna(subset=['Close', 'High', 'Low']).reset_index(drop=True)
    return df

def calculate_gann_indicators(df):
    """Enriches OHLCV with True Range, ATR, 20/50 SMAs, and Volume moving averages."""
    if df is None or len(df) < 14:
        return df
    
    highs = df['High'].values
    lows = df['Low'].values
    closes = df['Close'].values
    
    tr = np.zeros(len(df))
    tr[0] = highs[0] - lows[0]
    for i in range(1, len(df)):
        tr[i] = max(highs[i] - lows[i], abs(highs[i] - closes[i-1]), abs(lows[i] - closes[i-1]))
    df['TR'] = tr
    df['ATR20'] = df['TR'].rolling(20, min_periods=5).mean()
    df['SMA20'] = df['Close'].rolling(20, min_periods=5).mean()
    df['SMA50'] = df['Close'].rolling(50, min_periods=10).mean()
    df['SMA200'] = df['Close'].rolling(200, min_periods=20).mean()
    df['VolSMA20'] = df['Volume'].rolling(20, min_periods=5).mean()
    df['RVOL'] = round(df['Volume'] / (df['VolSMA20'] + 1e-6), 2)
    return df

# ==============================================================================
# 1. W.D. GANN MECHANICAL SWING CHART ENGINE (2-DAY & 3-DAY SWINGS)
# ==============================================================================
def compute_gann_mechanical_swings(df, min_bars=2):
    """
    Implements W.D. Gann's classical Mechanical Method for swing identification:
      - Ignores inside bars.
      - Expands on outside bars.
      - Reverses direction only on N consecutive qualifying bars breaking previous range.
      - Identifies confirmed Swing Tops (Resistance) and Swing Bottoms (Support).
    """
    n = len(df)
    if n < 10:
        return {'swings': [], 'current_trend': 'NEUTRAL', 'bars_in_swing': 0, 'swing_change_pct': 0.0}
        
    swings = []
    cur_dir = 1  # 1 = Up Swing, -1 = Down Swing
    swing_start_price = float(df.iloc[0]['Low'])
    cur_extreme_idx = 0
    cur_extreme_price = float(df.iloc[0]['High'])
    
    swings.append({
        'idx': 0,
        'date': df.iloc[0]['Date'].strftime('%Y-%m-%d'),
        'price': swing_start_price,
        'type': 'LOW'
    })
    
    for i in range(1, n):
        h = float(df.iloc[i]['High'])
        l = float(df.iloc[i]['Low'])
        
        if cur_dir == 1:
            if h > cur_extreme_price:
                cur_extreme_price = h
                cur_extreme_idx = i
            # 2-bar reversal confirmation down
            if i >= cur_extreme_idx + min_bars and l < float(df.iloc[i-1]['Low']) and float(df.iloc[i-1]['Low']) < float(df.iloc[i-2]['Low']):
                swings.append({
                    'idx': cur_extreme_idx,
                    'date': df.iloc[cur_extreme_idx]['Date'].strftime('%Y-%m-%d'),
                    'price': round(cur_extreme_price, 2),
                    'type': 'HIGH'
                })
                cur_dir = -1
                cur_extreme_price = l
                cur_extreme_idx = i
        else:
            if l < cur_extreme_price:
                cur_extreme_price = l
                cur_extreme_idx = i
            # 2-bar reversal confirmation up
            if i >= cur_extreme_idx + min_bars and h > float(df.iloc[i-1]['High']) and float(df.iloc[i-1]['High']) > float(df.iloc[i-2]['High']):
                swings.append({
                    'idx': cur_extreme_idx,
                    'date': df.iloc[cur_extreme_idx]['Date'].strftime('%Y-%m-%d'),
                    'price': round(cur_extreme_price, 2),
                    'type': 'LOW'
                })
                cur_dir = 1
                cur_extreme_price = h
                cur_extreme_idx = i
                
    # Active swing tip
    swings.append({
        'idx': cur_extreme_idx,
        'date': df.iloc[cur_extreme_idx]['Date'].strftime('%Y-%m-%d'),
        'price': round(cur_extreme_price, 2),
        'type': 'HIGH' if cur_dir == 1 else 'LOW',
        'is_active': True
    })
    
    last_confirmed = swings[-2] if len(swings) >= 2 else swings[0]
    current_close = float(df.iloc[-1]['Close'])
    bars_in_swing = (n - 1) - cur_extreme_idx
    swing_change_pct = round(((current_close - last_confirmed['price']) / last_confirmed['price']) * 100.0, 1)
    
    return {
        'swings': swings,
        'current_trend': 'UP' if cur_dir == 1 else 'DOWN',
        'bars_in_swing': bars_in_swing,
        'swing_change_pct': swing_change_pct,
        'last_pivot': last_confirmed,
        'summary': f"Gann Mechanical 2-Day Swing: {'UPTREND (Advancing toward swing top)' if cur_dir == 1 else 'DOWNTREND (Pullback testing swing bottom)'} ({bars_in_swing} bars in swing)."
    }

# ==============================================================================
# 2. DUAL ANCHORS, GANN BOX & THE SECOND SQUARE (FORWARD PROJECTION)
# ==============================================================================
def detect_dual_gann_anchors(df):
    """
    Identifies BOTH the Master Cycle Low and the Master Swing High over a 120-220 bar window.
    Constructs the canonical Gann Box (Square of High and Low) and calibrates scale factor S.
    """
    n = len(df)
    if n < 30:
        return None
    
    lookback = min(n, 220)
    window = df.iloc[-lookback:].copy()
    
    abs_low_idx = int(window['Low'].idxmin())
    abs_high_idx = int(window['High'].idxmax())
    
    abs_low = float(df.iloc[abs_low_idx]['Low'])
    abs_high = float(df.iloc[abs_high_idx]['High'])
    current_close = float(df.iloc[-1]['Close'])
    
    low_bar = df.iloc[abs_low_idx]
    high_bar = df.iloc[abs_high_idx]
    
    elapsed_bars_low = (n - 1) - abs_low_idx
    elapsed_days_low = (df.iloc[-1]['Date'] - low_bar['Date']).days
    
    elapsed_bars_high = (n - 1) - abs_high_idx
    elapsed_days_high = (df.iloc[-1]['Date'] - high_bar['Date']).days
    
    range_height = abs_high - abs_low
    range_pos = (current_close - abs_low) / max(0.01, range_height)
    
    is_primary_low = (range_pos >= 0.35) or (abs_low_idx > abs_high_idx)
    primary_idx = abs_low_idx if is_primary_low else abs_high_idx
    
    # Scale factor S calibration
    atr = float(df.iloc[-1].get('ATR20', 2.0))
    if np.isnan(atr) or atr <= 0:
        atr = max(1.0, current_close * 0.02)
        
    primary_elapsed = elapsed_bars_low if is_primary_low else elapsed_bars_high
    price_travel = abs(current_close - (abs_low if is_primary_low else abs_high))
    
    if primary_elapsed >= 10 and price_travel > 0:
        raw_slope = price_travel / max(1, primary_elapsed)
        candidates = [0.10, 0.20, 0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 2.00, 2.50, 3.00, 4.00, 5.00, 10.0, 20.0]
        scale_factor = min(candidates, key=lambda x: abs(x - raw_slope))
    else:
        scale_factor = max(0.25, round(atr * 0.5, 2))
        
    # Primary Gann Box (Square 1)
    box_start_idx = min(abs_low_idx, abs_high_idx)
    box_end_idx = max(abs_low_idx, abs_high_idx)
    box_bar_width = max(1, abs(abs_high_idx - abs_low_idx))
    box_mid_price = round((abs_high + abs_low) / 2.0, 2)
    box_mid_idx = round((abs_low_idx + abs_high_idx) / 2.0)
    
    gann_box = {
        'box_start_idx': box_start_idx,
        'box_end_idx': box_end_idx,
        'box_bar_width': box_bar_width,
        'low_price': round(abs_low, 2),
        'high_price': round(abs_high, 2),
        'range_height': round(range_height, 2),
        'mid_price': box_mid_price,
        'mid_idx': box_mid_idx,
        'p25_price': round(abs_low + 0.25 * range_height, 2),
        'p75_price': round(abs_low + 0.75 * range_height, 2),
        'is_inside_box': (current_close >= abs_low) and (current_close <= abs_high)
    }
    
    # The Second Square (Forward Box Projection)
    # When price breaks above high_price or reaches mature phase, projects next box forward
    second_square = {
        'is_active': current_close >= (abs_low + 0.75 * range_height),
        'start_idx': box_end_idx,
        'end_idx': box_end_idx + box_bar_width,
        'low_price': round(abs_high, 2),
        'high_price': round(abs_high + range_height, 2),
        'mid_price': round(abs_high + 0.50 * range_height, 2),
        'target_25': round(abs_high + 0.25 * range_height, 2),
        'target_50': round(abs_high + 0.50 * range_height, 2),
        'target_100': round(abs_high + range_height, 2),
        'desc': f"Entering Gann Second Square! Projecting macro expansion targets to ${abs_high + 0.50 * range_height:.2f} (50% Mid) and ${abs_high + range_height:.2f} (100% Orbit)."
    }
    
    return {
        'primary_anchor': {
            'anchor_idx': primary_idx,
            'anchor_date': df.iloc[primary_idx]['Date'].strftime('%Y-%m-%d'),
            'anchor_price': round(abs_low if is_primary_low else abs_high, 2),
            'anchor_type': "MAJOR_LOW" if is_primary_low else "MAJOR_HIGH",
            'is_bullish': is_primary_low,
            'elapsed_bars': primary_elapsed,
            'elapsed_days': elapsed_days_low if is_primary_low else elapsed_days_high,
            'scale_factor': scale_factor,
            'range_height': round(range_height, 2),
            'abs_low': round(abs_low, 2),
            'abs_high': round(abs_high, 2)
        },
        'anchor_low': {
            'idx': abs_low_idx,
            'date': low_bar['Date'].strftime('%Y-%m-%d'),
            'price': round(abs_low, 2),
            'elapsed_bars': elapsed_bars_low,
            'elapsed_days': elapsed_days_low
        },
        'anchor_high': {
            'idx': abs_high_idx,
            'date': high_bar['Date'].strftime('%Y-%m-%d'),
            'price': round(abs_high, 2),
            'elapsed_bars': elapsed_bars_high,
            'elapsed_days': elapsed_days_high
        },
        'gann_box': gann_box,
        'second_square': second_square,
        'scale_factor': scale_factor,
        'range_pos_pct': round(range_pos * 100.0, 1)
    }

# ==============================================================================
# 3. DUAL GANN FAN GEOMETRIC ANGLES & INTERSECTIONS
# ==============================================================================
GANN_ANGLE_SPECS = [
    {'name': '8x1', 'p_mult': 8.0, 't_mult': 1.0, 'deg': 82.5, 'color': '#f43f5e', 'desc': 'Parabolic Thrust'},
    {'name': '4x1', 'p_mult': 4.0, 't_mult': 1.0, 'deg': 75.0, 'color': '#fb7185', 'desc': 'Strong Momentum'},
    {'name': '3x1', 'p_mult': 3.0, 't_mult': 1.0, 'deg': 71.25, 'color': '#f59e0b', 'desc': 'Accelerated Trend'},
    {'name': '2x1', 'p_mult': 2.0, 't_mult': 1.0, 'deg': 63.75, 'color': '#fbbf24', 'desc': 'Strong Trend'},
    {'name': '1x1', 'p_mult': 1.0, 't_mult': 1.0, 'deg': 45.0, 'color': '#10b981', 'desc': 'Master 45° Balance'},
    {'name': '1x2', 'p_mult': 1.0, 't_mult': 2.0, 'deg': 26.25, 'color': '#38bdf8', 'desc': 'Supportive Glide'},
    {'name': '1x3', 'p_mult': 1.0, 't_mult': 3.0, 'deg': 18.75, 'color': '#818cf8', 'desc': 'Moderate Defense'},
    {'name': '1x4', 'p_mult': 1.0, 't_mult': 4.0, 'deg': 15.0, 'color': '#c084fc', 'desc': 'Major Base Support'},
    {'name': '1x8', 'p_mult': 1.0, 't_mult': 8.0, 'deg': 7.5, 'color': '#94a3b8', 'desc': 'Deep Floor Support'}
]

def compute_dual_gann_fan_angles(anchors, current_close, days_ahead=40):
    """
    Computes BOTH Upward Fan (from anchor_low) and Downward Fan (from anchor_high),
    plus calculates geometric intersection points between opposing angles.
    """
    scale = anchors['scale_factor']
    low_info = anchors['anchor_low']
    high_info = anchors['anchor_high']
    
    p_low = low_info['price']
    t_low_bars = max(1, low_info['elapsed_bars'])
    
    p_high = high_info['price']
    t_high_bars = max(1, high_info['elapsed_bars'])
    
    up_angles = []
    active_up_angle = '1x1'
    nearest_up_dist = float('inf')
    above_1x1_up = False
    
    for spec in GANN_ANGLE_SPECS:
        slope = (spec['p_mult'] / spec['t_mult']) * scale
        curr_price = round(p_low + slope * t_low_bars, 2)
        proj_price = round(p_low + slope * (t_low_bars + days_ahead), 2)
        diff = current_close - curr_price
        dist_pct = round((diff / (curr_price + 1e-6)) * 100.0, 2)
        
        if spec['name'] == '1x1':
            above_1x1_up = (current_close >= curr_price)
            
        if abs(dist_pct) < abs(nearest_up_dist):
            nearest_up_dist = dist_pct
            active_up_angle = spec['name']
            
        up_angles.append({
            'name': spec['name'],
            'price': curr_price,
            'projected_ahead': proj_price,
            'slope_daily': round(slope, 3),
            'degrees': spec['deg'],
            'color': spec['color'],
            'dist_pct': dist_pct,
            'status': 'SUPPORT' if current_close >= curr_price else 'RESISTANCE',
            'desc': spec['desc']
        })
        
    down_angles = []
    for spec in GANN_ANGLE_SPECS:
        slope = (spec['p_mult'] / spec['t_mult']) * scale
        curr_price = round(max(1.0, p_high - slope * t_high_bars), 2)
        proj_price = round(max(1.0, p_high - slope * (t_high_bars + days_ahead)), 2)
        diff = current_close - curr_price
        dist_pct = round((diff / (curr_price + 1e-6)) * 100.0, 2)
        
        down_angles.append({
            'name': spec['name'],
            'price': curr_price,
            'projected_ahead': proj_price,
            'slope_daily': round(-slope, 3),
            'degrees': spec['deg'],
            'color': spec['color'],
            'dist_pct': dist_pct,
            'status': 'SUPPORT' if current_close >= curr_price else 'RESISTANCE',
            'desc': f"Descending {spec['name']}"
        })
        
    slope_1x1 = scale
    intersection_nodes = []
    if high_info['idx'] != low_info['idx']:
        delta_bars = high_info['idx'] - low_info['idx']
        t_cross = (p_high - p_low + slope_1x1 * delta_bars) / (2.0 * slope_1x1 + 1e-6)
        p_cross = p_low + slope_1x1 * t_cross
        intersection_nodes.append({
            'name': '1x1 Master Intersection',
            'price': round(p_cross, 2),
            'bar_offset_from_low': round(t_cross, 1),
            'desc': 'Magnetic crossing node of ascending and descending 1x1 rays'
        })
        
    primary_is_low = anchors['primary_anchor']['is_bullish']
    chosen_angles = up_angles if primary_is_low else down_angles
    chosen_active = active_up_angle if primary_is_low else '1x1'
    chosen_above = above_1x1_up if primary_is_low else False
    
    return {
        'up_angles': up_angles,
        'down_angles': down_angles,
        'angles': chosen_angles,
        'active_angle': chosen_active,
        'above_1x1': chosen_above,
        'scale_factor': scale,
        'intersections': intersection_nodes,
        'summary': f"Trading above Master 1x1 Angle ({nearest_up_dist:+.1f}% from {active_up_angle}). Geometric markup dominance." if chosen_above else f"Trading below Master 1x1 Angle ({nearest_up_dist:+.1f}% from {active_up_angle}). Corrective/defensive geometry."
    }

# ==============================================================================
# 4. SQUARE OF 9 NUMERICAL MATRIX (81-CELL SPIRAL TABLE GENERATOR)
# ==============================================================================
def generate_square_of_9_matrix(current_price, anchor_price, size=9):
    """
    Generates the authentic W.D. Gann Square of 9 Spiral Matrix (81 concentric cells).
    Maps Cardinal Cross (N, S, E, W axes) and Fixed Cross (NE, SE, SW, NW diagonals).
    Identifies the exact coordinate cell (row, col) corresponding to current market price.
    """
    center = size // 2
    int_grid = np.zeros((size, size), dtype=int)
    int_grid[center, center] = 1
    
    moves = [(0, 1), (-1, 0), (0, -1), (1, 0)]  # right, up, left, down
    val = 2
    steps = 1
    m_idx = 0
    r, c = center, center
    
    while val <= size * size:
        for _ in range(2):
            dr, dc = moves[m_idx % 4]
            for _ in range(steps):
                if val > size * size:
                    break
                r += dr
                c += dc
                if 0 <= r < size and 0 <= c < size:
                    int_grid[r, c] = val
                    val += 1
            m_idx += 1
        steps += 1
        
    root_base = math.sqrt(max(1.0, anchor_price))
    cells = []
    closest_dist = float('inf')
    active_cell = (center, center)
    
    for row in range(size):
        for col in range(size):
            num = int(int_grid[row, col])
            dy = center - row
            dx = col - center
            rad = math.atan2(dx, dy)
            deg = math.degrees(rad)
            if deg < 0:
                deg += 360.0
                
            ring = max(abs(row - center), abs(col - center))
            is_cardinal = (row == center) or (col == center)
            is_fixed = (abs(row - center) == abs(col - center)) and (ring > 0)
            
            # Scaled price representation
            cell_price = round((root_base + (num - 1) * 0.15) ** 2, 2)
            dist = abs(cell_price - current_price)
            if dist < closest_dist:
                closest_dist = dist
                active_cell = (row, col)
                
            cells.append({
                'row': row,
                'col': col,
                'num': num,
                'ring': ring,
                'degrees': round(deg, 1),
                'is_cardinal': is_cardinal,
                'is_fixed': is_fixed,
                'axis_name': "0° (N)" if row < center and col == center else
                             "90° (E)" if row == center and col > center else
                             "180° (S)" if row > center and col == center else
                             "270° (W)" if row == center and col < center else
                             "45° (NE)" if row < center and col > center and is_fixed else
                             "135° (SE)" if row > center and col > center and is_fixed else
                             "225° (SW)" if row > center and col < center and is_fixed else
                             "315° (NW)" if row < center and col < center and is_fixed else "",
                'price': cell_price
            })
            
    return {
        'size': size,
        'active_cell': {'row': active_cell[0], 'col': active_cell[1]},
        'cells': cells
    }

# ==============================================================================
# 5. SQUARE OF 9 HARMONIC MATRIX & ASPECT ENGINE
# ==============================================================================
SQ9_ASPECT_SPECS = [
    (0, '0° Conjunction', 'ORIGIN_HARMONIC', 0.00, '#fbbf24'),
    (45, '45° Semi-Square', 'FIXED_CROSS', 0.25, '#38bdf8'),
    (60, '60° Sextile', 'HEXAGON_TRINE', 0.333, '#a855f7'),
    (90, '90° Square', 'CARDINAL_CROSS', 0.50, '#10b981'),
    (120, '120° Trine', 'HEXAGON_TRINE', 0.667, '#ec4899'),
    (135, '135° Sesquisquare', 'FIXED_CROSS', 0.75, '#38bdf8'),
    (180, '180° Opposition', 'POLARITY_REVERSAL', 1.00, '#f43f5e'),
    (225, '225° Tri-Octave', 'FIXED_CROSS', 1.25, '#38bdf8'),
    (240, '240° Trine', 'HEXAGON_TRINE', 1.333, '#ec4899'),
    (270, '270° Square', 'CARDINAL_CROSS', 1.50, '#10b981'),
    (315, '315° Septile', 'FIXED_CROSS', 1.75, '#38bdf8'),
    (360, '360° Full Cycle', 'COMPLETE_ORBIT', 2.00, '#fbbf24')
]

def compute_square_of_9(p0, current_price, octaves=None):
    """
    Computes Square of 9 root spiral price vibration levels from current price and anchor.
    Classifies aspect geometry and detects confluence nodes.
    """
    root_curr = math.sqrt(max(0.1, current_price))
    root_p0 = math.sqrt(max(0.1, p0))
    
    ring_level = max(1, math.ceil((root_curr - 1.0) / 2.0))
    deg_traveled = (root_curr - root_p0) * 180.0
    orbit_position = round(deg_traveled % 360.0, 1)
    if orbit_position < 0:
        orbit_position += 360.0
        
    upside_targets = []
    downside_supports = []
    oct_prices = [e['price'] for e in (octaves or [])]
    
    for deg, name, aspect_type, root_shift, col in SQ9_ASPECT_SPECS[1:]:
        target_p = round((root_curr + root_shift) ** 2, 2)
        gain_pct = round(((target_p - current_price) / current_price) * 100.0, 1)
        
        has_confluence = False
        confluence_label = ""
        for op in oct_prices:
            if abs(target_p - op) / max(1.0, op) <= 0.015:
                has_confluence = True
                confluence_label = f"Confluence with Octave ${op:.0f}"
                break
                
        upside_targets.append({
            'deg': deg,
            'name': name,
            'price': target_p,
            'gain_pct': gain_pct,
            'type': aspect_type,
            'color': col,
            'has_confluence': has_confluence,
            'confluence_label': confluence_label
        })
        
        sup_p = round(max(1.0, (root_curr - root_shift) ** 2), 2)
        drop_pct = round(abs((current_price - sup_p) / current_price) * 100.0, 1)
        
        has_sup_confluence = False
        sup_confluence_label = ""
        for op in oct_prices:
            if abs(sup_p - op) / max(1.0, op) <= 0.015:
                has_sup_confluence = True
                sup_confluence_label = f"Confluence with Octave ${op:.0f}"
                break
                
        downside_supports.append({
            'deg': deg,
            'name': name,
            'price': sup_p,
            'drop_pct': drop_pct,
            'type': aspect_type,
            'color': col,
            'has_confluence': has_sup_confluence,
            'confluence_label': sup_confluence_label
        })
        
    next_sq9_res = upside_targets[0]
    major_sq9_res = upside_targets[2]
    nearest_sq9_sup = downside_supports[0]
    
    is_cardinal = any(abs(orbit_position - c) <= 8.0 for c in [0, 90, 180, 270, 360])
    is_fixed = any(abs(orbit_position - f) <= 8.0 for f in [45, 135, 225, 315])
    is_trine = any(abs(orbit_position - t) <= 8.0 for t in [60, 120, 240, 300])
    
    aspect_label = "Cardinal Cross Alignment" if is_cardinal else "Fixed Cross Harmonic" if is_fixed else "Hexagon Trine Alignment" if is_trine else "Orbital Spiral"
    
    # Generate 81-cell matrix
    matrix_grid = generate_square_of_9_matrix(current_price, p0, size=9)
    
    channel_span = max(0.01, next_sq9_res['price'] - nearest_sq9_sup['price'])
    pos_in_channel = round(((current_price - nearest_sq9_sup['price']) / channel_span) * 100.0, 1)
    
    sr_ladder = {
        'current_price': current_price,
        'r1': {'name': 'R1 (45° Semi-Square)', 'deg': 45, 'price': upside_targets[0]['price'], 'gain_pct': upside_targets[0]['gain_pct'], 'has_confluence': upside_targets[0]['has_confluence']},
        'r2': {'name': 'R2 (90° Square)', 'deg': 90, 'price': upside_targets[2]['price'], 'gain_pct': upside_targets[2]['gain_pct'], 'has_confluence': upside_targets[2]['has_confluence']},
        'r3': {'name': 'R3 (135° Sesquisquare)', 'deg': 135, 'price': upside_targets[4]['price'] if len(upside_targets) > 4 else upside_targets[3]['price'], 'gain_pct': upside_targets[4]['gain_pct'] if len(upside_targets) > 4 else upside_targets[3]['gain_pct']},
        'r4': {'name': 'R4 (180° Major Opposition)', 'deg': 180, 'price': upside_targets[5]['price'] if len(upside_targets) > 5 else upside_targets[4]['price'], 'gain_pct': upside_targets[5]['gain_pct'] if len(upside_targets) > 5 else upside_targets[4]['gain_pct']},
        's1': {'name': 'S1 (45° Semi-Square)', 'deg': 45, 'price': downside_supports[0]['price'], 'drop_pct': abs(downside_supports[0]['drop_pct']), 'has_confluence': downside_supports[0]['has_confluence']},
        's2': {'name': 'S2 (90° Square)', 'deg': 90, 'price': downside_supports[2]['price'], 'drop_pct': abs(downside_supports[2]['drop_pct']), 'has_confluence': downside_supports[2]['has_confluence']},
        's3': {'name': 'S3 (135° Sesquisquare)', 'deg': 135, 'price': downside_supports[4]['price'] if len(downside_supports) > 4 else downside_supports[3]['price'], 'drop_pct': abs(downside_supports[4]['drop_pct']) if len(downside_supports) > 4 else abs(downside_supports[3]['drop_pct'])},
        's4': {'name': 'S4 (180° Major Opposition)', 'deg': 180, 'price': downside_supports[5]['price'] if len(downside_supports) > 5 else downside_supports[4]['price'], 'drop_pct': abs(downside_supports[5]['drop_pct']) if len(downside_supports) > 5 else abs(downside_supports[4]['drop_pct'])},
        'channel_spread_pct': round(((next_sq9_res['price'] - nearest_sq9_sup['price']) / current_price) * 100.0, 1),
        'channel_position_pct': pos_in_channel,
        'tactical_posture': (
            f"Testing Immediate Resistance R1 (${next_sq9_res['price']:.2f})" if pos_in_channel >= 80 else
            f"Testing Immediate Support S1 (${nearest_sq9_sup['price']:.2f})" if pos_in_channel <= 20 else
            f"In Equilibrium Channel: S1 (${nearest_sq9_sup['price']:.2f}) to R1 (${next_sq9_res['price']:.2f})"
        )
    }

    return {
        'anchor_price': round(p0, 2),
        'ring_level': ring_level,
        'current_degree': orbit_position,
        'degrees_traveled': round(deg_traveled, 1),
        'aspect_label': aspect_label,
        'next_target_price': next_sq9_res['price'],
        'next_target_gain': next_sq9_res['gain_pct'],
        'next_target_deg': next_sq9_res['deg'],
        'next_target_name': next_sq9_res['name'],
        'major_target_price': major_sq9_res['price'],
        'major_target_gain': major_sq9_res['gain_pct'],
        'nearest_support_price': nearest_sq9_sup['price'],
        'nearest_support_drop': nearest_sq9_sup['drop_pct'],
        'upside_targets': upside_targets,
        'downside_supports': downside_supports,
        'sr_ladder': sr_ladder,
        'cardinal_aligned': is_cardinal or is_fixed,
        'matrix_grid': matrix_grid
    }

# ==============================================================================
# 6. MASTER TIME CYCLE CONFLUENCE ENGINE (DAILY + WEEKLY SQUARE OF 52/144)
# ==============================================================================
GANN_CALENDAR_CYCLES = [
    {'days': 30, 'name': '30-Day Cycle', 'type': 'Solar Month', 'weight': 1},
    {'days': 45, 'name': '45-Day Cycle', 'type': '1/8 Solar Year', 'weight': 2},
    {'days': 60, 'name': '60-Day Cycle', 'type': 'Bi-Monthly', 'weight': 1},
    {'days': 90, 'name': '90-Day Cycle', 'type': '1/4 Solar Year (Equinox/Solstice)', 'weight': 3},
    {'days': 91, 'name': '13-Week Quarter', 'type': 'Square of 52 (Quarterly)', 'weight': 2},
    {'days': 120, 'name': '120-Day Cycle', 'type': 'Trine (1/3 Year)', 'weight': 2},
    {'days': 135, 'name': '135-Day Cycle', 'type': '3/8 Solar Year', 'weight': 2},
    {'days': 144, 'name': '144-Day Cycle', 'type': 'Gann Square of 12 (12x12)', 'weight': 3},
    {'days': 180, 'name': '180-Day Cycle', 'type': '1/2 Solar Year (Opposition)', 'weight': 4},
    {'days': 182, 'name': '26-Week Half', 'type': 'Square of 52 (Semi-Annual)', 'weight': 2},
    {'days': 216, 'name': '216-Day Cycle', 'type': '60% Great Year', 'weight': 2},
    {'days': 240, 'name': '240-Day Cycle', 'type': 'Trine (2/3 Year)', 'weight': 2},
    {'days': 270, 'name': '270-Day Cycle', 'type': '3/4 Solar Year', 'weight': 3},
    {'days': 273, 'name': '39-Week Three-Quarter', 'type': 'Square of 52 (3/4 Annual)', 'weight': 2},
    {'days': 360, 'name': '360/365-Day Cycle', 'type': 'Master Annual Solar Orbit', 'weight': 4},
    {'days': 364, 'name': '52-Week Cycle', 'type': 'Master Square of 52 Weeks', 'weight': 4},
    {'days': 504, 'name': '72-Week Cycle', 'type': '1/2 Square of 144 Weeks', 'weight': 3}
]

GANN_TRADING_BAR_COUNTS = [21, 34, 45, 55, 89, 90, 120, 144, 180, 233, 252]

def compute_gann_time_confluence(anchors, current_date):
    """
    Synthesizes Calendar Solar Cycles, Square of 52/144 Weekly Cycles, and Trading Bar Counts.
    Clusters milestones within a +/- 3 day window into high-conviction Time Confluence Clusters.
    """
    primary = anchors['primary_anchor']
    anchor_dt = datetime.datetime.strptime(primary['anchor_date'], '%Y-%m-%d')
    elapsed_cal_days = (current_date - anchor_dt).days
    
    all_events = []
    
    for cycle in GANN_CALENDAR_CYCLES:
        target_dt = anchor_dt + datetime.timedelta(days=cycle['days'])
        delta = (target_dt - current_date).days
        all_events.append({
            'source': 'SOLAR_CALENDAR',
            'name': cycle['name'],
            'type': cycle['type'],
            'weight': cycle['weight'],
            'target_dt': target_dt,
            'target_date_str': target_dt.strftime('%b %d, %Y'),
            'target_day': target_dt.strftime('%A'),
            'delta_days': delta,
            'is_past': delta < 0
        })
        
    for bars in GANN_TRADING_BAR_COUNTS:
        approx_cal_days = int(round(bars * 1.45))
        target_dt = anchor_dt + datetime.timedelta(days=approx_cal_days)
        delta = (target_dt - current_date).days
        all_events.append({
            'source': 'TRADING_BARS',
            'name': f"{bars} Trading Bars",
            'type': 'Gann/Fibonacci Bar Count',
            'weight': 2 if bars in [45, 90, 144, 180] else 1,
            'target_dt': target_dt,
            'target_date_str': target_dt.strftime('%b %d, %Y'),
            'target_day': target_dt.strftime('%A'),
            'delta_days': delta,
            'is_past': delta < 0
        })
        
    future_events = [e for e in all_events if e['delta_days'] >= -1]
    future_events.sort(key=lambda x: x['target_dt'])
    
    clusters = []
    used_indices = set()
    
    for i, ev in enumerate(future_events):
        if i in used_indices:
            continue
        cluster_items = [ev]
        used_indices.add(i)
        
        for j in range(i + 1, len(future_events)):
            if j in used_indices:
                continue
            delta_diff = abs((future_events[j]['target_dt'] - ev['target_dt']).days)
            if delta_diff <= 4:
                cluster_items.append(future_events[j])
                used_indices.add(j)
                
        total_weight = sum(item['weight'] for item in cluster_items)
        cluster_score = min(100, total_weight * 20)
        median_dt = cluster_items[len(cluster_items) // 2]['target_dt']
        median_delta = (median_dt - current_date).days
        
        clusters.append({
            'target_date': median_dt.strftime('%b %d, %Y'),
            'target_day': median_dt.strftime('%A'),
            'delta_days': median_delta,
            'confluence_score': cluster_score,
            'cycle_count': len(cluster_items),
            'converging_cycles': [f"{it['name']} ({it['type']})" for it in cluster_items],
            'description': f"{len(cluster_items)} Sacred Harmonic Cycles Converging. High-velocity inflection window."
        })
        
    clusters.sort(key=lambda x: x['delta_days'])
    next_cluster = clusters[0] if clusters else None
    
    active_window = None
    for c in clusters:
        if abs(c['delta_days']) <= 3:
            active_window = c
            break
            
    milestones = []
    for cycle in GANN_CALENDAR_CYCLES:
        target_dt = anchor_dt + datetime.timedelta(days=cycle['days'])
        delta = (target_dt - current_date).days
        milestones.append({
            'cycle_days': cycle['days'],
            'name': cycle['name'],
            'type': cycle['type'],
            'target_date': target_dt.strftime('%b %d, %Y'),
            'target_day': target_dt.strftime('%A'),
            'full_date': target_dt.strftime('%A, %b %d, %Y'),
            'delta_days': delta,
            'is_past': delta < 0
        })
        
    return {
        'anchor_date': primary['anchor_date'],
        'elapsed_days': elapsed_cal_days,
        'active_window': active_window,
        'next_turn': milestones[0] if milestones else None,
        'next_cluster': next_cluster,
        'confluence_clusters': clusters[:4],
        'milestones': milestones
    }

# ==============================================================================
# 7. THREE SQUARING METHODS & 8THS OCTAVE GRID
# ==============================================================================
def compute_three_squaring_methods_and_octaves(anchors, current_price):
    """
    Evaluates:
      1. Squaring the Range: T_bars approx (High - Low) / Scale
      2. Squaring the Low: T_bars approx Low / ScaleUnit
      3. Squaring the High: T_bars approx High / ScaleUnit
    Plus constructs the full 0/8 to 8/8 Octave grid with 4/8 50% equilibrium.
    """
    gbox = anchors['gann_box']
    abs_low = gbox['low_price']
    abs_high = gbox['high_price']
    rng = gbox['range_height']
    scale = anchors['scale_factor']
    primary = anchors['primary_anchor']
    elapsed_bars = primary['elapsed_bars']
    
    eighths = []
    labels = [
        ('0/8', 0.0, 'Major Cycle Floor (Extreme Support)', '#f43f5e'),
        ('1/8', 0.125, 'Weak Support / Bounce Pivot', '#fb7185'),
        ('2/8', 0.250, 'Quarter Range (Lower Collar)', '#f59e0b'),
        ('3/8', 0.375, 'Sub-Equilibrium Level', '#fbbf24'),
        ('4/8', 0.500, 'Master 50% Balance / Equilibrium', '#10b981'),
        ('5/8', 0.625, 'Upper Midpoint Expansion', '#38bdf8'),
        ('6/8', 0.750, 'Three-Quarter Range (Upper Collar)', '#818cf8'),
        ('7/8', 0.875, 'Overbought Resistance', '#c084fc'),
        ('8/8', 1.000, 'Major Cycle Ceiling (Breakout Pivot)', '#10b981')
    ]
    
    for lbl, frac, role, col in labels:
        p = round(abs_low + frac * rng, 2)
        eighths.append({
            'label': lbl,
            'fraction': frac,
            'price': p,
            'role': role,
            'color': col,
            'is_active': abs(current_price - p) / max(1.0, p) < 0.018
        })
        
    p_fifty = round(abs_low + 0.50 * rng, 2)
    above_50 = current_price >= p_fifty
    
    expected_bars_range = rng / max(0.1, scale)
    ratio_range = round(elapsed_bars / (expected_bars_range + 1e-6), 2)
    is_squared_range = abs(ratio_range - 1.0) <= 0.12 or abs(ratio_range - 2.0) <= 0.12
    
    scale_unit = 10.0 if abs_low >= 100 else 1.0
    expected_bars_low = abs_low / scale_unit
    ratio_low = round(elapsed_bars / (expected_bars_low + 1e-6), 2)
    is_squared_low = abs(ratio_low - 1.0) <= 0.12
    
    is_squared = is_squared_range or is_squared_low
    if is_squared_range:
        status_text = f"Price & Time SQUARED (Range Harmony {ratio_range:.2f}x)! Cycle culmination or explosive thrust imminent."
    elif is_squared_low:
        status_text = f"Time has SQUARED the Cycle Low ({ratio_low:.2f}x)! Structural polar inflection active."
    else:
        status_text = f"Time/Price Squaring Ratio at {ratio_range:.2f}x. Approaching next squaring harmonic."
        
    return {
        'eighths': eighths,
        'fifty_pct_price': p_fifty,
        'above_fifty': above_50,
        'square_ratio': ratio_range,
        'is_squared': is_squared,
        'squaring_range': {'ratio': ratio_range, 'is_squared': is_squared_range},
        'squaring_low': {'ratio': ratio_low, 'is_squared': is_squared_low},
        'squaring_status': status_text
    }

# ==============================================================================
# 8. ENHANCED PLAYBOOK WITH GANN PYRAMIDING MATRIX
# ==============================================================================
def add_trading_days(start_date, num_days):
    """Adds or subtracts trading days (skipping weekends)."""
    if hasattr(start_date, 'to_pydatetime'):
        start_date = start_date.to_pydatetime()
    cur = start_date
    step = 1 if num_days >= 0 else -1
    added = 0
    while added < abs(num_days):
        cur += datetime.timedelta(days=step)
        if cur.weekday() < 5:
            added += 1
    return cur

def classify_enhanced_gann_setup(anchors, fan_info, sq9_info, cycle_info, octave_info, swing_info, current_close, atr, current_date=None):
    """
    Classifies the setup and builds a 3-tier Gann Pyramiding position sizing strategy
    with Price-Time harmonic milestone projections (Target Dates, Days of Week, and Windows).
    """
    if current_date is None:
        current_date = datetime.datetime.now()
    elif hasattr(current_date, 'to_pydatetime'):
        current_date = current_date.to_pydatetime()
    elif isinstance(current_date, str):
        try:
            current_date = datetime.datetime.strptime(current_date[:10], '%Y-%m-%d')
        except Exception:
            current_date = datetime.datetime.now()

    above_1x1 = fan_info['above_1x1']
    active_angle = fan_info['active_angle']
    next_sq9 = sq9_info['next_target_price']
    major_sq9 = sq9_info['major_target_price']
    gain_sq9 = sq9_info['next_target_gain']
    fifty_p = octave_info['fifty_pct_price']
    is_squared = octave_info['is_squared']
    active_window = cycle_info['active_window']
    sec_sq = anchors['second_square']
    swing_trend = swing_info['current_trend']
    
    setup_key = 'sq9_vibration_target'
    setup_name = 'Square of 9 Vibration Target'
    direction = 'BULLISH' if swing_trend == 'UP' else 'BEARISH'
    conviction = 82
    
    if sec_sq['is_active']:
        setup_key = 'second_square_breakout'
        setup_name = 'Gann Second Square Breakout'
        conviction = 96
        direction = 'BULLISH'
        desc = f"Entering the Gann Second Square! Price has absorbed the base high (${anchors['anchor_high']['price']}). Macro targets project toward ${sec_sq['mid_price']} (50% Mid) and ${sec_sq['high_price']} (Full Square expansion)."
    elif is_squared:
        setup_key = 'price_time_squared'
        setup_name = 'Price & Time Squared (T = P)'
        conviction = 94
        direction = 'BULLISH' if above_1x1 else 'BEARISH'
        desc = f"Master Gann Squaring event! Elapsed time has squared price ({octave_info['square_ratio']:.2f}x harmony). Expect explosive momentum thrust toward ${next_sq9:.2f}."
    elif active_window:
        setup_key = 'time_cycle_turn'
        setup_name = f"Time Confluence: {active_window['target_date']}"
        conviction = 90
        direction = 'BULLISH' if above_1x1 else 'NEUTRAL_BULLISH'
        desc = f"Stock is inside an active Master Time Confluence Window ({active_window['target_date']}) with {active_window.get('cycle_count', 2)} harmonics converging."
    elif above_1x1 and active_angle in ['1x1', '2x1', '1x2']:
        setup_key = '1x1_angle_bounce'
        setup_name = 'Master 1x1 Geometric Defense'
        conviction = 88
        direction = 'BULLISH'
        desc = f"Holding firmly above the Master 1x1 (45°) angle. Dynamic geometric support confirms ongoing institutional markup."
    elif abs(current_close - fifty_p) / fifty_p <= 0.025 and octave_info['above_fifty']:
        setup_key = 'gann_50_pct_retest'
        setup_name = 'Gann 4/8 Equilibrium Retest'
        conviction = 85
        direction = 'BULLISH'
        desc = f"Defending the legendary 4/8 (50%) equilibrium price (${fifty_p:.2f}). Holding the upper octave preserves markup posture."
    else:
        desc = f"Navigating Square of 9 harmonics. Currently at {active_angle} angle targeting ${next_sq9:.2f} (+{gain_sq9}%)."
        
    entry = round(current_close, 2)
    stop_loss = round(max(current_close * 0.93, min(fifty_p * 0.985, current_close - 2.0 * atr)), 2)
    risk = max(0.01, entry - stop_loss)
    
    macro_target = round(sq9_info['upside_targets'][7]['price'] if len(sq9_info['upside_targets']) > 7 else next_sq9 * 1.20, 2)
    rr_ratio = round((next_sq9 - entry) / risk, 2) if risk > 0 else 2.5
    
    # -------------------------------------------------------------------------
    # W.D. GANN TIME PROJECTIONS & HARMONIC ROADMAP
    # -------------------------------------------------------------------------
    scale = anchors.get('scale_factor', 1.0)
    if scale <= 0:
        scale = 1.0
        
    dist_1 = max(0.01, abs(next_sq9 - entry))
    dist_2 = max(0.01, abs(major_sq9 - entry))
    dist_m = max(0.01, abs(macro_target - entry))
    
    # Calculate harmonic bar durations using Gann 1x1 slope
    raw_bars_1 = dist_1 / scale
    if fan_info.get('above_1x1', False) and active_angle in ['2x1', '3x1', '4x1']:
        bars_1 = max(3, int(round(raw_bars_1 * 0.65)))
    elif not fan_info.get('above_1x1', True):
        bars_1 = max(5, int(round(raw_bars_1 * 1.35)))
    else:
        bars_1 = max(4, int(round(raw_bars_1)))
        
    raw_bars_2 = dist_2 / scale
    bars_2 = max(bars_1 + 4, int(round(raw_bars_2 * 0.85 if fan_info.get('above_1x1', False) else raw_bars_2 * 1.2)))
    
    raw_bars_m = dist_m / scale
    bars_m = max(bars_2 + 12, int(round(raw_bars_m)))
    
    td_1 = add_trading_days(current_date, bars_1)
    w_start_1 = add_trading_days(td_1, -2)
    w_end_1 = add_trading_days(td_1, 2)
    
    td_2 = add_trading_days(current_date, bars_2)
    w_start_2 = add_trading_days(td_2, -2)
    w_end_2 = add_trading_days(td_2, 2)
    
    td_m = add_trading_days(current_date, bars_m)
    w_start_m = add_trading_days(td_m, -3)
    w_end_m = add_trading_days(td_m, 3)
    
    clusters = cycle_info.get('confluence_clusters', [])
    def get_confluence_note(target_dt, default_name):
        for cl in clusters:
            try:
                cl_dt = datetime.datetime.strptime(cl['target_date'], '%b %d, %Y')
                if abs((cl_dt - target_dt).days) <= 4:
                    return f"{cl['confluence_score']}% Cluster ({cl['converging_cycles'][0]})"
            except Exception:
                pass
        return default_name

    conf_1 = get_confluence_note(td_1, f"{bars_1}-Bar Fibonacci Pivot")
    conf_2 = get_confluence_note(td_2, "Square of 9 90° Cardinal Axis")
    conf_m = get_confluence_note(td_m, "Master Solar Cycle / Full Orbit")
    
    target_1_time = {
        'target_date': td_1.strftime('%b %d, %Y'),
        'target_day': td_1.strftime('%A'),
        'trading_bars': bars_1,
        'calendar_days': (td_1 - current_date).days,
        'window': f"{w_start_1.strftime('%b %d')} – {w_end_1.strftime('%b %d, %Y')}",
        'confluence_cycle': conf_1,
        'timing_rule': f"Gann 1x1 Master Velocity: {bars_1} bars @ ${scale:.2f}/day"
    }
    
    target_2_time = {
        'target_date': td_2.strftime('%b %d, %Y'),
        'target_day': td_2.strftime('%A'),
        'trading_bars': bars_2,
        'calendar_days': (td_2 - current_date).days,
        'window': f"{w_start_2.strftime('%b %d')} – {w_end_2.strftime('%b %d, %Y')}",
        'confluence_cycle': conf_2,
        'timing_rule': f"Square of 9 90° Axis Rotation: {bars_2} bars"
    }
    
    macro_target_time = {
        'target_date': td_m.strftime('%b %d, %Y'),
        'target_day': td_m.strftime('%A'),
        'trading_bars': bars_m,
        'calendar_days': (td_m - current_date).days,
        'window': f"{w_start_m.strftime('%b %d')} – {w_end_m.strftime('%b %d, %Y')}",
        'confluence_cycle': conf_m,
        'timing_rule': f"Master Solar Orbit: {bars_m} bars"
    }
    
    milestone_roadmap = [
        {
            'milestone': f"Target 1: Next Sq9 ({sq9_info['next_target_deg']}°)",
            'price': next_sq9,
            'gain_pct': gain_sq9,
            'target_date': td_1.strftime('%b %d, %Y'),
            'target_day': td_1.strftime('%A'),
            'window': f"{w_start_1.strftime('%b %d')} – {w_end_1.strftime('%b %d, %Y')}",
            'bars': bars_1,
            'confluence_cycle': conf_1,
            'gann_rule': f"1x1 Master Velocity: {bars_1} bars @ ${scale:.2f}/day"
        },
        {
            'milestone': 'Target 2: 90° Major Square',
            'price': major_sq9,
            'gain_pct': round((major_sq9 - entry) / entry * 100, 1),
            'target_date': td_2.strftime('%b %d, %Y'),
            'target_day': td_2.strftime('%A'),
            'window': f"{w_start_2.strftime('%b %d')} – {w_end_2.strftime('%b %d, %Y')}",
            'bars': bars_2,
            'confluence_cycle': conf_2,
            'gann_rule': f"Square of 9 Cardinal Cross: {bars_2} bars"
        },
        {
            'milestone': 'Macro Target: 360° Orbit / Expansion',
            'price': macro_target,
            'gain_pct': round((macro_target - entry) / entry * 100, 1),
            'target_date': td_m.strftime('%b %d, %Y'),
            'target_day': td_m.strftime('%A'),
            'window': f"{w_start_m.strftime('%b %d')} – {w_end_m.strftime('%b %d, %Y')}",
            'bars': bars_m,
            'confluence_cycle': conf_m,
            'gann_rule': f"Master Solar Cycle: {bars_m} bars"
        }
    ]
    
    pyramiding_plan = [
        {
            'tier': 'Tier 1: Core Allocation (50%)',
            'entry_trigger': f"Current Level (${entry:.2f}) on 1x1 Angle confirmation",
            'stop_loss': f"${stop_loss:.2f}",
            'capital_alloc': '50% Initial Position',
            'timing': 'Immediate Execution (Active Cycle Phase)',
            'target_date': 'Active Now'
        },
        {
            'tier': 'Tier 2: First Pyramid Add (30%)',
            'entry_trigger': f"Breakout above +45° Semi-Square (${next_sq9:.2f})",
            'stop_loss': f"Ratchet stop to ${entry:.2f} (Breakeven)",
            'capital_alloc': '30% Additional Size',
            'timing': f"Est. {td_1.strftime('%b %d, %Y')} ({td_1.strftime('%A')})",
            'target_date': f"~{bars_1} Trading Bars"
        },
        {
            'tier': 'Tier 3: Final Runner Add (20%)',
            'entry_trigger': f"Expansion through 90° Major Square (${major_sq9:.2f})",
            'stop_loss': f"Trail along 1x1 Master Angle (${next_sq9 * 0.98:.2f})",
            'capital_alloc': '20% Final Size',
            'timing': f"Est. {td_2.strftime('%b %d, %Y')} ({td_2.strftime('%A')})",
            'target_date': f"~{bars_2} Trading Bars"
        }
    ]
    
    return {
        'setup_key': setup_key,
        'setup_name': setup_name,
        'direction': direction,
        'conviction': conviction,
        'entry': entry,
        'stop_loss': stop_loss,
        'target_1': next_sq9,
        'target_1_label': f"Next Sq9 ({sq9_info['next_target_deg']}°)",
        'target_1_time': target_1_time,
        'target_2': major_sq9,
        'target_2_label': '90° Major Square',
        'target_2_time': target_2_time,
        'macro_target': macro_target,
        'macro_target_label': '360° Full Orbit',
        'macro_target_time': macro_target_time,
        'risk_reward': max(1.5, rr_ratio),
        'description': desc,
        'pyramiding_plan': pyramiding_plan,
        'milestone_roadmap': milestone_roadmap,
        'timing_summary': f"Targets project across {bars_1} to {bars_m} trading bars ({td_1.strftime('%b %d')} to {td_m.strftime('%b %d, %Y')}) harmonized with Gann Master Cycles."
    }

# ==============================================================================
# 9. HIGH PRECISION CHART SERIALIZER (WITH GANN SWINGS & SECOND SQUARE)
# ==============================================================================
def generate_annotated_gann_chart(df, anchors, fan_info, sq9_info, cycle_info, octave_info, swing_info, limit_bars=260):
    """
    Serializes complete geometric overlays:
      - Candles & RVOL
      - Dual Anchors & Gann Box coordinates
      - Second Square Forward Box coordinates
      - Gann Mechanical Swing Line (stepped zigzag)
      - Upward & Downward Gann Fan rays
      - Square of 9 levels with confluence tags
      - Time Confluence Cluster Bands
      - 8ths Octaves
    """
    if df is None or len(df) == 0:
        return {'candles': [], 'fan_rays': [], 'sq9_levels': [], 'time_cycle_lines': [], 'octaves': []}
        
    if len(df) > limit_bars:
        df = df.iloc[-limit_bars:].reset_index(drop=True)
        
    candles = []
    for i, row in df.iterrows():
        d_str = row['Date'].strftime('%Y-%m-%d') if hasattr(row['Date'], 'strftime') else str(row['Date'])[:10]
        candles.append({
            'date': d_str,
            'open': round(float(row['Open']), 2),
            'high': round(float(row['High']), 2),
            'low': round(float(row['Low']), 2),
            'close': round(float(row['Close']), 2),
            'volume': int(row['Volume']),
            'rvol': round(float(row.get('RVOL', 1.0)), 2),
            'atr': round(float(row.get('ATR20', 1.5)), 2)
        })
        
    primary = anchors['primary_anchor']
    anchor_idx_trimmed = max(0, len(df) - 1 - primary['elapsed_bars'])
    low_idx_trimmed = max(0, len(df) - 1 - anchors['anchor_low']['elapsed_bars'])
    high_idx_trimmed = max(0, len(df) - 1 - anchors['anchor_high']['elapsed_bars'])
    
    # Upward Fan Rays (from Low)
    fan_rays = []
    for ang in fan_info['up_angles']:
        if ang['name'] in ['1x4', '1x2', '1x1', '2x1', '4x1']:
            fan_rays.append({
                'name': ang['name'],
                'type': 'UPWARD',
                'start_idx': low_idx_trimmed,
                'start_price': anchors['anchor_low']['price'],
                'end_idx': len(df) - 1,
                'end_price': ang['price'],
                'projected_price': ang['projected_ahead'],
                'degrees': ang['degrees'],
                'color': ang['color']
            })
            
    # Downward Fan Rays (from High)
    down_rays = []
    for ang in fan_info['down_angles']:
        if ang['name'] in ['1x4', '1x2', '1x1', '2x1', '4x1']:
            down_rays.append({
                'name': ang['name'],
                'type': 'DOWNWARD',
                'start_idx': high_idx_trimmed,
                'start_price': anchors['anchor_high']['price'],
                'end_idx': len(df) - 1,
                'end_price': ang['price'],
                'projected_price': ang['projected_ahead'],
                'degrees': ang['degrees'],
                'color': '#f43f5e' if ang['name'] in ['1x1', '2x1'] else '#fb7185'
            })
            
    # Square of 9 levels (Harmonic Resistance & Support Ladder)
    sq9_levels = []
    r_map = {45: 'R1', 90: 'R2', 135: 'R3', 180: 'R4', 225: 'R5', 270: 'R6'}
    for t in sq9_info['upside_targets'][:5]:
        r_tag = r_map.get(t['deg'], f"R ({t['deg']}°)")
        sq9_levels.append({
            'deg': t['deg'],
            'name': f"{r_tag} ({t['deg']}°)",
            'full_name': t['name'],
            'price': t['price'],
            'gain_pct': t['gain_pct'],
            'type': 'RESISTANCE',
            'color': '#10b981' if t['deg'] in [90, 180, 270, 360] else '#34d399',
            'has_confluence': t['has_confluence'],
            'confluence_label': t.get('confluence_label', '')
        })
    s_map = {45: 'S1', 90: 'S2', 135: 'S3', 180: 'S4', 225: 'S5', 270: 'S6'}
    for s in sq9_info['downside_supports'][:4]:
        s_tag = s_map.get(s['deg'], f"S ({s['deg']}°)")
        sq9_levels.append({
            'deg': s['deg'],
            'name': f"{s_tag} ({s['deg']}°)",
            'full_name': s['name'],
            'price': s['price'],
            'drop_pct': s['drop_pct'],
            'type': 'SUPPORT',
            'color': '#f43f5e' if s['deg'] in [90, 180, 270, 360] else '#fb7185',
            'has_confluence': s.get('has_confluence', False),
            'confluence_label': s.get('confluence_label', '')
        })
        
    # Time Cycle Lines
    anchor_dt = datetime.datetime.strptime(primary['anchor_date'], '%Y-%m-%d')
    date_to_idx = {c['date']: idx for idx, c in enumerate(candles)}
    time_cycle_lines = []
    
    for cycle in GANN_CALENDAR_CYCLES:
        target_dt = anchor_dt + datetime.timedelta(days=cycle['days'])
        target_str = target_dt.strftime('%Y-%m-%d')
        if target_str in date_to_idx:
            time_cycle_lines.append({
                'index': date_to_idx[target_str],
                'date': target_str,
                'name': cycle['name'],
                'type': cycle['type']
            })
            
    time_confluence_bands = []
    for cl in cycle_info.get('confluence_clusters', []):
        target_str = datetime.datetime.strptime(cl['target_date'], '%b %d, %Y').strftime('%Y-%m-%d')
        if target_str in date_to_idx:
            time_confluence_bands.append({
                'center_idx': date_to_idx[target_str],
                'date': target_str,
                'score': cl['confluence_score'],
                'cycles': cl['converging_cycles']
            })
            
    gann_box = anchors['gann_box']
    box_overlay = {
        'start_idx': min(low_idx_trimmed, high_idx_trimmed),
        'end_idx': max(low_idx_trimmed, high_idx_trimmed),
        'low_price': gann_box['low_price'],
        'high_price': gann_box['high_price'],
        'mid_price': gann_box['mid_price'],
        'p25_price': gann_box['p25_price'],
        'p75_price': gann_box['p75_price'],
        'low_idx': low_idx_trimmed,
        'high_idx': high_idx_trimmed
    }
    
    # Second Square Forward Box Overlay
    sec_sq = anchors['second_square']
    second_square_overlay = {
        'is_active': sec_sq['is_active'],
        'start_idx': box_overlay['end_idx'],
        'end_idx': min(len(df) - 1 + 20, box_overlay['end_idx'] + gann_box['box_bar_width']),
        'low_price': sec_sq['low_price'],
        'high_price': sec_sq['high_price'],
        'mid_price': sec_sq['mid_price'],
        'target_25': sec_sq['target_25'],
        'target_50': sec_sq['target_50'],
        'target_100': sec_sq['target_100']
    }
    
    # Remap Gann Swings to trimmed candles
    swing_points = []
    for s in swing_info.get('swings', []):
        if s['date'] in date_to_idx:
            swing_points.append({
                'idx': date_to_idx[s['date']],
                'date': s['date'],
                'price': s['price'],
                'type': s['type'],
                'is_active': s.get('is_active', False)
            })
            
    return {
        'candles': candles,
        'anchor': primary,
        'anchor_low': {**anchors['anchor_low'], 'trimmed_idx': low_idx_trimmed},
        'anchor_high': {**anchors['anchor_high'], 'trimmed_idx': high_idx_trimmed},
        'gann_box': box_overlay,
        'second_square': second_square_overlay,
        'gann_swings': swing_points,
        'fan_rays': fan_rays,
        'down_rays': down_rays,
        'sq9_levels': sq9_levels,
        'time_cycle_lines': time_cycle_lines,
        'time_confluence_bands': time_confluence_bands,
        'octaves': octave_info['eighths']
    }

# ==============================================================================
# 10. PUBLIC API EXPORTS
# ==============================================================================
def get_detailed_stock_gann(ticker, lookback_bars=260):
    """
    Complete quantitative W.D. Gann analysis suite for a single stock.
    """
    df = get_stock_data(ticker, lookback_days=350)
    if df is None or len(df) < 30:
        return {'error': f"Insufficient historical data to construct Gann geometry for {ticker}."}
        
    df = calculate_gann_indicators(df)
    current_close = float(df.iloc[-1]['Close'])
    atr = float(df.iloc[-1].get('ATR20', 2.0))
    current_date = df.iloc[-1]['Date']
    
    anchors = detect_dual_gann_anchors(df)
    if not anchors:
        return {'error': f"Could not establish Gann dual anchors for {ticker}."}
        
    primary = anchors['primary_anchor']
    fan_info = compute_dual_gann_fan_angles(anchors, current_close)
    octave_info = compute_three_squaring_methods_and_octaves(anchors, current_close)
    sq9_info = compute_square_of_9(primary['anchor_price'], current_close, octave_info['eighths'])
    cycle_info = compute_gann_time_confluence(anchors, current_date)
    swing_info = compute_gann_mechanical_swings(df, min_bars=2)
    
    playbook = classify_enhanced_gann_setup(
        anchors, fan_info, sq9_info, cycle_info, octave_info, swing_info, current_close, atr, current_date=current_date
    )
    
    chart_data = generate_annotated_gann_chart(
        df, anchors, fan_info, sq9_info, cycle_info, octave_info, swing_info, limit_bars=lookback_bars
    )
    
    return {
        'ticker': ticker.upper(),
        'current_price': current_close,
        'anchors': anchors,
        'anchor': primary,
        'gann_box': anchors['gann_box'],
        'second_square': anchors['second_square'],
        'fan_angles': fan_info,
        'square_of_9': sq9_info,
        'time_cycles': cycle_info,
        'octaves_and_squaring': octave_info,
        'gann_swings': swing_info,
        'playbook': playbook,
        'chart_data': chart_data
    }

def run_gann_screener(symbols=None, force_refresh=False):
    """
    Scans liquid universe across all Gann quantitative pillars and returns market breadth and scored setups.
    """
    if not symbols:
        symbols = CORE_GANN_UNIVERSE
        
    results = []
    bullish_1x1_count = 0
    squared_count = 0
    active_time_window_count = 0
    sq9_target_count = 0
    confluence_window_count = 0
    second_square_count = 0
    swing_uptrend_count = 0
    
    for sym in symbols:
        try:
            res = get_detailed_stock_gann(sym, lookback_bars=180)
            if 'error' in res:
                continue
                
            pb = res['playbook']
            fan = res['fan_angles']
            sq9 = res['square_of_9']
            tc = res['time_cycles']
            octv = res['octaves_and_squaring']
            sw = res['gann_swings']
            sec_sq = res['second_square']
            
            if fan['above_1x1']:
                bullish_1x1_count += 1
            if octv['is_squared']:
                squared_count += 1
            if tc.get('active_window'):
                active_time_window_count += 1
            if tc.get('next_cluster') and tc['next_cluster']['delta_days'] <= 7:
                confluence_window_count += 1
            if sq9['cardinal_aligned']:
                sq9_target_count += 1
            if sec_sq['is_active']:
                second_square_count += 1
            if sw['current_trend'] == 'UP':
                swing_uptrend_count += 1
                
            next_turn_str = tc['milestones'][0]['target_date'] if tc['milestones'] else 'N/A'
            next_cycle_str = tc['milestones'][0]['name'] if tc['milestones'] else 'N/A'
            
            results.append({
                'ticker': sym,
                'current_price': res['current_price'],
                'setup_name': pb['setup_name'],
                'setup_key': pb['setup_key'],
                'direction': pb['direction'],
                'conviction': pb['conviction'],
                'active_angle': fan['active_angle'],
                'above_1x1': fan['above_1x1'],
                'gann_swing_trend': sw['current_trend'],
                'second_square_active': sec_sq['is_active'],
                'current_sq9_degree': sq9['current_degree'],
                'aspect_label': sq9.get('aspect_label', 'Orbital Spiral'),
                'next_sq9_target': sq9['next_target_price'],
                'next_sq9_gain': sq9['next_target_gain'],
                'nearest_sq9_support': sq9['nearest_support_price'],
                'nearest_sq9_support_drop': sq9['nearest_support_drop'],
                'gann_sr_summary': sq9.get('sr_ladder', {}),
                'next_time_turn': next_turn_str,
                'next_time_cycle': next_cycle_str,
                'next_confluence_cluster': tc.get('next_cluster'),
                'is_squared': octv['is_squared'],
                'squaring_ratio': octv['square_ratio'],
                'entry': pb['entry'],
                'stop_loss': pb['stop_loss'],
                'target_1': pb['target_1'],
                'risk_reward': pb['risk_reward']
            })
        except Exception:
            continue
            
    results.sort(key=lambda x: x['conviction'], reverse=True)
    total_scanned = len(results)
    
    posture = {
        'total_scanned': total_scanned,
        'bullish_1x1_count': bullish_1x1_count,
        'bullish_1x1_pct': round((bullish_1x1_count / max(1, total_scanned)) * 100.0, 1),
        'squared_count': squared_count,
        'active_time_window_count': active_time_window_count,
        'confluence_window_count': confluence_window_count,
        'second_square_count': second_square_count,
        'swing_uptrend_count': swing_uptrend_count,
        'sq9_target_count': sq9_target_count,
        'primary_regime': "Geometric Markup Dominance" if (bullish_1x1_count / max(1, total_scanned)) >= 0.60 else "Cycle Transition & Defense"
    }
    
    return {
        'last_updated': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'posture': posture,
        'stocks': results
    }

if __name__ == '__main__':
    print("Testing upgraded Gann Engine v3.0...")
    res = get_detailed_stock_gann("META")
    print("Gann Swings:", res['gann_swings']['summary'])
    print("Second Square active:", res['second_square']['is_active'])
    print("Square of 9 Matrix cells:", len(res['square_of_9']['matrix_grid']['cells']))
    print("Chart swings remapped:", len(res['chart_data']['gann_swings']))
