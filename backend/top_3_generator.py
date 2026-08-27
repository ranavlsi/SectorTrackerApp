import os
import glob
import re
import json
from collections import defaultdict
from datetime import datetime
import sys
import yfinance as yf

# Need to import TradeCouncil
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from trade_council import TradeCouncil

DESKTOP_DIR = "/Users/amitkumar/Desktop"
PUBLIC_DIR = "/Users/amitkumar/Desktop/SectorTrackerApp/public"
OUTPUT_FILE = os.path.join(DESKTOP_DIR, "Top_3_Trade_Plans.md")

def extract_tickers_from_file(filepath):
    tickers = set()
    try:
        if filepath.endswith('.json'):
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                # Simple regex for JSON to catch "ticker": "AAPL"
                matches = re.findall(r'"ticker"\s*:\s*"([A-Z]+)"', content, re.IGNORECASE)
                for m in matches: tickers.add(m.upper())
                
                # If no direct ticker key matches, fallback to sweeping
                if not matches:
                    matches = re.findall(r'\b([A-Z]{2,5})\b', content)
                    for m in matches: tickers.add(m)
        else:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                matches = re.findall(r'\b([A-Z]{2,5})\b', content)
                for m in matches: tickers.add(m)
    except Exception as e:
        print(f"Failed to read {filepath}: {e}")
        
    # Clean false positives
    stop_words = {'DATE', 'TIME', 'OPEN', 'HIGH', 'LOW', 'CLOSE', 'VOL', 'VOLUME', 'TICKER', 'PRICE', 'SCORE', 'THE', 'AND', 'FOR', 'TRUE', 'FALSE', 'NULL', 'ATH', 'SMA', 'EMA', 'MACD', 'RSI'}
    return {t for t in tickers if t not in stop_words}

