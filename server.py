from flask import Flask, request, jsonify
from flask_cors import CORS
import yfinance as yf
import pandas as pd
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
if __name__ == '__main__':
    app.run(port=5000, debug=True)
