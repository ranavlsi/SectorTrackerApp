import urllib.request
import urllib.error
import json

url = "https://httpbin.org/status/429"
try:
    req = urllib.request.Request(url)
    urllib.request.urlopen(req)
except urllib.error.HTTPError as e:
    print(f"Error Code: {e.code}")
    body = e.read().decode()
    print(f"Body: {body}")
