import pandas as pd
import requests
import io
url = 'https://finviz.com/insidertrading.ashx?tc=1'
headers = {'User-Agent': 'Mozilla/5.0'}
res = requests.get(url, headers=headers)
dfs = pd.read_html(io.StringIO(res.text))
df = dfs[4] # The table containing the trades
# Filter for trades >= $1,000,000 to avoid noise
df['ValueNum'] = pd.to_numeric(df['Value ($)'].astype(str).str.replace(',', ''), errors='coerce')
print("Total rows:", len(df))
print("Over 1M:", len(df[df['ValueNum'] >= 1000000]))
print(df.head(2))
