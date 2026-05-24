import yfinance as yf
import pandas as pd
import json
import os
from datetime import datetime
import warnings

warnings.filterwarnings('ignore')

ETFS = {
    'XLK': 'Technology', 'XLF': 'Financials', 'XLE': 'Energy', 'XLV': 'Healthcare',
    'XLI': 'Industrials', 'XLY': 'Consumer Discr', 'XLP': 'Consumer Staples',
    'XLU': 'Utilities', 'XLB': 'Materials', 'XLRE': 'Real Estate', 'XLC': 'Communication',
    'SMH': 'Semiconductors', 'IGV': 'Software', 'IBB': 'Biotechnology', 'KRE': 'Regional Banks',
    'ITB': 'Homebuilders', 'XRT': 'Retail', 'ICLN': 'Clean Energy', 'ARKK': 'Innovation',
    'IYT': 'Transportation', 'JETS': 'Airlines', 'URNM': 'Uranium', 'BOTZ': 'Robotics & AI',
    'GDX': 'Gold Miners', 'XME': 'Metals & Mining',
    'QTUM': 'Quantum', 'TAN': 'Solar'
}

PURE_PLAY_BASKETS = {
    'QTUM': ['IONQ', 'QBTS', 'RGTI', 'IBM', 'GOOGL', 'MSFT', 'HON'],
    'TAN': ['FSLR', 'ENPH', 'SEDG', 'RUN', 'ARRY', 'SHLS', 'DQ', 'CSIQ']
}

FALLBACK_HOLDINGS = {
    'XLK': ['MSFT', 'AAPL', 'NVDA', 'AVGO', 'ADBE'],
    'XLF': ['BRK-B', 'JPM', 'V', 'MA', 'BAC'],
    'XLE': ['XOM', 'CVX', 'COP', 'EOG', 'SLB'],
    'XLV': ['LLY', 'UNH', 'JNJ', 'MRK', 'ABBV'],
    'XLI': ['GE', 'CAT', 'UNP', 'BA', 'HON'],
    'XLY': ['AMZN', 'TSLA', 'HD', 'MCD', 'NKE'],
    'XLP': ['PG', 'COST', 'WMT', 'PEP', 'KO'],
    'XLU': ['NEE', 'SO', 'DUK', 'SRE', 'AEP'],
    'XLB': ['LIN', 'SHW', 'FCX', 'ECL', 'NEM'],
    'XLRE': ['PLD', 'AMT', 'EQIX', 'CCI', 'PSA'],
    'XLC': ['META', 'GOOGL', 'GOOG', 'NFLX', 'DIS'],
    'SMH': ['NVDA', 'TSM', 'AVGO', 'ASML', 'AMD'],
    'IGV': ['MSFT', 'ADBE', 'CRM', 'ORCL', 'INTU'],
    'IBB': ['VRTX', 'REGN', 'AMGN', 'GILD', 'BIIB'],
    'KRE': ['NYCB', 'ZION', 'RF', 'KEY', 'FITB'],
    'ITB': ['DHI', 'LEN', 'NVR', 'PHM', 'TOL'],
    'XRT': ['W', 'CVNA', 'GME', 'DKS', 'SIG'],
    'ICLN': ['ENPH', 'FSLR', 'PLUG', 'SEDG', 'RUN'],
    'ARKK': ['TSLA', 'COIN', 'ROKU', 'U', 'ZM'],
    'IYT': ['UNP', 'UPS', 'UBER', 'FDX', 'CSX'],
    'JETS': ['DAL', 'UAL', 'AAL', 'LUV', 'ALK'],
    'URNM': ['CCJ', 'UUUU', 'NXE', 'UEC', 'DNN'],
    'BOTZ': ['NVDA', 'ISRG', 'PATH', 'SYM', 'UPST'],
    'GDX': ['NEM', 'GOLD', 'AEM', 'WPM', 'FNV'],
    'XME': ['RS', 'STLD', 'NUE', 'CLF', 'X']
}

