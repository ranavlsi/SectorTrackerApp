def evaluate_val_rejection(ticker, df=None, lookback=63):
    """
    Identifies stocks that are rejecting (bouncing off) the Quarterly Value Area Low.
    Now evaluates BOTH Rolling Quarter (63 days) and Fixed Quarter (YTD Quarter).
    """
    try:
        if df is None or len(df) < lookback:
            return None
            
        messages = []
        
        # --- 1. Rolling Quarter (63 Days) ---
        recent_df = df.iloc[-lookback:].copy()
        vp_rolling = calculate_volume_profile(recent_df, bins=100, va_pct=0.70)
        
        if vp_rolling:
            val_rolling = vp_rolling['val']
            last_3 = recent_df.iloc[-3:]
            touched_val = any(last_3['Low'] <= (val_rolling * 1.005))
            curr_close = recent_df['Close'].iloc[-1]
            bouncing = curr_close > (val_rolling * 1.015) and curr_close < (val_rolling * 1.08)
            
            if touched_val and bouncing:
                dist = ((curr_close - val_rolling) / val_rolling) * 100
                messages.append(f"(Rolling): Bouncing +{dist:.1f}% off ${val_rolling:.2f}")

        # --- 2. Fixed Quarter (Since start of current calendar quarter) ---
        if 'Date' in df.columns:
            last_date = pd.to_datetime(df['Date'].iloc[-1])
            quarter = (last_date.month - 1) // 3 + 1
            start_month = 3 * quarter - 2
            start_of_quarter = pd.Timestamp(year=last_date.year, month=start_month, day=1)
            
            fixed_df = df[df['Date'] >= start_of_quarter].copy()
            if len(fixed_df) >= 15: # Only run if we are at least 15 days into the quarter
                vp_fixed = calculate_volume_profile(fixed_df, bins=100, va_pct=0.70)
                if vp_fixed:
                    val_fixed = vp_fixed['val']
                    last_3_fixed = fixed_df.iloc[-3:]
                    touched_val_fixed = any(last_3_fixed['Low'] <= (val_fixed * 1.005))
                    bouncing_fixed = curr_close > (val_fixed * 1.015) and curr_close < (val_fixed * 1.08)
                    
                    if touched_val_fixed and bouncing_fixed:
                        dist_f = ((curr_close - val_fixed) / val_fixed) * 100
                        msg = f"(Fixed Q{quarter}): Bouncing +{dist_f:.1f}% off ${val_fixed:.2f}"
                        if msg not in messages:
                            messages.append(msg)

        if messages:
            return {
                "status": "REJECTION",
                "ticker": ticker,
                "message": " | ".join(messages)
            }
            
        return None
        
    except Exception as e:
        return None
