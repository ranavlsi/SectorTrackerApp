from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_caching import Cache
import yfinance as yf
import pandas as pd
from earnings_engine import get_max_pain, get_eps_trend, get_historical_earnings_action, get_institutional_data
from fundamentals_engine import get_fundamentals
from fundamental_data_api import get_fundamental_history
from sec_filings_api import get_recent_filings
from peer_valuation_api import get_peer_valuation
from macro_outlook_engine import get_macro_outlook
from historical_dna_engine import calculate_dna

app = Flask(__name__)
CORS(app)
cache = Cache(config={'CACHE_TYPE': 'SimpleCache', 'CACHE_DEFAULT_TIMEOUT': 3600})
cache.init_app(app)

@app.route('/api/analyze_earnings', methods=['GET'])
@cache.cached(query_string=True)
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
@cache.cached(query_string=True)
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

@app.route('/api/dna', methods=['GET'])
@cache.cached(query_string=True)
def get_dna():
    ticker = request.args.get('ticker')
    if not ticker: return jsonify({"error": "No ticker provided"}), 400
    ticker = ticker.upper()
    try:
        data = calculate_dna(ticker)
        if "error" in data: return jsonify(data), 500
        return jsonify(data)
    except Exception as e:
        print(f"Error processing DNA for {ticker}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/sync_lakehouse', methods=['POST'])
def sync_lakehouse_api():
    try:
        # Launch sync_lakehouse.py in the background
        subprocess.Popen([sys.executable, "sync_lakehouse.py"])
        return jsonify({"status": "started", "message": "Lakehouse sync started in background."})
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500

@app.route('/api/run_rs_scanner', methods=['POST'])
def run_rs_scanner_api():
    try:
        # Launch rs_line_scanner.py in the background
        subprocess.Popen([sys.executable, "rs_line_scanner.py"])
        return jsonify({"status": "started", "message": "RS Line Scanner started in background."})
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500

@app.route('/api/deep_fundamentals', methods=['GET'])
@cache.cached(query_string=True)
def deep_fundamentals():
    ticker = request.args.get('ticker')
    if not ticker: return jsonify({"error": "No ticker provided"}), 400
    return jsonify(get_fundamental_history(ticker.upper()))

@app.route('/api/sec_filings', methods=['GET'])
@cache.cached(query_string=True)
def sec_filings():
    ticker = request.args.get('ticker')
    if not ticker: return jsonify({"error": "No ticker provided"}), 400
    return jsonify(get_recent_filings(ticker.upper()))

@app.route('/api/peer_valuation', methods=['GET'])
@cache.cached(query_string=True)
def peer_valuation():
    ticker = request.args.get('ticker')
    if not ticker: return jsonify({"error": "No ticker provided"}), 400
    return jsonify(get_peer_valuation(ticker.upper()))

@app.route('/api/macro_outlook', methods=['GET'])
@cache.cached(query_string=True)
def macro_outlook():
    ticker = request.args.get('ticker')
    if not ticker: return jsonify({"error": "No ticker provided"}), 400
    return jsonify(get_macro_outlook(ticker.upper()))

if __name__ == '__main__':
    print("Starting SectorTracker API server on port 5001...")
    app.run(port=5001, debug=True)
