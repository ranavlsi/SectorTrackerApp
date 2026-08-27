import json
import random

def get_macro_outlook(ticker):
    """
    Mocks a 3-year Sector Macro Outlook synthesis from an LLM.
    In a real environment, this would call OpenAI/Anthropic with FRED data + news.
    """
    
    import yfinance as yf
    
    try:
        yf_ticker = yf.Ticker(ticker.upper())
        info = yf_ticker.info
        sector = info.get("sector", "General Equities")
        industry = info.get("industry", "Diversified")
        long_name = info.get("longName", ticker.upper())
    except:
        sector = "General Equities"
        industry = "Diversified"
        long_name = ticker.upper()
    
    # Generate dynamic tailored content
    if sector == "Technology":
        tailwinds = f"1. **AI & Cloud Migration:** Accelerating enterprise adoption of AI tools acts as a massive secular tailwind for {industry}.\n2. **Margin Expansion:** Subscription and SaaS models in {industry} continue to provide high-margin recurring revenue."
        headwinds = f"1. **Valuation Multiples:** {sector} multiples remain stretched, leaving little room for earnings misses.\n2. **Regulatory Risk:** Increased antitrust scrutiny over large tech platforms."
        conclusion = f"The {industry} space remains a structural winner. We favor companies with dominant ecosystem moats and strong free cash flow generation over unprofitable growth names."
    elif sector == "Healthcare":
        tailwinds = f"1. **Demographic Shifts:** Aging populations provide an unstoppable secular demand trend for {industry}.\n2. **Innovation Cycle:** Breakthroughs in GLP-1s and genomics are creating new billion-dollar end markets."
        headwinds = f"1. **Regulatory Pressure:** Ongoing political debates regarding drug pricing and Medicare negotiations.\n2. **Patent Cliffs:** Several major {industry} players face looming loss of exclusivity."
        conclusion = f"{industry} offers a defensive posture with embedded growth. Focus on pipelines with late-stage assets and companies with diversified revenue bases."
    elif sector == "Financial Services":
        tailwinds = f"1. **Net Interest Margins:** 'Higher for longer' interest rates support sustained NIMs for traditional banking.\n2. **Capital Markets Recovery:** A rebound in M&A and IPO activity provides a catalyst for {industry}."
        headwinds = f"1. **Credit Risk:** Rising delinquencies in commercial real estate (CRE) and consumer credit cards.\n2. **Deposit Flight:** Fierce competition for yield continues to pressure deposit bases."
        conclusion = f"The {sector} sector requires a focus on balance sheet quality. We prefer {industry} firms with fortress balance sheets and diversified non-interest income."
    else:
        tailwinds = f"1. **Supply Chain Normalization:** Input costs have stabilized, allowing {industry} to rebuild structural margins.\n2. **Consumer Resilience:** Demand within {sector} remains remarkably stable despite macroeconomic uncertainties."
        headwinds = f"1. **Wage Inflation:** Sticky labor costs continue to compress operating leverage for {industry}.\n2. **Rate Sensitivity:** Elevated borrowing costs limit aggressive capital expenditure and M&A."
        conclusion = f"The {sector} sector is navigating a mid-cycle transition. Within {industry}, we favor high-quality, cash-flow generative leaders with strong pricing power."

    content = f"""## 3-Year Macro Outlook: {sector} ({industry})

**Current Macro Climate:** 
The broader macroeconomic environment for **{long_name}** remains defined by stabilizing interest rates and steady GDP growth. Inflation has largely cooled, removing the immediate threat of aggressive tightening. This provides a supportive backdrop for {industry} going forward.

### Key Sector Tailwinds 🚀
{tailwinds}

### Key Sector Risks & Headwinds ⚠️
{headwinds}

### Strategic Conclusion
{conclusion}
"""

    return {
        "ticker": ticker,
        "sector": sector,
        "industry": industry,
        "outlook": content
    }

if __name__ == "__main__":
    import sys
    ticker = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
    print(json.dumps(get_macro_outlook(ticker), indent=2))
