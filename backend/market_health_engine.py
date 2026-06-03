import numpy as np
import pandas as pd
import json
import logging
import os
import yfinance as yf
from yahooquery import Ticker as YQTicker
import warnings
import cot_reports as cot
from datetime import datetime

warnings.filterwarnings('ignore')
logger = logging.getLogger(__name__)

def check_market_health():
    # Deprecated for the 15-parameter council engine.
    return []

def generate_market_health_json():
    # Attempt to import universe
    try:
        import sys
        sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from screener_engine import UNIVERSE
    except ImportError:
        UNIVERSE = ['AAPL', 'MSFT', 'NVDA', 'AVGO', 'ADBE', 'BRK-B', 'JPM', 'V', 'MA', 'BAC', 'XOM', 'CVX', 'COP', 'EOG', 'SLB', 'LLY', 'UNH', 'JNJ', 'MRK', 'ABBV', 'GE', 'CAT', 'UNP', 'BA', 'HON', 'AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'PG', 'COST', 'WMT', 'PEP', 'KO', 'NEE', 'SO', 'DUK', 'SRE', 'AEP', 'LIN', 'SHW', 'FCX', 'ECL', 'NEM', 'PLD', 'AMT', 'EQIX', 'CCI', 'PSA', 'META', 'GOOGL', 'GOOG', 'NFLX', 'DIS', 'TSM', 'ASML', 'AMD', 'CRM', 'ORCL', 'VRTX', 'REGN', 'AMGN', 'GILD', 'BIIB', 'DHI', 'LEN', 'NVR', 'PHM', 'TOL', 'FSLR', 'ENPH', 'SEDG', 'RUN', 'IONQ', 'QBTS', 'RGTI', 'IBM', 'COIN', 'ROKU', 'PLTR', 'ASTS', 'HOOD', 'RDDT', 'ALAB', 'ARM', 'CAVA', 'SMCI', 'CELH']

    # 1. Fetch Breadth Data (UNIVERSE)
    print("Fetching data for Market Health Council...")
    import duckdb
    lakehouse_path = "/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet"
    if not os.path.exists(lakehouse_path):
        print("Lakehouse data not found. Please run db_updater.py")
        return
        
    # Fetch 1 year of daily data for the universe from the local DuckDB Lakehouse
    lake_query = f"SELECT Ticker, Date, Close FROM read_parquet('{lakehouse_path}') WHERE Date >= current_date() - interval '1 year'"
    lake_df = duckdb.query(lake_query).to_df()
    
    # Pivot the Lakehouse dataframe
    breadth_df = lake_df.pivot(index='Date', columns='Ticker', values='Close')
    breadth_df.index = pd.to_datetime(breadth_df.index).tz_localize(None).normalize()

    # 2. Fetch Macro Indices (VIX, IRX) from Yahoo since Alpaca/Lakehouse lacks them
    macro_tickers = ['^VIX', '^VIX3M', '^IRX']
    macro_yf = yf.download(macro_tickers, period="2y", interval="1d", progress=False)['Close'].ffill()
    macro_yf.index = pd.to_datetime(macro_yf.index).tz_localize(None).normalize()
    
    # Time-Travel alignment: shift macro_yf's dates forward to match Lakehouse
    if not breadth_df.empty and not macro_yf.empty:
        last_breadth_date = breadth_df.index[-1]
        last_macro_date = macro_yf.index[-1]
        if last_macro_date < last_breadth_date:
            days_diff = (last_breadth_date - last_macro_date).days
            macro_yf.index = macro_yf.index + pd.Timedelta(days=days_diff)

    # Align YF dates and backfill any gaps caused by weekends
    # Use reindex with method='ffill' to correctly handle missing dates
    # But first, since we normalized, we can just do a standard reindex
    macro_yf_aligned = macro_yf.reindex(breadth_df.index).ffill().bfill()
    
    # Combine Lakehouse ETFs and YF Indices into macro_df
    lakehouse_etfs = ['SPY', 'QQQ', 'RSP', 'HYG', 'IEF', 'XLU', 'XLK']
    macro_df = pd.DataFrame(index=breadth_df.index)
    for etf in lakehouse_etfs:
        if etf in breadth_df.columns:
            macro_df[etf] = breadth_df[etf]
    for idx in macro_tickers:
        macro_df[idx] = macro_yf_aligned[idx]
        
    if breadth_df.empty or macro_df.empty:
        print("Failed to fetch data")
        return
    
    daily_returns = breadth_df.pct_change()
    advances = (daily_returns > 0).sum(axis=1)
    declines = (daily_returns < 0).sum(axis=1)
    net_advances = advances - declines
    
    ad_line = net_advances.cumsum()
    ema19 = net_advances.ewm(span=19, adjust=False).mean()
    ema39 = net_advances.ewm(span=39, adjust=False).mean()
    mco = ema19 - ema39
    summation_index = mco.cumsum()
    
    sma20 = breadth_df.rolling(20).mean()
    sma50 = breadth_df.rolling(50).mean()
    sma200 = breadth_df.rolling(200).mean()
    
    total_valid = breadth_df.notna().sum(axis=1)
    pct_above_20 = ((breadth_df > sma20).sum(axis=1) / total_valid) * 100
    pct_above_50 = ((breadth_df > sma50).sum(axis=1) / total_valid) * 100
    pct_above_200 = ((breadth_df > sma200).sum(axis=1) / total_valid) * 100
    
    rolling_max_20 = breadth_df.rolling(20).max()
    rolling_min_20 = breadth_df.rolling(20).min()
    new_highs = (breadth_df >= rolling_max_20).sum(axis=1)
    new_lows = (breadth_df <= rolling_min_20).sum(axis=1)
    
    # 3. Fetch CFTC COT Data
    try:
        current_year = datetime.now().year
        df1 = cot.cot_year(current_year, cot_report_type='legacy_fut')
        df2 = cot.cot_year(current_year - 1, cot_report_type='legacy_fut')
        cot_df = pd.concat([df1, df2])
        sp_cot = cot_df[cot_df['Market and Exchange Names'] == 'E-MINI S&P 500 - CHICAGO MERCANTILE EXCHANGE'].copy()
        sp_cot['Date'] = pd.to_datetime(sp_cot['As of Date in Form YYYY-MM-DD'])
        sp_cot.set_index('Date', inplace=True)
        sp_cot['Net_Commercials'] = sp_cot['Commercial Positions-Long (All)'] - sp_cot['Commercial Positions-Short (All)']
        sp_cot = sp_cot.sort_index()
        # Align with macro_df daily dates via forward fill
        cot_aligned = sp_cot['Net_Commercials'].reindex(macro_df.index, method='ffill')
    except Exception as e:
        print(f"Failed to fetch COT data: {e}")
        cot_aligned = pd.Series(0, index=macro_df.index)
        

    
    scores = []
    issues = []
    strengths = []
    
    def add_score(condition, positive_weight, negative_weight, issue_text, strength_text):
        if condition:
            scores.append(positive_weight)
            if strength_text: strengths.append(strength_text)
        else:
            scores.append(negative_weight)
            if issue_text: issues.append(issue_text)

    curr_idx = -1
    
    add_score(ad_line.iloc[curr_idx] > ad_line.rolling(10).mean().iloc[curr_idx], 1, 0, "A/D Line is falling below its 10-day trend", None)
    add_score(mco.iloc[curr_idx] > 0, 1, 0, "McClellan Oscillator is negative (Short-term breadth is weak)", None)
    add_score(summation_index.iloc[curr_idx] > summation_index.rolling(10).mean().iloc[curr_idx], 1, 0, "Summation Index is falling (Long-term breadth is deteriorating)", None)
    add_score(new_highs.iloc[curr_idx] > new_lows.iloc[curr_idx], 1, 0, f"New Lows ({new_lows.iloc[curr_idx]}) are outpacing New Highs ({new_highs.iloc[curr_idx]})", None)
    
    p20 = pct_above_20.iloc[curr_idx]
    add_score(p20 > 50, 1, 0, f"Only {p20:.1f}% of stocks are above 20-day SMA", None)
    
    p50 = pct_above_50.iloc[curr_idx]
    add_score(p50 > 50, 1, 0, f"Only {p50:.1f}% of stocks are above 50-day SMA", None)
    
    p200 = pct_above_200.iloc[curr_idx]
    add_score(p200 > 50, 1, 0, f"Only {p200:.1f}% of stocks are above 200-day SMA", None)
    
    hyg_ret = (macro_df['HYG'].iloc[curr_idx] - macro_df['HYG'].iloc[curr_idx-20]) / macro_df['HYG'].iloc[curr_idx-20]
    ief_ret = (macro_df['IEF'].iloc[curr_idx] - macro_df['IEF'].iloc[curr_idx-20]) / macro_df['IEF'].iloc[curr_idx-20]
    add_score(hyg_ret > ief_ret, 1, 0, "Treasuries are outperforming High-Yield Credit (Risk-Off)", None)
    
    add_score(macro_df['^VIX'].iloc[curr_idx] < macro_df['^VIX3M'].iloc[curr_idx], 1, -1, "VIX Term Structure is in Backwardation (Extreme Fear)", "VIX is in healthy Contango")
    
    spy_ret = (macro_df['SPY'].iloc[curr_idx] - macro_df['SPY'].iloc[curr_idx-20]) / macro_df['SPY'].iloc[curr_idx-20]
    rsp_ret = (macro_df['RSP'].iloc[curr_idx] - macro_df['RSP'].iloc[curr_idx-20]) / macro_df['RSP'].iloc[curr_idx-20]
    add_score(rsp_ret > spy_ret - 0.01, 1, 0, "Equal-weight RSP is severely lagging SPY (Poor participation)", None)
    
    qqq_ret = (macro_df['QQQ'].iloc[curr_idx] - macro_df['QQQ'].iloc[curr_idx-20]) / macro_df['QQQ'].iloc[curr_idx-20]
    add_score(qqq_ret > spy_ret, 1, 0, "Tech (QQQ) is lagging the broader market", None)
    
    xlk_ret = (macro_df['XLK'].iloc[curr_idx] - macro_df['XLK'].iloc[curr_idx-20]) / macro_df['XLK'].iloc[curr_idx-20]
    xlu_ret = (macro_df['XLU'].iloc[curr_idx] - macro_df['XLU'].iloc[curr_idx-20]) / macro_df['XLU'].iloc[curr_idx-20]
    add_score(xlk_ret > xlu_ret, 1, 0, "Utilities (Defensive) are outperforming Tech (Offensive)", None)
    
    spy_200 = macro_df['SPY'].rolling(200).mean().iloc[curr_idx]
    spy_extension = (macro_df['SPY'].iloc[curr_idx] - spy_200) / spy_200
    add_score(spy_extension < 0.15, 1, 0, f"SPY is extremely extended ({spy_extension*100:.1f}% above 200 SMA)", None)
    
    delta = macro_df['SPY'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    spy_rsi = rsi.iloc[curr_idx]
    add_score(spy_rsi < 70, 1, 0, f"SPY is overbought (RSI {spy_rsi:.1f} > 70)", None)
    
    vix_50 = macro_df['^VIX'].rolling(50).mean().iloc[curr_idx]
    add_score(macro_df['^VIX'].iloc[curr_idx] < vix_50, 1, 0, "VIX is trending above its 50-day average", None)

    max_possible = 15
    min_possible = -1
    total_score = sum(scores)
    
    # Calculate ratios for the whole series
    hyg_ratio = macro_df['HYG'] / macro_df['IEF']
    spy_rsp_ratio = macro_df['SPY'] / macro_df['RSP']
    qqq_spy_ratio = macro_df['QQQ'] / macro_df['SPY']
    xlk_xlu_ratio = macro_df['XLK'] / macro_df['XLU']
    
    # Mathematical Z-Score Composite Oscillator
    def calc_zscore(series, window=63):
        return (series - series.rolling(window).mean()) / series.rolling(window).std()

    z_mco = calc_zscore(mco)
    z_p50 = calc_zscore(pct_above_50)
    z_p200 = calc_zscore(pct_above_200)
    z_nhnl = calc_zscore(new_highs - new_lows)
    z_vix = -1 * calc_zscore(macro_df['^VIX']) # Invert so low VIX = positive Z
    z_credit = calc_zscore(hyg_ratio)

    composite_z = (z_mco + z_p50 + z_p200 + z_nhnl + z_vix + z_credit) / 6.0
    
    # 5-day EMA smoothing to eliminate noise
    smoothed_z = composite_z.ewm(span=5, adjust=False).mean()
    
    # Sigmoid Normalization to bound strictly between 0 and 100
    health_oscillator = 100 / (1 + np.exp(- smoothed_z * 1.5))
    
    normalized_score = round(float(health_oscillator.iloc[-1]), 1)
    
    if normalized_score < 20:
        caution_level = "Extreme Fear / Washout"
        hist_context = "Historically, scores below 20 indicate structural panic. While risky, this is typically where multi-month bottoms form."
    elif normalized_score < 40:
        caution_level = "Bearish / Deteriorating"
        hist_context = "The market is breaking down internally. Historically, capital preservation is prioritized here until the McClellan Summation Index curls up."
    elif normalized_score < 60:
        caution_level = "Neutral / Choppy"
        hist_context = "Conditions are highly mixed. Expect choppy, range-bound price action. Stock selection is critical."
    elif normalized_score < 80:
        caution_level = "Bullish / Healthy"
        hist_context = "Breadth is confirming price action. Historically, this environment supports aggressive swing trading and long breakouts."
    else:
        caution_level = "Euphoria / Overextended"
        hist_context = "The market is running hot. Historically, scores above 80 suggest a violent mean-reversion pullback is imminent. Tighten stops."
        
    summary_parts = [
        f"**Aggregate Market Health Score: {normalized_score}/100**",
        f"**Caution Level:** {caution_level}",
        f"**Historical Context:** {hist_context}"
    ]
    
    summary_parts.append("\n**Deteriorating Parameters (Caution):**")
    if issues:
        for iss in issues:
            summary_parts.append(f"- {iss}")
    else:
        summary_parts.append("- None. All parameters are trending positively.")
            
    summary_parts.append("\n**Overextended Warnings (Mean-Reversion Risk):**")
    overextended = False
    if p20 > 80: 
        summary_parts.append(f"- {p20:.1f}% of stocks are > 20 SMA (Short-term exhaustion).")
        overextended = True
    if p50 > 85: 
        summary_parts.append(f"- {p50:.1f}% of stocks are > 50 SMA (Intermediate exhaustion).")
        overextended = True
    if p200 > 85:
        summary_parts.append(f"- {p200:.1f}% of stocks are > 200 SMA (Long-term exhaustion).")
        overextended = True
    if spy_extension > 0.12: 
        summary_parts.append(f"- SPY is extended {spy_extension*100:.1f}% above its 200 SMA.")
        overextended = True
    if spy_rsi > 70: 
        summary_parts.append(f"- SPY RSI is heavily overbought at {spy_rsi:.1f}.")
        overextended = True
        
    if not overextended:
        summary_parts.append("- None. The market is not structurally overextended.")
        
    summary_parts.append("\n**Key Strengths:**")
    if strengths:
        for string in strengths:
            summary_parts.append(f"- {string}")
    else:
        summary_parts.append("- Market internals lack notable outperformance characteristics.")
    full_summary = "\n".join(summary_parts)
    print(full_summary)
    
    historical_data = []
    valid_dates = macro_df.index[-60:]
    
    for date in valid_dates:
        date_str = date.strftime('%Y-%m-%d')
        
        # Safe extraction helper
        def get_val(df_or_series, dt, default=0):
            try:
                val = df_or_series.loc[dt]
                if isinstance(val, pd.Series):
                    val = val.iloc[0]
                return round(float(val), 2) if not pd.isna(val) else default
            except:
                return default
                
        historical_data.append({
            "date": date_str,
            "spy": get_val(macro_df['SPY'], date),
            "health_oscillator": get_val(health_oscillator, date, 50.0),
            "ad_line": int(get_val(ad_line, date)),
            "mco": get_val(mco, date),
            "pct_above_20": get_val(pct_above_20, date),
            "pct_above_50": get_val(pct_above_50, date),
            "pct_above_200": get_val(pct_above_200, date),
            "new_highs": int(get_val(new_highs, date)),
            "new_lows": int(get_val(new_lows, date)),
            "vix": get_val(macro_df['^VIX'], date),
            "vix3m": get_val(macro_df['^VIX3M'], date),
            "hyg_ratio": get_val(hyg_ratio, date),
            "spy_rsp_ratio": get_val(spy_rsp_ratio, date),
            "qqq_spy_ratio": get_val(qqq_spy_ratio, date),
            "xlk_xlu_ratio": get_val(xlk_xlu_ratio, date),
            "irx": get_val(macro_df['^IRX'], date),
            "cot_net": get_val(cot_aligned, date)
        })
        
    json_payload = {
        "current_health": {
            "score_value": normalized_score,
            "score_label": caution_level,
            "mco_status": "Overbought" if mco.iloc[curr_idx] > 30 else "Oversold" if mco.iloc[curr_idx] < -30 else "Neutral",
            "breadth_status": "Strong" if p50 > 75 else "Weak" if p50 < 25 else "Neutral",
            "summary_text": full_summary,
            "ad_momentum": "Bullish (Rising)" if mco.iloc[curr_idx] > mco.iloc[curr_idx-1] else "Bearish (Falling)",
            "mco_value": round(float(mco.iloc[curr_idx]), 2),
            "pct_above_50_value": round(float(p50), 1),
            "pct_above_200_value": round(float(p200), 1),
            "chart_observations": {
                "irx_liquidity": f"13-Week T-Bill Yield is {macro_df['^IRX'].iloc[-1]:.2f}%. {'Rising yields pressure equities.' if macro_df['^IRX'].iloc[-1] > macro_df['^IRX'].iloc[-20] else 'Falling yields are a tailwind for liquidity.'}",
                "cot": f"Net Commercial Positioning on S&P 500 is {int(cot_aligned.iloc[-1])}. {'Smart Money is aggressively hedging (short).' if cot_aligned.iloc[-1] < 0 else 'Smart Money is net long.'}",
                "oscillator": f"Composite Health Oscillator is at {health_oscillator.iloc[-1]:.1f}/100. {'Market internals are structurally breaking down.' if health_oscillator.iloc[-1] < 40 else 'Market internals are overheated/euphoric.' if health_oscillator.iloc[-1] > 80 else 'Market internals are healthy and expanding.'}",
                "ad_line": "A/D Line is rising with price, confirming broad participation." if ad_line.iloc[curr_idx] > ad_line.rolling(10).mean().iloc[curr_idx] else "A/D Line is lagging price, indicating narrowing participation.",
                "mco": f"Momentum is {'overbought' if mco.iloc[curr_idx] > 30 else 'oversold' if mco.iloc[curr_idx] < -30 else 'neutral'} at {round(float(mco.iloc[curr_idx]), 1)}.",
                "p50": f"{p50:.1f}% of stocks are > 50 SMA. {'Extreme exhaustion risk.' if p50 > 85 else 'Healthy breadth.' if p50 > 50 else 'Weak breadth.'}",
                "nhnl": f"New Highs ({new_highs.iloc[curr_idx]}) are {'outpacing' if new_highs.iloc[curr_idx] > new_lows.iloc[curr_idx] else 'lagging'} New Lows ({new_lows.iloc[curr_idx]}).",
                "vix_curve": "VIX is in Contango (Risk-On, complacency)." if macro_df['^VIX'].iloc[curr_idx] < macro_df['^VIX3M'].iloc[curr_idx] else "VIX is in Backwardation (Extreme Fear, hedging).",
                "credit": "High Yield Debt (HYG) is outperforming safe Treasuries (IEF), signaling institutional Risk-On behavior." if hyg_ret > ief_ret else "Treasuries are outperforming High-Yield, signaling Risk-Off capital flight.",
                "divergence": f"Equal-weight RSP is {'outperforming' if rsp_ret > spy_ret else 'lagging'} SPY. Tech QQQ is {'outperforming' if qqq_ret > spy_ret else 'lagging'} SPY."
            }
        },
        "historical_data": historical_data
    }
    
    output_path = '/Users/amitkumar/Desktop/SectorTrackerApp/public/market_health.json'
    with open(output_path, 'w') as f:
        json.dump(json_payload, f)
        
    print(f"Successfully generated {output_path}")
    return json_payload

if __name__ == "__main__":
    generate_market_health_json()
