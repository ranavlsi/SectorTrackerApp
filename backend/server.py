from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_caching import Cache
import yfinance as yf
import pandas as pd
import json
import os
import sys
import subprocess
from earnings_engine import analyze_single_ticker
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
        data = analyze_single_ticker(ticker)
        return jsonify(data)
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

@app.route('/api/run_weekly_playbook', methods=['POST'])
def run_weekly_playbook_api():
    try:
        script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "weekly_playbook_engine.py")
        subprocess.Popen([sys.executable, script_path])
        return jsonify({"status": "started", "message": "Weekly Playbook 2.0 generation started in background."})
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500

@app.route('/api/run_master_screener', methods=['POST'])
def run_master_screener_api():
    try:
        script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screener_engine.py")
        subprocess.Popen([sys.executable, script_path])
        return jsonify({"status": "started", "message": "Master Screener Engine started in background."})
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500

@app.route('/api/clean_uptrend_scanner', methods=['GET', 'POST'])
def clean_uptrend_scanner_api():
    try:
        res_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "clean_uptrend_results.json")
        force_refresh = request.args.get('force_refresh', 'false').lower() == 'true' or request.method == 'POST'
        
        if force_refresh or not os.path.exists(res_file):
            from clean_uptrend_scanner import run_clean_uptrend_scanner
            data = run_clean_uptrend_scanner(force_refresh=True)
            return jsonify(data)
            
        with open(res_file, 'r') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500

