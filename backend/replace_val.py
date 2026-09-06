with open('/Users/amitkumar/Desktop/SectorTrackerApp/backend/volume_profile_scanner.py', 'r') as f:
    content = f.read()

old_block = """        # --- 2. Fixed Quarter (Since start of current calendar quarter) ---
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
                        msg_fixed = f"Bouncing +{dist_f:.1f}% off ${val_fixed:.2f} (Q{quarter})\"""

new_block = """        # --- 2. Fixed Quarter (Since start of current calendar quarter) ---
        date_series = df.index if (df.index.name == 'Date' or isinstance(df.index, pd.DatetimeIndex)) else df.get('Date')
        
        if date_series is not None and len(date_series) > 0:
            last_date = pd.to_datetime(date_series[-1])
            quarter = (last_date.month - 1) // 3 + 1
            start_month = 3 * quarter - 2
            start_of_quarter = pd.Timestamp(year=last_date.year, month=start_month, day=1)
            
            fixed_df = df[pd.to_datetime(date_series) >= start_of_quarter].copy()
            if len(fixed_df) >= 15: # Only run if we are at least 15 days into the quarter
                vp_fixed = calculate_volume_profile(fixed_df, bins=100, va_pct=0.70)
                if vp_fixed:
                    val_fixed = vp_fixed['val']
                    last_3_fixed = fixed_df.iloc[-3:]
                    touched_val_fixed = any(last_3_fixed['Low'] <= (val_fixed * 1.005))
                    bouncing_fixed = curr_close > (val_fixed * 1.015) and curr_close < (val_fixed * 1.08)
                    
                    if touched_val_fixed and bouncing_fixed:
                        dist_f = ((curr_close - val_fixed) / val_fixed) * 100
                        msg_fixed = f"Bouncing +{dist_f:.1f}% off ${val_fixed:.2f} (Q{quarter})\"""

content = content.replace(old_block, new_block)

with open('/Users/amitkumar/Desktop/SectorTrackerApp/backend/volume_profile_scanner.py', 'w') as f:
    f.write(content)