def generate_top_3():
    confluence = defaultdict(int)
    file_hits = defaultdict(list)
    
    # 1. Sweep Desktop for .md and .csv
    desktop_files = glob.glob(os.path.join(DESKTOP_DIR, "*.md")) + glob.glob(os.path.join(DESKTOP_DIR, "*.csv"))
    
    # 2. Sweep Public for .json results
    public_files = glob.glob(os.path.join(PUBLIC_DIR, "*results.json")) + glob.glob(os.path.join(PUBLIC_DIR, "*flow.json"))
    
    all_files = desktop_files + public_files
    
    print(f"Scanning {len(all_files)} files for confluence...")
    
    import time
    current_time = time.time()
    
    for filepath in all_files:
        filename = os.path.basename(filepath)
        # Skip output files
        if "Top_3_Trade_Plans" in filename or "playbook" in filename.lower():
            continue
            
        # Skip files older than 24 hours (86400 seconds)
        if current_time - os.path.getmtime(filepath) > 86400:
            print(f"Skipping stale file: {filename}")
            continue
            
        tickers = extract_tickers_from_file(filepath)
        for t in tickers:
            confluence[t] += 1
            file_hits[t].append(filename)
            
    if not confluence:
        print("No tickers found across any scanner files.")
        return
            
    # Remove extremely common ETF indices
    for w in ['SPY', 'QQQ', 'IWM', 'DIA']:
        confluence.pop(w, None)
            
    # Sort by highest confluence score
    top_tickers = sorted(confluence.items(), key=lambda x: x[1], reverse=True)[:3]
    
    date_str = datetime.now().strftime("%B %d, %Y")
    
    md_content = f"# 🏆 Master Analyst: Top 3 Trade Plans\n"
    md_content += f"**Date:** {date_str}\n\n"
    md_content += "By cross-referencing all Desktop scan results and backend algorithmic output, here are the absolute best 3 setups for today based on extreme multi-scanner confluence:\n\n"
    md_content += "---\n\n"
    
    for i, (ticker, score) in enumerate(top_tickers, 1):
        try:
            print(f"Evaluating Trade Plan for {ticker}...")
            t = yf.Ticker(ticker)
            hist = t.history(period="3mo", interval="1d")
            
            if len(hist) < 5:
                continue
                
            plan = TradeCouncil.evaluate(ticker, hist)
            
            reasons = ", ".join(set(file_hits[ticker][:4])) # Show top files it appeared in
            
            md_content += f"### {i}. {ticker}\n"
            md_content += f"* **Confluence Score:** {score} (Found in: {reasons})\n"
            risk_pct = ((plan['entry'] - plan['stop_loss']) / plan['entry']) * 100
            md_content += f"**🎯 Algorithmic Trade Plan:**\n"
            md_content += f"- Ideal Entry: ${plan['entry']:.2f}\n"
            md_content += f"- Target (3 ATR): ${plan['profit_target']:.2f}\n"
            md_content += f"- Stop Loss (1.5 ATR): ${plan['stop_loss']:.2f}\n"
            md_content += f"- Risk %: {risk_pct:.1f}%\n\n"
            
            # --- NEW DATA AGGREGATION ---
            
            # 1. Fundamentals
            info = t.info
            f_pe = info.get('trailingPE', 'N/A')
            f_marg = info.get('profitMargins', 0)
            f_marg_str = f"{(f_marg * 100):.1f}%" if f_marg else 'N/A'
            f_rev = info.get('revenueGrowth', 0)
            f_rev_str = f"{(f_rev * 100):.1f}%" if f_rev else 'N/A'
            
            md_content += f"**📊 Fundamentals:**\n"
            md_content += f"- Trailing P/E: {f_pe}\n"
            md_content += f"- Net Profit Margin: {f_marg_str}\n"
            md_content += f"- YoY Revenue Growth: {f_rev_str}\n\n"
            
            # 2. Options Max Pain (Nearest Expiration)
            try:
                opts = t.options
                if opts:
                    chain = t.option_chain(opts[0])
                    calls, puts = chain.calls, chain.puts
                    
                    def calc_pain(strike):
                        call_loss = sum(calls[calls['strike'] < strike]['openInterest'].fillna(0) * (strike - calls[calls['strike'] < strike]['strike']))
                        put_loss = sum(puts[puts['strike'] > strike]['openInterest'].fillna(0) * (puts[puts['strike'] > strike]['strike'] - strike))
                        return call_loss + put_loss

                    strikes = sorted(list(set(calls['strike']).union(set(puts['strike']))))
                    max_pain = min(strikes, key=calc_pain)
                    put_vol = puts['volume'].sum()
                    call_vol = calls['volume'].sum()
                    pc_ratio = (put_vol / call_vol) if call_vol > 0 else 0
                    
                    md_content += f"**🔥 Options Flow (Exp: {opts[0]}):**\n"
                    md_content += f"- Max Pain: ${max_pain}\n"
                    md_content += f"- Put/Call Ratio: {pc_ratio:.2f}\n\n"
            except Exception as e:
                pass
                
            # 3. Social Sentiment / Recent News
            md_content += f"**📰 Social Sentiment & Catalysts:**\n"
            try:
                news = t.news[:3]
                if news:
                    for n in news:
                        title = n.get('content', {}).get('title', 'Headline')
                        prov = n.get('content', {}).get('provider', {}).get('displayName', 'News')
                        md_content += f"- {title} ({prov})\n"
                else:
                    md_content += "- No major recent news catalysts found.\n"
            except:
                md_content += "- No major recent news catalysts found.\n"
            
            md_content += "\n"
        except Exception as e:
            print(f"Error building plan for {ticker}: {e}")
            
    md_content += "---\n*Generated automatically before market open.*\n"
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(md_content)
        
    playbook_file = os.path.join(PUBLIC_DIR, "ai_playbook.md")
    with open(playbook_file, 'w', encoding='utf-8') as f:
        f.write(md_content)
        
    print(f"Saved Top 3 to {OUTPUT_FILE} and {playbook_file}")
    
    # Broadcast to Telegram
    try:
        sys.path.append(os.path.join(DESKTOP_DIR, "SectorTrackerApp"))
        import send_telegram_report
        send_telegram_report.send_telegram_alert(md_content)
    except Exception as e:
        print(f"Failed to send telegram alert: {e}")

if __name__ == "__main__":
    generate_top_3()
