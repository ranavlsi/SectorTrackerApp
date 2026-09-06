        # 8. Regression Channel Breakout
        try:
            reg_res = evaluate_regression_channel(ticker, df=ticker_df, lookback=120)
            if reg_res:
                results["regression_channel_breakout"].append({"ticker": ticker, "metric": reg_res["message"]})
        except Exception:
            pass
            
        # 9. Quarterly VAL Rejection
        try:
            val_res = evaluate_val_rejection(ticker, df=ticker_df, lookback=63)
            if val_res:
                results["val_rejection"].append({"ticker": ticker, "metric": val_res["message"]})
        except Exception:
            pass
