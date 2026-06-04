import json
import random

def get_macro_outlook(ticker):
    """
    Mocks a 3-year Sector Macro Outlook synthesis from an LLM.
    In a real environment, this would call OpenAI/Anthropic with FRED data + news.
    """
    
    # Mock some sector mappings
    sector_map = {
        "AAPL": "Consumer Electronics / Tech Hardware",
        "MSFT": "Enterprise Software / Cloud Computing",
        "NVDA": "Semiconductors / AI Infrastructure",
        "TSLA": "Electric Vehicles / Clean Energy",
        "JPM": "Financials / Banking"
    }
    
    sector = sector_map.get(ticker.upper(), "General Equities")
    
    # Mock LLM generated markdown content
    content = f"""## 3-Year Macro Outlook: {sector}

**Current Macro Climate:** 
The broader macroeconomic environment remains defined by stabilizing interest rates around 4.5% - 5.0% and steady GDP growth. Inflation (CPI) has largely cooled to the Fed's 2% target, removing the immediate threat of aggressive tightening. This provides a supportive backdrop for capital expenditures and consumer spending.

### Key Sector Tailwinds 🚀
1. **Supply Chain Normalization:** Input costs have drastically reduced compared to the pandemic peaks, allowing for structural margin expansion.
2. **Technological Integration:** Rapid adoption of AI and automation within {sector} is driving significant productivity gains.
3. **Resilient Consumer Demand:** Despite higher borrowing costs, secular trends in {sector} remain highly inelastic.

### Key Sector Risks & Headwinds ⚠️
1. **Geopolitical Fragmentation:** Ongoing trade tensions and decoupling strategies pose risks to international revenue streams and globalized supply chains.
2. **Regulatory Scrutiny:** Increased antitrust and compliance regulations are expected to increase operational overhead in the next 24 months.
3. **Valuation Compression:** As growth normalizes, multiples may compress if earnings growth fails to outpace the cost of capital.

### Strategic Conclusion
The {sector} sector is entering a mature phase of the business cycle. We expect a **rotation towards high-quality, cash-flow generative leaders** within the sector. Companies with deep moats, pricing power, and low leverage will significantly outperform unprofitable growth peers over the next 36 months.
"""

    return {
        "ticker": ticker,
        "sector": sector,
        "outlook": content
    }

if __name__ == "__main__":
    import sys
    ticker = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
    print(json.dumps(get_macro_outlook(ticker), indent=2))
