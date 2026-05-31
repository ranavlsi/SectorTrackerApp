import sqlite3
import threading

class PersistentAlertCache:
    def __init__(self, db_path='alerts_persistence.db'):
        self.db_path = db_path
        self.lock = threading.Lock()
        self._init_db()

    def _init_db(self):
        with self.lock:
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            c.execute('CREATE TABLE IF NOT EXISTS sse_alerts (cache_key TEXT PRIMARY KEY)')
            c.execute('CREATE TABLE IF NOT EXISTS microcap_alerts (cache_key TEXT PRIMARY KEY, timestamp REAL)')
            conn.commit()
            conn.close()

    def has_sse_alert(self, key):
        with self.lock:
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            c.execute("SELECT 1 FROM sse_alerts WHERE cache_key = ?", (key,))
            res = c.fetchone()
            conn.close()
            return res is not None

    def add_sse_alert(self, key):
        with self.lock:
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            c.execute("INSERT OR IGNORE INTO sse_alerts (cache_key) VALUES (?)", (key,))
            conn.commit()
            conn.close()

    def get_microcap_time(self, key):
        with self.lock:
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            c.execute("SELECT timestamp FROM microcap_alerts WHERE cache_key = ?", (key,))
            res = c.fetchone()
            conn.close()
            return res[0] if res else 0

    def set_microcap_time(self, key, timestamp):
        with self.lock:
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            c.execute("INSERT OR REPLACE INTO microcap_alerts (cache_key, timestamp) VALUES (?, ?)", (key, timestamp))
            conn.commit()
            conn.close()
