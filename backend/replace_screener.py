with open('/Users/amitkumar/Desktop/SectorTrackerApp/backend/screener_engine.py', 'r') as f:
    content = f.read()

old_block = """        # 9. Quarterly VAL Rejection
        try:
            val_res = evaluate_val_rejection(ticker, df=ticker_df, lookback=63)
            if val_res:
                results["val_rejection"].append({"ticker": ticker, "metric": val_res["message"]})
        except Exception:
            pass"""

new_block = """        # 9. Quarterly VAL Rejection
        try:
            val_res = evaluate_val_rejection(ticker, df=ticker_df, lookback=63)
            if val_res:
                if val_res.get("rolling_message"):
                    results["val_rejection"].append({"ticker": ticker, "metric": val_res["rolling_message"]})
                if val_res.get("fixed_message"):
                    results["val_rejection_fixed"].append({"ticker": ticker, "metric": val_res["fixed_message"]})
        except Exception:
            pass"""

content = content.replace(old_block, new_block)

# We also need to add val_rejection_fixed to the initial results dict!
old_dict = """    results = {
        "relative_strength": [],
        "early_stage_2": [],
        "darvas_about_to": [],
        "darvas_strong": [],
        "breakout_retest": [],
        "base_pullback_ma": [],
        "fresh_52w_high": [],
        "all_time_high": [],
        "hve_volume": [],
        "hve_consolidation": [],
        "post_earning_reaction": [],
        "post_earning_consolidation": [],
        "weekly_cup_handle": [],
        "monthly_cup_handle": [],
        "ipo_avwap": [],
        "bullish_candlestick": [],
        "bearish_candlestick": [],
        "reversal": [],
        "zacks_rank_1": [],
        "pending_breakout": [],
        "qullamaggie_parabolic": [],
        "universal_takeout": [],
        "regression_channel_breakout": [],
        "val_rejection": []
    }"""

new_dict = """    results = {
        "relative_strength": [],
        "early_stage_2": [],
        "darvas_about_to": [],
        "darvas_strong": [],
        "breakout_retest": [],
        "base_pullback_ma": [],
        "fresh_52w_high": [],
        "all_time_high": [],
        "hve_volume": [],
        "hve_consolidation": [],
        "post_earning_reaction": [],
        "post_earning_consolidation": [],
        "weekly_cup_handle": [],
        "monthly_cup_handle": [],
        "ipo_avwap": [],
        "bullish_candlestick": [],
        "bearish_candlestick": [],
        "reversal": [],
        "zacks_rank_1": [],
        "pending_breakout": [],
        "qullamaggie_parabolic": [],
        "universal_takeout": [],
        "regression_channel_breakout": [],
        "val_rejection": [],
        "val_rejection_fixed": []
    }"""

content = content.replace(old_dict, new_dict)

with open('/Users/amitkumar/Desktop/SectorTrackerApp/backend/screener_engine.py', 'w') as f:
    f.write(content)
