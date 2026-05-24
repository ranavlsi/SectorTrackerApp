from flask import Flask, request, jsonify
from flask_cors import CORS
import yfinance as yf
import pandas as pd
import math
import warnings
import sys
sys.path.append('/Users/amitkumar')
from sector_data_api import calculate_stage, calculate_macd, calculate_rsi, calculate_momentum_fade

warnings.filterwarnings('ignore')

app = Flask(__name__)
CORS(app)

@app.route('/api/search')
def search_stock():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "No ticker provided"}), 400
        
    ticker = ticker.upper()
    try:
        t = yf.Ticker(ticker)
        # Fetch Technicals
        df = t.history(period="2y")
        if len(df) < 200:
            return jsonify({"error": "Insufficient price data for Stage Analysis"}), 400
            
        spy = yf.Ticker("SPY").history(period="2y")
        
        close = df['Close']
        spy_close = spy['Close']
        
        sma200 = close.rolling(200).mean()
        macd, signal = calculate_macd(close)
        rsi = calculate_rsi(close)
        
        stage = calculate_stage(close, sma200)
        mom_text, mom_color = calculate_momentum_fade(macd, signal, rsi)
        
        # Performance
        perf = ((close.iloc[-1] / close.iloc[-2]) - 1) * 100
        
        # Check lengths to prevent IndexError
        rs_spy = 0
        if len(close) >= 20 and len(spy_close) >= 20:
             rs_spy = ((close.iloc[-1] / spy_close.iloc[-1]) / (close.iloc[-20] / spy_close.iloc[-20]) - 1) * 100
        
        # Fundamentals
        info = t.info
        rev_growth = info.get('revenueGrowth', 0) * 100 if info.get('revenueGrowth') else 0
        profit_margin = info.get('profitMargins', 0) * 100 if info.get('profitMargins') else 0
        roe = info.get('returnOnEquity', 0) * 100 if info.get('returnOnEquity') else 0
        peg = info.get('pegRatio', 0)
        
        # Master Score (0-100) Algorithm
        score = 50
        # Technical Score (+40 max, -40 max)
        if "Stage 2" in stage: score += 20
        elif "Stage 4" in stage: score -= 20
        
        if mom_color == 'bullish': score += 10
        elif mom_color == 'bearish': score -= 10
        
        if rs_spy > 0: score += 10
        else: score -= 10
        
        # Fundamental Score (+40 max)
        if rev_growth > 20: score += 10
        if profit_margin > 15: score += 10
        if roe > 15: score += 10
        if peg and 0 < peg < 1.5: score += 10
        elif peg and peg > 3: score -= 10
        
        score = max(0, min(100, score))
        
        # Trade Plan Algorithm (ATR based)
        curr_price = float(close.iloc[-1])
        tr1 = df['High'] - df['Low']
        tr2 = (df['High'] - close.shift(1)).abs()
        tr3 = (df['Low'] - close.shift(1)).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr = float(tr.rolling(14).mean().iloc[-1])
        
        stop_loss = curr_price - (1.5 * atr)
        profit_target = curr_price + (3.0 * atr)
        risk_pct = ((curr_price - stop_loss) / curr_price) * 100
        
        trade_plan = {
            "entry": round(curr_price, 2),
            "stop_loss": round(stop_loss, 2),
            "profit_target": round(profit_target, 2),
            "risk_pct": round(risk_pct, 1)
        }
        
        return jsonify({
            "ticker": ticker,
            "name": info.get('shortName', ticker),
            "score": int(score),
            "technicals": {
                "perf": float(perf),
                "stage": stage,
                "momentum_text": mom_text,
                "momentum_color": mom_color,
                "rs_spy_1mo": float(rs_spy)
            },
            "fundamentals": {
                "revenue_growth": float(rev_growth),
                "profit_margin": float(profit_margin),
                "roe": float(roe),
                "peg_ratio": float(peg) if peg else None
            },
            "trade_plan": trade_plan
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
def calculate_gamma(S, K, T, r, sigma):
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return 0
    d1 = (math.log(S / K) + (r + (sigma ** 2) / 2) * T) / (sigma * math.sqrt(T))
    gamma = math.exp(-0.5 * d1 ** 2) / (math.sqrt(2 * math.pi) * S * sigma * math.sqrt(T))
    return gamma

@app.route('/api/gex')
def get_gex():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "No ticker provided"}), 400
        
    ticker = ticker.upper()
    try:
        t = yf.Ticker(ticker)
        spot_price = t.fast_info.get('lastPrice', None)
        if not spot_price:
            hist = t.history(period="1d")
            if hist.empty:
                return jsonify({"error": f"Invalid ticker or no price data for {ticker}"}), 400
            spot_price = float(hist['Close'].iloc[-1])
            
        options = t.options
        if not options:
            return jsonify({"error": f"No options chain available for {ticker}"}), 400
            
        chain = t.option_chain(options[0])
        calls = chain.calls
        puts = chain.puts
        
        r = 0.05
        T = 5 / 365 
        
        gex_profile = []
        strikes = sorted(list(set(calls['strike']).union(set(puts['strike']))))
        
        for strike in strikes:
            if strike < spot_price * 0.9 or strike > spot_price * 1.1:
                continue
                
            call_row = calls[calls['strike'] == strike]
            put_row = puts[puts['strike'] == strike]
            
            c_gamma = 0
            c_oi = 0
            if not call_row.empty:
                iv = call_row.iloc[0]['impliedVolatility']
                c_oi = call_row.iloc[0]['openInterest']
                if pd.notna(iv) and pd.notna(c_oi):
                    c_gamma = calculate_gamma(spot_price, strike, T, r, iv)
                    
            p_gamma = 0
            p_oi = 0
            if not put_row.empty:
                iv = put_row.iloc[0]['impliedVolatility']
                p_oi = put_row.iloc[0]['openInterest']
                if pd.notna(iv) and pd.notna(p_oi):
                    p_gamma = calculate_gamma(spot_price, strike, T, r, iv)
                    
            net_gex = ((c_gamma * c_oi) - (p_gamma * p_oi)) * 100 * spot_price
            
            gex_profile.append({
                "strike": float(strike),
                "net_gex": float(net_gex),
                "call_oi": int(c_oi) if pd.notna(c_oi) else 0,
                "put_oi": int(p_oi) if pd.notna(p_oi) else 0
            })
            
        # Dark Pool / HVN calculation
        dark_pool_levels = []
        try:
            hist_intraday = t.history(period="5d", interval="15m")
            if not hist_intraday.empty:
                bin_size = 1.0 if spot_price > 50 else 0.5
                hist_intraday['PriceBin'] = (hist_intraday['Close'] / bin_size).round() * bin_size
                vp = hist_intraday.groupby('PriceBin')['Volume'].sum().nlargest(3)
                dark_pool_levels = [float(x) for x in vp.index.tolist()]
        except Exception as e:
            print("Dark pool calc error:", e)
            
        dark_pool_elevated = False
        try:
            hist_daily = t.history(period="6d")
            if len(hist_daily) >= 2:
                vol_today = hist_daily['Volume'].iloc[-1]
                vol_prev_avg = hist_daily['Volume'].iloc[:-1].mean()
                if vol_today > (vol_prev_avg * 1.2):
                    dark_pool_elevated = True
        except:
            pass

        options_activity_elevated = False
        try:
            total_vol = calls['volume'].sum() + puts['volume'].sum()
            total_oi = calls['openInterest'].sum() + puts['openInterest'].sum()
            if total_vol > total_oi:
                options_activity_elevated = True
        except:
            pass

        return jsonify({
            "ticker": ticker,
            "spot_price": spot_price,
            "gex_profile": gex_profile,
            "dark_pool_levels": dark_pool_levels,
            "dark_pool_elevated": dark_pool_elevated,
            "options_activity_elevated": options_activity_elevated
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)