@app.route('/api/screener_freshness', methods=['GET'])
def screener_freshness_api():
    try:
        res_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "screener_results.json")
        if os.path.exists(res_file):
            with open(res_file) as f:
                d = json.load(f)
            meta = d.get("_metadata", {})
            return jsonify({
                "status": "ok",
                "metadata": meta,
                "file_modified_time": os.path.getmtime(res_file)
            })
        return jsonify({"status": "missing"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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

@app.route('/api/stream', methods=['GET'])
def sse_stream():
    def event_generator():
        import time
        while True:
            # Heartbeat stream keepalive
            yield f"data: {json.dumps({'type': 'keepalive', 'timestamp': time.time()})}\n\n"
            time.sleep(15)
    from flask import Response
    return Response(event_generator(), mimetype='text/event-stream')

# ==============================================================================
# STAN WEINSTEIN STAGE ANALYSIS + CANSLIM & THEME ROTATION QUADRANT APIs
# ==============================================================================
from stage_canslim_engine import compute_sector_stage_rotation, run_stage_canslim_screener, get_detailed_stage_canslim, compute_etf_stock_rotation

@app.route('/api/stage_canslim/sector_stage_rotation', methods=['GET'])
@cache.cached(query_string=True, timeout=120)
def api_sector_stage_rotation():
    try:
        lookback = request.args.get('lookback', 10, type=int)
        mode = request.args.get('mode', 'stage')
        force = request.args.get('force', 'false').lower() == 'true'
        data = compute_sector_stage_rotation(lookback_bars=lookback, mode=mode, force_refresh=force)
        return jsonify(data)
    except Exception as e:
        print(f"Error computing sector stage rotation: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500

@app.route('/api/stage_canslim/etf_drilldown', methods=['GET'])
@cache.cached(query_string=True, timeout=120)
def api_etf_drilldown():
    try:
        etf = request.args.get('etf', 'XLK')
        lookback = request.args.get('lookback', 10, type=int)
        mode = request.args.get('mode', 'stage')
        force = request.args.get('force', 'false').lower() == 'true'
        data = compute_etf_stock_rotation(etf_symbol=etf, lookback_bars=lookback, mode=mode, force_refresh=force)
        return jsonify(data)
    except Exception as e:
        print(f"Error computing ETF drilldown for {request.args.get('etf')}: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500

@app.route('/api/stage_canslim/screener', methods=['GET'])
@cache.cached(query_string=True, timeout=300)
def api_stage_canslim_screener():
    try:
        force = request.args.get('force', 'false').lower() == 'true'
        data = run_stage_canslim_screener(force_refresh=force)
        return jsonify(data)
    except Exception as e:
        print(f"Error running stage canslim screener: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500

@app.route('/api/stage_canslim/stock_analysis', methods=['GET'])
@cache.cached(query_string=True, timeout=300)
def api_stage_canslim_stock_analysis():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "No ticker provided"}), 400
    try:
        data = get_detailed_stage_canslim(ticker.upper())
        return jsonify(data)
    except Exception as e:
        print(f"Error running detailed stage canslim analysis for {ticker}: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500

# ==============================================================================
# RICHARD WYCKOFF METHOD ACCUMULATION/DISTRIBUTION ENGINE APIs
# ==============================================================================
from wyckoff_engine import run_wyckoff_screener, get_detailed_stock_wyckoff

@app.route('/api/wyckoff/summary', methods=['GET'])
@cache.cached(query_string=True, timeout=180)
def api_wyckoff_summary():
    try:
        force = request.args.get('refresh', 'false').lower() == 'true'
        data = run_wyckoff_screener(force_refresh=force)
        return jsonify(data)
    except Exception as e:
        print(f"Error running Wyckoff screener: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500

@app.route('/api/wyckoff/stock_analysis', methods=['GET'])
@cache.cached(query_string=True, timeout=180)
def api_wyckoff_stock_analysis():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "No ticker provided"}), 400
    try:
        data = get_detailed_stock_wyckoff(ticker.upper())
        return jsonify(data)
    except Exception as e:
        print(f"Error running detailed Wyckoff analysis for {ticker}: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500

# ==============================================================================
# ELLIOTT WAVE PRINCIPLE ENGINE APIs
# ==============================================================================
from elliott_wave_engine import run_elliott_wave_screener, get_detailed_stock_elliott_wave

@app.route('/api/elliott_wave/summary', methods=['GET'])
@cache.cached(query_string=True, timeout=180)
def api_elliott_wave_summary():
    try:
        force = request.args.get('refresh', 'false').lower() == 'true'
        data = run_elliott_wave_screener(force_refresh=force)
        return jsonify(data)
    except Exception as e:
        print(f"Error running Elliott Wave screener: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500

@app.route('/api/elliott_wave/stock_analysis', methods=['GET'])
@cache.cached(query_string=True, timeout=180)
def api_elliott_wave_stock_analysis():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "No ticker provided"}), 400
    timeframe = request.args.get('timeframe', '1D')
    try:
        data = get_detailed_stock_elliott_wave(ticker.upper(), timeframe=timeframe)
        return jsonify(data)
    except Exception as e:
        print(f"Error running detailed Elliott Wave analysis for {ticker}: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500

# ==============================================================================
# BEST ACTING STOCKS & REALSIMPLE FRAMEWORK APIs
# ==============================================================================
from best_acting_engine import run_best_acting_scanner
from realsimple_engine import run_realsimple_scanner

@app.route('/api/best_acting_stocks', methods=['GET'])
@cache.cached(query_string=True, timeout=180)
def api_best_acting_stocks():
    try:
        data = run_best_acting_scanner()
        return jsonify(data)
    except Exception as e:
        print(f"Error running Best Acting scanner: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500

@app.route('/api/realsimple_framework', methods=['GET'])
@cache.cached(query_string=True, timeout=180)
def api_realsimple_framework():
    try:
        data = run_realsimple_scanner()
        return jsonify(data)
    except Exception as e:
        print(f"Error running RealSimple scanner: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500

# ==============================================================================
# W.D. GANN GEOMETRIC & CYCLE TERMINAL APIs
# ==============================================================================
from gann_engine import run_gann_screener, get_detailed_stock_gann

@app.route('/api/gann/summary', methods=['GET'])
@cache.cached(query_string=True, timeout=180)
def api_gann_summary():
    try:
        force = request.args.get('refresh', 'false').lower() == 'true'
        data = run_gann_screener(force_refresh=force)
        return jsonify(data)
    except Exception as e:
        print(f"Error in /api/gann/summary: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500

@app.route('/api/gann/screener', methods=['GET'])
@cache.cached(query_string=True, timeout=180)
def api_gann_screener():
    try:
        setup_filter = (request.args.get('filter') or request.args.get('setup') or '').lower().strip()
        data = run_gann_screener(force_refresh=False)
        stocks = data.get('stocks', [])
        
        if setup_filter and setup_filter != 'all':
            filtered_stocks = [
                s for s in stocks 
                if setup_filter in s.get('setup_key', '').lower() 
                or (setup_filter == '1x1_bull' and (s.get('above_1x1') or '1x1' in s.get('setup_key', '').lower()))
                or (setup_filter == 'sq9_target' and ('sq9' in s.get('setup_key', '').lower() or 'square of 9' in s.get('setup_name', '').lower()))
                or (setup_filter == 'time_cycle' and ('time' in s.get('setup_key', '').lower() or 'cycle' in s.get('setup_key', '').lower()))
                or (setup_filter == 'squared' and s.get('is_squared'))
            ]
            return jsonify({
                "last_updated": data.get("last_updated"),
                "posture": data.get("posture"),
                "filter": setup_filter,
                "count": len(filtered_stocks),
                "stocks": filtered_stocks
            })
            
        return jsonify({
            "last_updated": data.get("last_updated"),
            "posture": data.get("posture"),
            "filter": "all",
            "count": len(stocks),
            "stocks": stocks
        })
    except Exception as e:
        print(f"Error in /api/gann/screener: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500

@app.route('/api/gann/stock_analysis', methods=['GET'])
@cache.cached(query_string=True, timeout=180)
def api_gann_stock_analysis():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "No ticker provided"}), 400
    try:
        data = get_detailed_stock_gann(ticker.upper().strip())
        if 'error' in data:
            return jsonify(data), 404
        return jsonify(data)
    except Exception as e:
        print(f"Error in /api/gann/stock_analysis for {ticker}: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500

# ==============================================================================
# VOLATILITY SURFACE & GEX APIS
# ==============================================================================
@app.route('/api/volatility_surface', methods=['GET'])
def api_volatility_surface():
    try:
        root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if root_dir not in sys.path:
            sys.path.insert(0, root_dir)
        import server as root_server
        return root_server.get_vol_surface()
    except Exception as e:
        print(f"Error in /api/volatility_surface: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500

@app.route('/api/gex', methods=['GET'])
def api_gex():
    try:
        root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if root_dir not in sys.path:
            sys.path.insert(0, root_dir)
        import server as root_server
        return root_server.api_gex()
    except Exception as e:
        print(f"Error in /api/gex: {e}")
        return jsonify({"error": str(e), "status": "error"}), 500

# ==============================================================================
# OPTIONS INTELLIGENCE & SCREENER APIS
# ==============================================================================
import threading
from datetime import datetime

try:
    from options_dumper import run_options_dump, seed_rolling_history_if_needed
    from options_screener_engine import (
        get_options_screener_summary,
        get_ticker_30d_history,
        get_deep_options_analytics
    )
except ImportError:
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    from options_dumper import run_options_dump, seed_rolling_history_if_needed
    from options_screener_engine import (
        get_options_screener_summary,
        get_ticker_30d_history,
        get_deep_options_analytics
    )

@app.route('/api/options_screener/summary', methods=['GET'])
def api_options_screener_summary():
    try:
        force = request.args.get('refresh', 'false').lower() == 'true'
        data = get_options_screener_summary(force_refresh=force)
        return jsonify(data)
    except Exception as e:
        print(f"Error in /api/options_screener/summary: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/options_screener/ticker_history', methods=['GET'])
def api_options_screener_ticker_history():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "No ticker provided"}), 400
    try:
        data = get_ticker_30d_history(ticker.upper())
        return jsonify(data)
    except Exception as e:
        print(f"Error in /api/options_screener/ticker_history for {ticker}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/options_screener/deep_analytics', methods=['GET'])
def api_options_screener_deep_analytics():
    ticker = request.args.get('ticker')
    if not ticker:
        return jsonify({"error": "No ticker provided"}), 400
    try:
        data = get_deep_options_analytics(ticker.upper())
        return jsonify(data)
    except Exception as e:
        print(f"Error in /api/options_screener/deep_analytics for {ticker}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/options_screener/dump_now', methods=['POST'])
def api_trigger_options_dump_now():
    try:
        scope = request.json.get('scope', 'all') if (request.is_json and request.json) else 'all'
        symbols_arg = request.json.get('symbols') if (request.is_json and request.json) else None

        # Check if already dumping recently
        data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
        status_file = os.path.join(data_dir, 'options_dumper_status.json')
        if os.path.exists(status_file):
            try:
                with open(status_file, 'r') as f:
                    curr_status = json.load(f)
                    if curr_status.get('is_running'):
                        ts = curr_status.get('timestamp')
                        if ts:
                            try:
                                dt = datetime.fromisoformat(ts)
                                if (datetime.now() - dt).total_seconds() < 120:
                                    return jsonify({"status": "already_running", "message": "Options dump is already running in background."})
                            except Exception:
                                pass
            except Exception:
                pass

        def _run_dump():
            try:
                run_options_dump(symbols=symbols_arg, scope=scope)
                seed_rolling_history_if_needed()
            except Exception as ex:
                print(f"Background options dump failed: {ex}")
                from options_dumper import update_status
                update_status(False, message=f"Dump failed: {ex}", last_error=str(ex))

        threading.Thread(target=_run_dump, daemon=True).start()
        return jsonify({"status": "started", "message": f"Options dump initiated in background for scope '{scope}'."})
    except Exception as e:
        print(f"Error initiating options dump: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/options_screener/status', methods=['GET'])
def api_options_screener_status():
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
    status_file = os.path.join(data_dir, 'options_dumper_status.json')
    if os.path.exists(status_file):
        try:
            with open(status_file, 'r') as f:
                data = json.load(f)
                # Auto-heal stale is_running flag if older than 5 minutes
                if data.get('is_running'):
                    ts = data.get('timestamp')
                    if ts:
                        try:
                            dt = datetime.fromisoformat(ts)
                            if (datetime.now() - dt).total_seconds() > 300:
                                data['is_running'] = False
                                data['message'] = "Idle (previous job finished or timed out)"
                        except Exception:
                            pass
                return jsonify(data)
        except Exception:
            pass
    return jsonify({"is_running": False, "progress": 0, "total": 0, "message": "Idle"})

if __name__ == '__main__':
    print("Starting SectorTracker API server on port 5000...")
    app.run(port=5000, debug=True)


