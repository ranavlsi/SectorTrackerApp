import json
import yfinance as yf
from datetime import datetime
import os
from trade_council import TradeCouncil

try:
    from sector_data_api import calculate_stage, calculate_macd, calculate_rsi, calculate_momentum_fade
except ImportError:
    print("Warning: Could not import health functions from sector_data_api")
    def calculate_stage(c,s): return "Unknown"
    def calculate_macd(c): return pd.Series([0]), pd.Series([0])
    def calculate_rsi(c): return pd.Series([0])
    def calculate_momentum_fade(m,s,r): return "Unknown", "#94a3b8"

SCREENER_DATA_PATH = "/Users/amitkumar/Desktop/SectorTrackerApp/public/screener_results.json"
PLAYBOOK_OUT_PATH = "/Users/amitkumar/Desktop/SectorTrackerApp/public/ai_playbook.md"

def generate_playbook():
    try:
        with open(SCREENER_DATA_PATH, "r") as f:
            screener_data = json.load(f)
    except Exception as e:
        print(f"[Playbook Generator] Error loading screener data: {e}")
        return False

    # 1. Tally ticker confluence
    ticker_scores = {}
    ticker_reasons = {}

    for category, items in screener_data.items():
        weight = 1
        if "breakout" in category or "cup_handle" in category or "zacks" in category or "medium_base" in category:
            weight = 2  # Give more weight to high-conviction technicals/fundamentals

        for item in items:
            ticker = item["ticker"]
            metric = item["metric"]
            
            if ticker not in ticker_scores:
                ticker_scores[ticker] = 0
                ticker_reasons[ticker] = []
                
            ticker_scores[ticker] += weight
            
            # Make category name readable
            cat_readable = category.replace("_", " ").title()
            ticker_reasons[ticker].append(f"**{cat_readable}**: {metric}")

    if not ticker_scores:
        print("[Playbook Generator] No stocks passed screeners.")
        return False

    # Sort by highest score
    top_tickers = sorted(ticker_scores.items(), key=lambda x: x[1], reverse=True)[:3]

    # Generate Markdown Report
    date_str = datetime.now().strftime("%A, %B %d, %Y")
    
    md_content = f"# 🤖 Quantitative AI Playbook\n\n"
    md_content += f"**Date:** {date_str}\n\n"
    md_content += "Welcome to the Daily AI Playbook. Based on the overnight convergence of technical setups, fundamental momentum, and breakout scanners, here are the top high-probability trade setups for today.\n\n"
    md_content += "---\n\n"

    valid_count = 1
    for ticker, score in top_tickers:
        try:
            t = yf.Ticker(ticker)
            # Fetch 1 year of data for structural analysis (200 SMA needs 200 days)
            hist = t.history(period="1y")
            if hist.empty:
                continue
                
            # Calculate Technical Health Card metrics
            close = hist['Close']
            sma200 = close.rolling(200).mean()
            macd, signal = calculate_macd(close)
            rsi = calculate_rsi(close)
            stage = calculate_stage(close, sma200)
            mom_text, mom_color = calculate_momentum_fade(macd, signal, rsi)
            rsi_val = round(float(rsi.iloc[-1]), 1) if not rsi.empty else 50.0

            # Delegate to Quantitative Trade Council
            plan = TradeCouncil.evaluate(ticker, hist)
            entry_price = float(plan['entry'])
            stop_loss = float(plan['stop_loss'])
            profit_target = float(plan['profit_target'])
            
            reasons_md = "\n*   ".join(ticker_reasons[ticker][:4]) # Top 4 reasons
            
            md_content += f"### {valid_count}. {ticker} - High Confluence Setup\n"
            md_content += f"**Confluence Score:** {score} points\n\n"
            md_content += f"**Quantitative Reasoning:**\n*   {reasons_md}\n\n"
            md_content += f"**Algorithmic Trade Plan:**\n"
            md_content += f"*   **Entry Zone:** ${entry_price} (Current Market Price)\n"
            md_content += f"*   **Stop Loss:** ${stop_loss} (Dynamic trailing support)\n"
            md_content += f"*   **Profit Target:** ${profit_target} (2.5R Risk/Reward)\n\n"
            
            # Insert the Technical Health Card via markdown
            md_content += f"**Technical Health Card:**\n"
            md_content += f"*   **Structural Stage:** {stage}\n"
            md_content += f"*   **Momentum:** {mom_text}\n"
            md_content += f"*   **RSI:** {rsi_val}\n\n"
            
            md_content += "---\n\n"
            valid_count += 1
            
        except Exception as e:
            print(f"[Playbook Generator] Error processing {ticker}: {e}")

    md_content += "> [!IMPORTANT]\n"
    md_content += "> Always adhere to your stop losses. These trade plans are quantitatively generated and assume a 1% portfolio risk per trade.\n"

    # Write out
    with open(PLAYBOOK_OUT_PATH, "w") as f:
        f.write(md_content)

    print(f"[Playbook Generator] Successfully generated daily playbook at {PLAYBOOK_OUT_PATH}")
    return True

if __name__ == "__main__":
    generate_playbook()
