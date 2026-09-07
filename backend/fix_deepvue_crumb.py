with open('/Users/amitkumar/Desktop/SectorTrackerApp/backend/deepvue_screener.py', 'r') as f:
    content = f.read()

old_fund = """            f_data = z_fin.get(ticker, {})
            if isinstance(f_data, dict):
                rev_growth = f_data.get('revenueGrowth', 0)
                eps_growth = f_data.get('earningsGrowth', 0)
                try: rev_growth = float(rev_growth) if rev_growth else 0
                except: rev_growth = 0
                try: eps_growth = float(eps_growth) if eps_growth else 0
                except: eps_growth = 0
                
                has_fundamentals = (rev_growth > 0.15) or (eps_growth > 0.15)
                
                if has_fundamentals:
                    res["rev_growth_pct"] = round(rev_growth * 100, 1)
                    res["eps_growth_pct"] = round(eps_growth * 100, 1)
                    res["has_fundamentals"] = True
                    final_leaders.append(res)"""

new_fund = """            f_data = z_fin.get(ticker, {})
            
            # YahooQuery API often throws 'Invalid Crumb' errors. If it does, we assume it passes fundamentals 
            # to prevent the entire screener from crashing, since it already passed the ultra-strict technicals.
            if isinstance(f_data, dict):
                rev_growth = f_data.get('revenueGrowth', 0)
                eps_growth = f_data.get('earningsGrowth', 0)
                try: rev_growth = float(rev_growth) if rev_growth else 0
                except: rev_growth = 0
                try: eps_growth = float(eps_growth) if eps_growth else 0
                except: eps_growth = 0
                
                has_fundamentals = (rev_growth > 0.15) or (eps_growth > 0.15)
                
                if has_fundamentals:
                    res["rev_growth_pct"] = round(rev_growth * 100, 1)
                    res["eps_growth_pct"] = round(eps_growth * 100, 1)
                    res["has_fundamentals"] = True
                    final_leaders.append(res)
            else:
                # API failed (Invalid Crumb). Let it pass based on pristine technicals alone.
                res["rev_growth_pct"] = 0
                res["eps_growth_pct"] = 0
                res["has_fundamentals"] = False # Flag it so the UI knows
                final_leaders.append(res)"""

content = content.replace(old_fund, new_fund)

with open('/Users/amitkumar/Desktop/SectorTrackerApp/backend/deepvue_screener.py', 'w') as f:
    f.write(content)
