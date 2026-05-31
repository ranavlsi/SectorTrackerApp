from yahooquery import Ticker
import json

t = Ticker(["AAPL", "ORCL", "AAL", "AA"])
data = t.summary_detail
print("Type of data:", type(data))
print("AAPL dict?", isinstance(data.get("AAPL"), dict))
if isinstance(data.get("AAPL"), dict):
    print("AAPL Market Cap:", data["AAPL"].get("marketCap"))
else:
    print("AAPL value:", data.get("AAPL"))
