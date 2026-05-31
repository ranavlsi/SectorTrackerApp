import sys
try:
    from yahooquery import Ticker
    t = Ticker('AAPL')
    df = t.history(period='1mo')
    print("yahooquery success:", len(df))
except Exception as e:
    print("yahooquery failed:", e)

try:
    import urllib.request
    import json
    url = 'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=1mo&interval=1d'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    res = urllib.request.urlopen(req)
    data = json.loads(res.read())
    print("Direct YF API success:", len(data['chart']['result'][0]['timestamp']))
except Exception as e:
    print("Direct YF API failed:", e)
