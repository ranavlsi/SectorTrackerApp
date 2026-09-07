import re

with open('/Users/amitkumar/Desktop/SectorTrackerApp/backend/screener_engine.py', 'r') as f:
    content = f.read()

# 1. Add import
if "from fvg_sma_scanner import evaluate_fvg_sma_confluence" not in content:
    content = content.replace(
        "from regression_channel_scanner import evaluate_regression_channel",
        "from regression_channel_scanner import evaluate_regression_channel\nfrom fvg_sma_scanner import evaluate_fvg_sma_confluence"
    )

# 2. Add to results dictionary
if '"fvg_sma_confluence": []' not in content:
    content = content.replace(
        '"val_rejection_fixed": [],',
        '"val_rejection_fixed": [],\n        "fvg_sma_confluence": [],'
    )

# 3. Add execution logic
exec_logic = """        # 9.5 FVG + SMA Confluence
        try:
            fvg_res = evaluate_fvg_sma_confluence(ticker, df=ticker_df)
            if fvg_res:
                results["fvg_sma_confluence"].append({"ticker": ticker, "metric": fvg_res["metric"]})
        except Exception:
            pass
            
        # 7.5 Breakout Retest & Squat MA Support"""

if "evaluate_fvg_sma_confluence(ticker, df=ticker_df)" not in content:
    content = content.replace("        # 7.5 Breakout Retest & Squat MA Support", exec_logic)

with open('/Users/amitkumar/Desktop/SectorTrackerApp/backend/screener_engine.py', 'w') as f:
    f.write(content)
