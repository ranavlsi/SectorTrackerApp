import numpy as np
import pandas as pd
import yfinance as yf
import logging

logger = logging.getLogger(__name__)

def compute_atr(df, period=14):
    df['H-L'] = df['High'] - df['Low']
    df['H-C'] = np.abs(df['High'] - df['Close'].shift(1))
    df['L-C'] = np.abs(df['Low'] - df['Close'].shift(1))
    df['TR'] = df[['H-L', 'H-C', 'L-C']].max(axis=1)
    df['ATR'] = df['TR'].rolling(window=period).mean()
    return df

def calculate_technical_matrices(df):
    # Moving Averages
    df['SMA_20'] = df['Close'].rolling(window=20).mean()
    df['EMA_20'] = df['Close'].ewm(span=20, adjust=False).mean()
    df['EMA_50'] = df['Close'].ewm(span=50, adjust=False).mean()
    df['SMA_200'] = df['Close'].rolling(window=200).mean()
    
    # Bollinger Bands (20, 2)
    df['STD_20'] = df['Close'].rolling(window=20).std()
    df['BB_Upper'] = df['SMA_20'] + (2 * df['STD_20'])
    df['BB_Lower'] = df['SMA_20'] - (2 * df['STD_20'])
    
    # Keltner Channels (20 EMA, 1.5 ATR)
    df = compute_atr(df, 14)
    df['KC_Upper'] = df['EMA_20'] + (1.5 * df['ATR'])
    df['KC_Lower'] = df['EMA_20'] - (1.5 * df['ATR'])
    
    # The Squeeze State (BB inside KC)
    df['Squeeze_On'] = (df['BB_Upper'] < df['KC_Upper']) & (df['BB_Lower'] > df['KC_Lower'])
    
    # Volume Z-Score (50-day)
    df['Vol_SMA_50'] = df['Volume'].rolling(window=50).mean()
    df['Vol_STD_50'] = df['Volume'].rolling(window=50).std()
    df['Vol_ZScore'] = (df['Volume'] - df['Vol_SMA_50']) / df['Vol_STD_50']
    
    # 15-Day Resistance Pivot (Excluding the current breakout day)
    df['R_Pivot'] = df['High'].shift(1).rolling(window=15).max()
    
    return df

def check_market_regime():
    """
    Fetches SPY and VIX to prevent buying breakouts during market crashes.
    """
    try:
        data = yf.download("SPY ^VIX", period="1mo", interval="1d", group_by="ticker", progress=False)
        
        spy = data['SPY'].copy() if 'SPY' in data else data.copy()
        vix = data['^VIX'].copy() if '^VIX' in data else data.copy()
        
        if isinstance(spy.columns, pd.MultiIndex):
            spy.columns = spy.columns.get_level_values(0)
            vix.columns = vix.columns.get_level_values(0)
            
        spy['SMA_20'] = spy['Close'].rolling(window=20).mean()
        
        current_spy_close = spy['Close'].iloc[-1]
        current_spy_sma = spy['SMA_20'].iloc[-1]
        current_vix = vix['Close'].iloc[-1]
        
        # If SPY is below 20 SMA or VIX is high, market regime is hostile.
        is_hostile = current_spy_close < current_spy_sma or current_vix > 25
        return not is_hostile
    except Exception as e:
        logger.error(f"Market Regime Check Failed: {e}")
        return True # Default to pass if check fails to not brick the system

def evaluate_breakout_profile(ticker: str):
    """
    V2 Quantitative Breakout Engine.
    Executes strict multi-agent council upgrades for extreme robustness.
    """
    try:
        # 1. Broad Market Filter
        if not check_market_regime():
            # Suppress breakouts in hostile markets
            return None
            
        data = yf.download(ticker, period="1y", interval="1d", progress=False)
        if data.empty or len(data) < 200:
            return None
            
        if isinstance(data.columns, pd.MultiIndex):
            try:
                data = data.xs(ticker, axis=1, level=1)
            except Exception:
                data.columns = data.columns.get_level_values(0)
                
        # Failsafe: Ensure columns are Series
        for col in ['Close', 'High', 'Low', 'Volume']:
            if col in data and isinstance(data[col], pd.DataFrame):
                data[col] = data[col].iloc[:, 0]
            
        df = calculate_technical_matrices(data)
        
        # We need to evaluate the most recent completed state (or current day if running live)
        current = df.iloc[-1]
        
        # Trend Alignment: 20 EMA > 50 EMA > 200 SMA
        if not (current['EMA_20'] > current['EMA_50'] > current['SMA_200']):
            return None
            
        # Volume Z-Score Expansion (>= 1.25 Sigma for broader net)
        if current['Vol_ZScore'] < 1.25:
            return None
            
        # Structural Clearance Buffer
        # Current Close must break the 15-day pivot by at least +0.2 * ATR
        required_breakout_level = current['R_Pivot'] + (0.2 * current['ATR'])
        if current['Close'] < required_breakout_level:
            return None
            
        # The Squeeze (Did it coil recently?)
        # Make it an optional bonus flag rather than a hard rejection
        recent_squeeze = df['Squeeze_On'].iloc[-6:-1].any()
        
        # If all absolute parameters are met, generate execution artifact
        entry_level = current['Close']
        stop_level = current['R_Pivot'] - current['ATR'] # Stop dynamically placed 1 ATR below the broken pivot
        target_level = entry_level + (current['ATR'] * 3) # 3R standard target
        
        return {
            "status": "PASSED",
            "vol_zscore": round(float(current['Vol_ZScore']), 2),
            "squeeze_verified": bool(recent_squeeze),
            "rpivot": round(float(current['R_Pivot']), 2),
            "entry_level": round(float(entry_level), 2),
            "stop_level": round(float(stop_level), 2),
            "target_level": round(float(target_level), 2)
        }
        
    except Exception as e:
        logger.error(f"Error evaluating breakout profile for {ticker}: {e}")
        return None
