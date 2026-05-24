from flask import Flask, request, jsonify
from flask_cors import CORS
import yfinance as yf
import pandas as pd
from earnings_engine import get_max_pain, get_eps_trend, get_historical_earnings_action, get_institutional_data
from fundamentals_engine import get_fundamentals

app = Flask(__name__)
CORS(app)

@app.route('/api/analyze_earnings', methods=['GET'])
def analyze_earnings():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "No ticker provided"}), 400
        
    ticker = ticker.upper()
    try:
        yf_ticker = yf.Ticker(ticker)
        current_price = float(yf_ticker.fast_info.last_price)
        calendar = yf_ticker.calendar
        
        earnings_date_str = "Unknown"
        if calendar and 'Earnings Date' in calendar and len(calendar['Earnings Date']) > 0:
            earnings_date_str = calendar['Earnings Date'][0].strftime('%Y-%m-%d')
            
        options_data = get_max_pain(ticker, current_price)
        eps_trend = get_eps_trend(ticker)
        historical_action = get_historical_earnings_action(ticker)
        inst_data = get_institutional_data(ticker)
        
        result = {
            "ticker": ticker,
            "current_price": round(current_price, 2) if pd.notna(current_price) else 0,
            "next_earnings_date": earnings_date_str,
            "options_data": options_data,
            "eps_trend": eps_trend,
            "historical_action": historical_action,
            "institutional": inst_data
        }
        
        return jsonify(result)
    except Exception as e:
        print(f"Error processing {ticker}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/fundamentals', methods=['GET'])
def fundamentals():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "No ticker provided"}), 400
        
    ticker = ticker.upper()
    try:
        data = get_fundamentals(ticker)
        if "error" in data:
            return jsonify(data), 500
        return jsonify(data)
    except Exception as e:
        print(f"Error processing fundamentals for {ticker}: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Starting SectorTracker API server on port 5001...")
    app.run(port=5001, debug=True)
