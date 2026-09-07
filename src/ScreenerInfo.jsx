import React from 'react';

export const ScreenerDescriptions = {
  relative_strength: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture:</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li>Calculates the trailing momentum of the stock against the benchmark (SPY).</li>
        <li>Filters out strictly for stocks possessing an RS Rating &gt; 90 (Top 10% of the entire market).</li>
        <li>Ensures the stock is trading above its 50-day and 200-day Simple Moving Averages.</li>
      </ul>
    </div>
  ),
  early_stage_2: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture (Stan Weinstein's Logic):</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li><strong>Trend:</strong> 200-day SMA has stopped falling and has turned upwards for at least 21 days.</li>
        <li><strong>Price:</strong> Current Close &gt; 50-day SMA &gt; 200-day SMA.</li>
        <li><strong>Volume:</strong> The breakout from the Stage 1 base is accompanied by significant volume expansion (RVOL &gt; 1.5x).</li>
      </ul>
    </div>
  ),
  darvas_about_to: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture (Nicolas Darvas Logic):</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li><strong>Box Top:</strong> Identifies a new 52-week high that hasn't been breached for at least 3 days.</li>
        <li><strong>Box Bottom:</strong> Identifies the lowest pullback point within the next 3 days.</li>
        <li><strong>Trigger:</strong> Price is currently compressed within <strong>3%</strong> of the Box Top, preparing to breach.</li>
      </ul>
    </div>
  ),
  darvas_strong: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture:</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li>Uses the same Darvas Box construction logic.</li>
        <li><strong>Trigger:</strong> The previous day's close successfully breached the Box Top with surging volume.</li>
      </ul>
    </div>
  ),
  breakout_retest: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture:</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li><strong>The Breakout:</strong> Stock recently broke out of a pivot on high volume (Volume &gt; 1.5x 50-day average).</li>
        <li><strong>The Pullback:</strong> Price pulls back to the exact breakout pivot level.</li>
        <li><strong>Dry-Up:</strong> The pullback occurs on volume strictly lower than the 50-day average.</li>
        <li><strong>Candle:</strong> The stock prints a bottom-wick rejection candle exactly at the pivot.</li>
      </ul>
    </div>
  ),
  base_pullback_ma: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture:</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li>Stock breaks out but "squats" (fails and falls back into the base).</li>
        <li><strong>Support:</strong> The absolute low of the day exactly tags the 10-day or 20-day Simple Moving Average (within 1% variance).</li>
        <li><strong>Rejection:</strong> The daily close recovers to close above the moving average.</li>
      </ul>
    </div>
  ),
  fresh_52w_high: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture:</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li>Scans 252 days of historical data.</li>
        <li><strong>Trigger:</strong> Today's high is the highest price the stock has traded at in the last year.</li>
        <li>Filters out low-liquidity stocks (Volume &lt; 200,000).</li>
      </ul>
    </div>
  ),
  all_time_high: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture:</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li>Scans the entire available historical lifecycle of the stock.</li>
        <li><strong>Trigger:</strong> Today's close is literally the highest close in the history of the company (Blue Sky Breakout).</li>
      </ul>
    </div>
  ),
  hve_volume: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture:</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li><strong>Climax:</strong> Today's volume exceeds the maximum volume seen over the last 21, 63, 126, or 252 trading days.</li>
        <li><strong>Context:</strong> A massive institutional footprint representing deep accumulation or distribution.</li>
      </ul>
    </div>
  ),
  hve_consolidation: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture:</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li>Finds an HVE (High Volume Event) that occurred within the last 15 days.</li>
        <li><strong>Tightness:</strong> The price has consolidated in an extremely tight range (ADR &lt; 3%) since the HVE.</li>
        <li><strong>Signal:</strong> The massive supply from the HVE has been fully absorbed by institutions without breaking price support.</li>
      </ul>
    </div>
  ),
  post_earning_reaction: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture:</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li><strong>PEG Logic:</strong> Stock gaps up &gt; 5% at the open.</li>
        <li><strong>Volume:</strong> Opening volume is &gt; 3x the normal daily average.</li>
        <li><strong>Strength:</strong> The stock closes in the top 25% of its daily range (not a gap-and-crap).</li>
      </ul>
    </div>
  ),
  post_earning_consolidation: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture:</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li>A Power Earnings Gap occurred within the last 3 weeks.</li>
        <li><strong>Structure:</strong> The stock is forming a high-and-tight flag perfectly above the gap window.</li>
        <li><strong>Drawdown:</strong> Maximum pullback from the post-earnings high is &lt; 8%.</li>
      </ul>
    </div>
  ),
  weekly_cup_handle: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture:</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li><strong>Left Side:</strong> Evaluates a 3-to-6 month U-shaped depth. Drawdown max 35%.</li>
        <li><strong>Handle:</strong> Forms in the upper half of the cup. Drifts downward on decreasing volume (Volume &lt; 50-day average).</li>
        <li><strong>Breakout:</strong> Price is crossing the handle pivot on &gt; 40% volume expansion.</li>
      </ul>
    </div>
  ),
  monthly_cup_handle: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture:</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li><strong>Left Side:</strong> Massive 1-to-3 year saucer structure. Drawdown max 50%.</li>
        <li>Requires a minimum of 6 weeks of tight weekly closes on the right side of the base.</li>
        <li>Designed for macro secular trend transitions.</li>
      </ul>
    </div>
  ),
  ipo_avwap: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture:</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li><strong>AVWAP:</strong> Anchors a Volume Weighted Average Price strictly to the very first day the IPO traded.</li>
        <li><strong>Trigger:</strong> Price pulls back and touches the AVWAP line, then prints a reversal candle off it.</li>
      </ul>
    </div>
  ),
  bullish_candlestick: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture:</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li><strong>Engulfing:</strong> Today's body completely engulfs yesterday's body.</li>
        <li><strong>Hammer:</strong> Lower wick is &gt; 2x the size of the real body, upper wick is practically non-existent.</li>
        <li>Occurs while the stock is in an oversold state (RSI &lt; 40) or at a 50-SMA support level.</li>
      </ul>
    </div>
  ),
  bearish_candlestick: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture:</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li><strong>Shooting Star / Engulfing:</strong> Upper wick is &gt; 2x the real body.</li>
        <li>Triggered only when the stock is deeply overbought (RSI &gt; 70) and severely extended from its 20-day SMA.</li>
      </ul>
    </div>
  ),
  reversal: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture:</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li><strong>Math:</strong> 14-day RSI drops below 30 (extreme oversold).</li>
        <li><strong>Trigger:</strong> Stock prints a bullish engulfing or massive hammer candle, indicating violent short-covering.</li>
      </ul>
    </div>
  ),
  zacks_rank_1: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture (Fundamental Check):</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li><strong>Valuation:</strong> PEG Ratio (Price/Earnings-to-Growth) is strictly &lt; 2.0.</li>
        <li><strong>Growth:</strong> Revenue Growth is positive (&gt; 5%).</li>
        <li><strong>Analyst Ratings:</strong> Strong consensus "Buy" recommendation via YahooQuery.</li>
      </ul>
    </div>
  ),
  pending_breakout: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture (VCP Contraction):</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li><strong>Volatility Contraction:</strong> Price range from high to low is &lt; 3% for the last 3 consecutive days.</li>
        <li><strong>Volume Dry-Up:</strong> Volume is strictly &lt; 50% of the 50-day moving average.</li>
        <li><strong>Coiled:</strong> Price is resting on the 10-day EMA, anticipating an explosive move.</li>
      </ul>
    </div>
  ),
  long_base_breakout: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture:</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li><strong>Structure:</strong> Multi-year accumulation base &gt; 1 to 3 years (252 to 750 trading days) with max drawdown &le; 45%.</li>
        <li><strong>Trend:</strong> Price trading strictly above the 200-day SMA with long-term upward trend alignment.</li>
        <li><strong>Coiling (VCP):</strong> Short-term volatility and volume contract near the multi-year pivot roof (within 10%).</li>
        <li><strong>Breakout:</strong> Confirmed upon crossing the 3-year resistance pivot with institutional volume conviction (&ge; 1.2x ADV).</li>
      </ul>
    </div>
  ),
  medium_base_breakout: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture:</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li><strong>Depth:</strong> Base drawdown is mathematically capped at 30% (if &lt; 6 months long) or 40% (if &gt; 6 months long).</li>
        <li><strong>VCP:</strong> The right side of the base must contract to &lt; 40% of the entire base's depth.</li>
        <li><strong>Pocket Pivot:</strong> Volume today is higher than the volume of any down-day in the last 10 days.</li>
      </ul>
    </div>
  ),
  low_volume_breakout: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture:</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li><strong>Depth:</strong> Identical structural depth constraints as the Medium Base Breakout.</li>
        <li><strong>VCP Tightness:</strong> Identical structural VCP contraction rules.</li>
        <li><strong>Volume Filter:</strong> Relaxed requirement. Volume only needs to be &gt; 1.0x (100%) of the 50-day average. Captures stealthy breakouts that lack violent pocket pivots.</li>
      </ul>
    </div>
  ),
  qullamaggie_setup: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture (Kristjan Qullamaggie Logic):</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li><strong>Momentum Requirement:</strong> Stock rallied &gt; 30% within a 1-to-3 month period. Average Daily Range (ADR) &gt; 4%.</li>
        <li><strong>Consolidation:</strong> Pulled back sideways for 10 to 30 days, creating a tight flag.</li>
        <li><strong>Trigger:</strong> Moving averages (10-day and 20-day) caught up to price, acting as a springboard.</li>
      </ul>
    </div>
  ),
  rs_divergence: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture:</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li><strong>Math:</strong> Tracks the `Ticker Close / SPY Close` ratio.</li>
        <li><strong>Divergence:</strong> The RS line makes a fresh 52-week high, but the stock price is still inside its base (not at a high).</li>
        <li><strong>Edge:</strong> Signals hidden institutional accumulation before price breaks out.</li>
      </ul>
    </div>
  ),
  bull_flag_breakout: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture:</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li><strong>The Pole:</strong> A rapid, powerful surge of at least <strong>15%</strong> over a short 15-day window.</li>
        <li><strong>The Flag:</strong> A tight sideways/downward drift lasting 3 to 10 days, with a strict maximum drawdown of <strong>12%</strong>.</li>
        <li><strong>The Trigger:</strong> Today's closing price breaches the highest limit of the flag structure on <strong>1.5x</strong> average volume.</li>
      </ul>
    </div>
  ),
  bull_flag_pending: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong>Algorithm Architecture:</strong>
      <ul style={{ margin: 0, paddingLeft: '20px' }}>
        <li><strong>Structure:</strong> Mathematically identical to the Bull Flag Breakout (15% pole, &lt; 12% tight flag).</li>
        <li><strong>Status:</strong> The stock is currently coiled perfectly inside the flag limits and has not yet breached the top. Waiting for the volume catalyst.</li>
      </ul>
    </div>
  )
};
