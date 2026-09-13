"""
Test script to verify all 5 deep fundamental backend engines run and return valid schemas.
"""
import sys
import os

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from earnings_deconstructor_engine import get_earnings_deconstruction
from moat_catalyst_engine import get_moat_catalyst_analysis
from valuation_engine import get_complete_valuation_package
from forensic_dupont_engine import get_forensic_dupont_analysis
from capital_allocation_engine import calculate_capital_allocation

def run_tests():
    ticker = "AAPL"
    print(f"=== Testing Deep Fundamentals Engines for {ticker} ===")

    # 1. Earnings Deconstructor
    print("1. Testing Earnings Deconstructor...")
    earnings = get_earnings_deconstruction(ticker)
    assert "surprise_streak" in earnings, "Missing surprise_streak"
    assert "historical_quarters" in earnings, "Missing historical_quarters"
    print(f"   -> Streak: {earnings['surprise_streak']['current_beat_streak']} consecutive beats")

    # 2. Moat & Catalyst
    print("2. Testing Moat & Catalyst Engine...")
    moat = get_moat_catalyst_analysis(ticker)
    assert "moat_pillars" in moat, "Missing moat_pillars"
    assert "porter_forces" in moat, "Missing porter_forces"
    print(f"   -> Moat Rating: {moat['moat_pillars']['moat_rating']} ({moat['moat_pillars']['composite_score']}/100)")
    print(f"   -> Catalyst Net Balance: {moat['net_catalyst_balance']:+.2f} ({moat['catalyst_regime']})")

    # 3. Valuation & DCF
    print("3. Testing Dynamic Valuation Engine...")
    val = get_complete_valuation_package(ticker)
    assert "dcf_base_valuation" in val, "Missing dcf_base_valuation"
    assert "reverse_dcf" in val, "Missing reverse_dcf"
    assert "sensitivity_matrix" in val, "Missing sensitivity_matrix"
    print(f"   -> Fair Value: ${val['dcf_base_valuation']['fair_value_per_share']} (Mkt: ${val['current_price']})")
    print(f"   -> Reverse DCF Implied CAGR: {val['reverse_dcf']['implied_revenue_cagr']}% ({val['reverse_dcf']['category']})")

    # 4. Forensic & DuPont
    print("4. Testing Forensic & DuPont Engine...")
    forensic = get_forensic_dupont_analysis(ticker)
    assert "dupont" in forensic, "Missing dupont"
    assert "altman_z" in forensic, "Missing altman_z"
    assert "beneish_m" in forensic, "Missing beneish_m"
    assert "piotroski_f" in forensic, "Missing piotroski_f"
    print(f"   -> DuPont ROE: {forensic['dupont']['roe_pct']}% (Lev: {forensic['dupont']['financial_leverage']}x)")
    print(f"   -> Altman Z: {forensic['altman_z']['score']} ({forensic['altman_z']['zone']})")
    print(f"   -> Piotroski F: {forensic['piotroski_f']['score']}/9 ({forensic['piotroski_f']['rating']})")

    # 5. Capital Allocation & Insider/Whale Flow
    print("5. Testing Capital Allocation & Insider Engine...")
    alloc = calculate_capital_allocation(ticker)
    assert "eva_longitudinal" in alloc, "Missing eva_longitudinal"
    assert "share_cannibal" in alloc, "Missing share_cannibal"
    assert "insider_intelligence" in alloc, "Missing insider_intelligence"
    assert "short_squeeze_vulnerability" in alloc, "Missing short_squeeze_vulnerability"
    print(f"   -> EVA Tier: {alloc['eva_quality_tier']}")
    print(f"   -> Cannibal Rating: {alloc['share_cannibal']['rating']}")
    print(f"   -> Squeeze Score: {alloc['short_squeeze_vulnerability']['score_out_of_100']}/100")

    print("\n[SUCCESS] All 5 deep fundamental engines executed flawlessly!")

if __name__ == "__main__":
    run_tests()