def calculate_stage(close_series, sma200_series):
    if len(close_series) < 200 or pd.isna(sma200_series.iloc[-1]):
        return "Unknown"
    current_price = float(close_series.iloc[-1])
    current_sma200 = float(sma200_series.iloc[-1])
    past_sma200 = float(sma200_series.iloc[-20])
    
    slope = (current_sma200 - past_sma200) / past_sma200 * 100
    price_pos = (current_price - current_sma200) / current_sma200 * 100
    
    if slope > 0.5 and price_pos > 0:
        return "Stage 2 (Advancing)"
    elif slope < -0.5 and price_pos < 0:
        return "Stage 4 (Declining)"
    elif abs(slope) <= 0.5:
        past_price = float(close_series.iloc[-60])
        if past_price > current_sma200:
            return "Stage 3 (Distribution)"
        else:
            return "Stage 1 (Basing)"
    elif price_pos > 0:
        return "Early Stage 2 Breakout"
    else:
        return "Stage 4 Breakdown"

def calculate_macd(series):
    exp1 = series.ewm(span=12, adjust=False).mean()
    exp2 = series.ewm(span=26, adjust=False).mean()
    macd = exp1 - exp2
    signal = macd.ewm(span=9, adjust=False).mean()
    return macd, signal

def calculate_rsi(series, period=14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

def calculate_momentum_fade(macd, signal, rsi):
    if len(macd) < 2 or pd.isna(macd.iloc[-1]): return "Unknown", "Neutral"
    hist_current = float(macd.iloc[-1] - signal.iloc[-1])
    hist_past = float(macd.iloc[-2] - signal.iloc[-2])
    rsi_current = float(rsi.iloc[-1])
    
    if hist_current > hist_past and rsi_current > 50:
        return "🔥 Momentum Building (Bullish)", "bullish"
    elif hist_current < hist_past and rsi_current > 50:
        return "⚠️ Momentum Fading (Exhaustion)", "warning"
    elif hist_current < hist_past and rsi_current < 50:
        return "🩸 Momentum Building (Bearish)", "bearish"
    elif hist_current > hist_past and rsi_current < 50:
        return "♻️ Momentum Fading (Oversold Bounce)", "bounce"
    return "Neutral", "neutral"

def generate_super_app_playbook(rrg_payload):
    daily = rrg_payload['daily']
    weekly = rrg_payload['weekly']
    
    d_hooks = sorted(daily, key=lambda i: i['trail'][-1]['y'], reverse=True)
    top_day_hooks = [x['name'] for x in d_hooks[:3] if x['trail'][-1]['y'] > 100]
    
    w_leading = sorted([x for x in weekly if x['trail'][-1]['x'] > 100 and x['trail'][-1]['y'] > 100], 
                       key=lambda i: i['trail'][-1]['x'], reverse=True)
    top_week_leaders = [x['name'] for x in w_leading[:3]]
    
    fading = [x['name'] for x in daily if x['trail'][-1]['x'] > 100 and x['trail'][-1]['y'] < 100]
    
    playbook = f"### Trading Playbook ({datetime.now().strftime('%B %d, %Y')})\n\n"
    
    playbook += "#### 🎯 Next Day Playbook (Short-Term Catalyst)\n"
    if top_day_hooks:
        playbook += f"For tomorrow's session, focus on **{', '.join(top_day_hooks)}**. These sectors are displaying massive short-term relative momentum (Y-Axis) on the Daily RRG, indicating aggressive immediate capital inflows.\n\n"
    else:
        playbook += "No clear immediate short-term momentum surges detected. Sit on hands or stick to core swings.\n\n"
        
    playbook += "#### 📈 Next Week Playbook (Swing Trade Leaders)\n"
    if top_week_leaders:
        playbook += f"For multi-day or weekly swing trades, allocate to **{', '.join(top_week_leaders)}**. These are the undisputed structural leaders on the Weekly RRG, firmly planted in the Leading quadrant with both high trend and high momentum.\n\n"
    else:
        playbook += "The market lacks structural leadership on the weekly timeframe. Be cautious with long swing trades.\n\n"
        
    playbook += "#### ⚠️ Fading Momentum Warnings\n"
    if fading:
        playbook += f"**Watch Out:** {', '.join(fading[:4])} have crossed down into the Weakening quadrant. Their structural trend is still high, but their immediate momentum has collapsed. This is a primary signal to take profits or tighten stop losses.\n\n"
    else:
        playbook += "No major sectors are currently showing structural deterioration.\n\n"
        
    return playbook

def fetch_dynamic_holdings():
    print("Extracting ETF holdings (Dynamic + Pure-Play Custom Baskets)...")
    dynamic_map = {}
    all_stocks = set()
    
    for etf in ETFS.keys():
        if etf in PURE_PLAY_BASKETS:
            dynamic_map[etf] = PURE_PLAY_BASKETS[etf]
            all_stocks.update(dynamic_map[etf])
        else:
            t = yf.Ticker(etf)
            try:
                holdings = t.funds_data.top_holdings
                if holdings is not None and not holdings.empty:
                    stock_list = holdings.index.tolist()
                    dynamic_map[etf] = stock_list
                    all_stocks.update(stock_list)
                else:
                    dynamic_map[etf] = FALLBACK_HOLDINGS.get(etf, [])
                    all_stocks.update(dynamic_map[etf])
            except Exception:
                dynamic_map[etf] = FALLBACK_HOLDINGS.get(etf, [])
                all_stocks.update(dynamic_map[etf])
            
    return dynamic_map, list(all_stocks)

def generate_data():
    tickers = list(ETFS.keys()) + ['SPY']
    print("Fetching historical sector data for Multi-Timeframe RRG (2 years needed for 200 SMA)...")
    df = yf.download(tickers, period='2y', interval='1d', group_by='ticker', progress=False)
    
    if df.empty or 'SPY' not in df:
        print("Error fetching S&P 500 baseline data.")
        return
        
    spy_close = df['SPY']['Close'].dropna()
    spy_sma50 = spy_close.rolling(50).mean()
    spy_sma200 = spy_close.rolling(200).mean()
    spy_macd, spy_signal = calculate_macd(spy_close)
    spy_rsi = calculate_rsi(spy_close)
    
    # Generate Global Market Trend Meter
    spy_price = float(spy_close.iloc[-1])
    spy_s200 = float(spy_sma200.iloc[-1])
    spy_s50 = float(spy_sma50.iloc[-1])
    spy_r = float(spy_rsi.iloc[-1])
    
    if spy_price > spy_s50 and spy_price > spy_s200 and spy_r > 50:
        market_meter = {"status": "Bullish", "color": "#10b981", "desc": "Price above key moving averages. Momentum is positive."}
    elif spy_price < spy_s200:
        market_meter = {"status": "Bearish", "color": "#ef4444", "desc": "Price below 200 SMA. Structural downtrend."}
    elif spy_price < spy_s50 and spy_price > spy_s200:
        market_meter = {"status": "Correction", "color": "#f59e0b", "desc": "Short-term weakness but long-term trend remains intact."}
    else:
        market_meter = {"status": "Neutral", "color": "#94a3b8", "desc": "Market is chopping sideways without clear direction."}
    
    data_payload = {
        "market_meter": market_meter,
        "rrg": {
            "daily": [],
            "weekly": [],
            "monthly": []
        },
        "analysis": "",
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    
    dynamic_holdings_map, all_underlying = fetch_dynamic_holdings()
    
    print(f"Fetching 2-year history for {len(all_underlying)} dynamic underlying stocks to calculate Stage Analysis...")
    stocks_df = yf.download(all_underlying, period='2y', interval='1d', group_by='ticker', progress=False)
    
    stock_analysis = {}
    for ticker in all_underlying:
        if ticker in stocks_df:
            try:
                t_close = stocks_df[ticker]['Close'].dropna()
                if len(t_close) >= 200:
                    t_sma200 = t_close.rolling(200).mean()
                    t_macd, t_signal = calculate_macd(t_close)
                    t_rsi = calculate_rsi(t_close)
                    
                    stage = calculate_stage(t_close, t_sma200)
                    momentum_text, momentum_color = calculate_momentum_fade(t_macd, t_signal, t_rsi)
                    
                    # Daily Performance
                    perf = ((t_close.iloc[-1] / t_close.iloc[-2]) - 1) * 100
                    
                    # RS vs SPY
                    rs_spy = ((t_close.iloc[-1] / spy_close.iloc[-1]) / (t_close.iloc[-20] / spy_close.iloc[-20]) - 1) * 100
                    
                    stock_analysis[ticker] = {
                        "perf": float(perf),
                        "stage": stage,
                        "momentum_text": momentum_text,
                        "momentum_color": momentum_color,
                        "rs_spy_1mo": float(rs_spy)
                    }
                elif len(t_close) >= 2:
                    perf = ((t_close.iloc[-1] / t_close.iloc[-2]) - 1) * 100
                    stock_analysis[ticker] = {"perf": float(perf), "stage": "Insufficient Data", "momentum_text": "Neutral", "momentum_color": "neutral", "rs_spy_1mo": 0}
                else:
                    stock_analysis[ticker] = {"perf": 0, "stage": "Unknown", "momentum_text": "Unknown", "momentum_color": "neutral", "rs_spy_1mo": 0}
            except:
                stock_analysis[ticker] = {"perf": 0, "stage": "Error", "momentum_text": "Error", "momentum_color": "neutral", "rs_spy_1mo": 0}
        else:
            stock_analysis[ticker] = {"perf": 0, "stage": "Unknown", "momentum_text": "Unknown", "momentum_color": "neutral", "rs_spy_1mo": 0}

    chart_dates = spy_close.index[-15:]
    
    for ticker, name in ETFS.items():
        if ticker not in df: continue
        t_close = df[ticker]['Close'].dropna()
        if len(t_close) < 210: continue
        
        rs = t_close / spy_close
        rs = rs.dropna()
        
        d_ratio = (rs.rolling(10).mean() / rs.rolling(40).mean()) * 100
        d_mom = (d_ratio / d_ratio.rolling(10).mean()) * 100
        d_ratio = d_ratio.dropna(); d_mom = d_mom.dropna()
        
        w_ratio = (rs.rolling(30).mean() / rs.rolling(100).mean()) * 100
        w_mom = (w_ratio / w_ratio.rolling(30).mean()) * 100
        w_ratio = w_ratio.dropna(); w_mom = w_mom.dropna()
        
        m_ratio = (rs.rolling(100).mean() / rs.rolling(200).mean()) * 100
        m_mom = (m_ratio / m_ratio.rolling(100).mean()) * 100
        m_ratio = m_ratio.dropna(); m_mom = m_mom.dropna()
        
        top_stocks = []
        if ticker in dynamic_holdings_map:
            holdings = dynamic_holdings_map[ticker]
            holding_perfs = []
            for h in holdings:
                if h in stock_analysis:
                    s_data = stock_analysis[h]
                    holding_perfs.append({
                        'ticker': h, 
                        'perf': s_data['perf'],
                        'stage': s_data['stage'],
                        'momentum_text': s_data['momentum_text'],
                        'momentum_color': s_data['momentum_color'],
                        'rs_spy_1mo': s_data['rs_spy_1mo']
                    })
            holding_perfs.sort(key=lambda x: x['perf'], reverse=True)
            top_stocks = holding_perfs[:5]

        def build_trail(r_series, m_series):
            trail = []
            for date in chart_dates:
                if date in r_series.index and date in m_series.index:
                    trail.append({
                        "date": date.strftime('%Y-%m-%d'),
                        "x": round(float(r_series.loc[date]), 2),
                        "y": round(float(m_series.loc[date]), 2)
                    })
            return trail

        d_trail = build_trail(d_ratio, d_mom)
        w_trail = build_trail(w_ratio, w_mom)
        m_trail = build_trail(m_ratio, m_mom)
        
        base_obj = {
            "ticker": ticker,
            "name": name,
            "top_stocks": top_stocks
        }
        
        if len(d_trail) > 0:
            d_obj = base_obj.copy(); d_obj["trail"] = d_trail
            data_payload["rrg"]["daily"].append(d_obj)
        if len(w_trail) > 0:
            w_obj = base_obj.copy(); w_obj["trail"] = w_trail
            data_payload["rrg"]["weekly"].append(w_obj)
        if len(m_trail) > 0:
            m_obj = base_obj.copy(); m_obj["trail"] = m_trail
            data_payload["rrg"]["monthly"].append(m_obj)
            
    data_payload["analysis"] = generate_super_app_playbook(data_payload["rrg"])
        
    output_file = '/Users/amitkumar/Desktop/SectorTrackerApp/public/sector_flow.json'
    
    with open(output_file, 'w') as f:
        json.dump(data_payload, f)
        
    print(f"Successfully generated Expert Stage Analysis payload to {output_file}")

if __name__ == "__main__":
    generate_data()
