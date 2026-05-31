# AGENTS.md: Autonomous Breakout Scanner Specification

## Multi-Agent Quantitative Architecture for Google Antigravity 2.0

This document establishes the technical blueprint, role definitions, and parameter matrices required to instantiate a multi-agent autonomous stock breakout scanner using the **Google Antigravity 2.0** framework.

---

## 1. System Architecture Overview

The scanner leverages a master-orchestrator pattern running inside Antigravity's native Linux sandbox. It executes an asynchronous analysis loop utilizing three specialized sub-agents to evaluate candidates against mechanical technical parameters.

```text
       ┌────────────────────────┐
       │   Antigravity Master   │
       │  (State Orchestrator)  │
       └───────────┬────────────┘
                   │
  ┌────────────────┼────────────────┐
  ▼                ▼                ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Visual Agent   │ │  Quantitative   │ │ Context & Time  │
│  (Multimodal)   │ │ Agent (Python)  │ │ Agent (Search)  │
├─────────────────┤ ├─────────────────┤ ├─────────────────┤
│ • Chart Geometry│ │ • Volatility    │ │ • Time Windows  │
│ • Candlestick   │ │   Compression   │ │ • Catalyst Check│
│   Patterns      │ │ • Price Levels  │ │ • Liquidity     │
│ • Base Maturity │ │ & Mathematical  │ │   Verification  │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## 2. Core Agent Specifications & Requirements

### A. Visual Agent (Multimodal Vision Engine)
* **Objective:** Interpret raw graphical chart data to assess geometric structural integrity.
* **Inputs:** High-resolution chart images (.png/.jpeg) transmitted via base64 strings or direct storage paths within the sandbox environment.
* **Operational Directives:**
  * **Price Structure Analysis:** Detect clear series of higher lows (HL) leading into a defined horizontal or descending resistance line. Identify market structure shifts (MSS).
  * **Base Evaluation:** Identify recognized structural bases (e.g., Cup & Handle, Flat Base, High Tight Flag, or Volatility Contraction Patterns - VCP). Check for price tightening from left to right.
  * **Volume Candlestick Interpretation:** Scan for institutional presence characterized by wide-range green candles accompanied by expanding volume bars (demand spikes) relative to preceding low-volume consolidation pools.

### B. Quantitative Agent (Sandbox Execution Engine)
* **Objective:** Compute mathematical variables to validate visual observations and execute raw statistical checking.
* **Environment Requirements:** Native Linux sandbox with access to `python3`, `pandas`, `numpy`, `scipy`, and technical analysis libraries.
* **Operational Directives:**
  * **Volatility Compensation Calculation:** Measure contraction using Average True Range (ATR), Bollinger Band Width (BBW), or Keltner Channel squeezing. Ensure a state of low-volatility equilibrium before triggering an expansion breakout prediction.
  * **Price References & Pivots:** Calculate exact coordinates for multi-touch horizontal resistance pivots, volume-weighted average price (VWAP) anchors from key trend swings, and exponential moving average alignment (e.g., 20 EMA > 50 EMA > 200 SMA).
  * **Data Sourcing Pipeline:** Execute API queries to retrieve granular OHLCV structures from verified real-time or historical data brokers.

### C. Context & Time Agent (Environment Synthesizer)
* **Objective:** Confirm external liquidity synchronization and protect against high-risk structural invalidations.
* **Environment Requirements:** Native Antigravity Web Search capability.
* **Operational Directives:**
  * **Intraday Timing Filters:** Map actions strictly against high-alpha liquidity windows (e.g., 09:30–10:30 EST Opening Range Breakdown/Breakout and 15:00–16:00 EST Closing Imbalances).
  * **Catalyst Filtering:** Screen web data for impending Corporate Actions (Earnings releases, FDA approvals, SEC Form 4 filings) or Macroeconomic releases (CPI, FOMC minutes) within a +/- 24-hour window of potential entry to prevent front-running sudden binary risk.

---

## 3. Parameter Evaluation Matrix (Execution Logic)

| Parameter | Quantitative Condition / Threshold Metric | Evaluation Method |
| :--- | :--- | :--- |
| **Volume Candlestick Pattern** | Trigger candle volume must be >= 1.5x to 2.0x the 20-day Simple Moving Average volume. | Code Execution / Math check |
| **Price Structure** | Higher-low matrix verified on daily/hourly intervals. Swing low coordinates must satisfy Ln > Ln-1. | Vision + Math Cross-Check |
| **Day / Time Window** | Timestamp must sit within `[09:30 - 10:30 EST]` or `[15:00 - 16:00 EST]`. Low priority if within midday lull. | System Clock Validation |
| **Price References** | Current Price (Pt) must break clean above Key Pivot (Rpivot) with a clearance buffer of +0.2x ATR. | Code Execution |
| **Base Maturity** | Consolidation length must span >= 15 trading sessions. Volume must systematically dry up during price contractions. | Vision Pattern Recognition |
| **Volatility Compensation** | Bollinger Band Width (BBW) must sit at the bottom 15th percentile of its historical 100-day distribution. | Code Execution (Statistical) |

---

## 4. Operational Code Framework

```python
import numpy as np
import pandas as pd

def calculate_volatility_compensation(df, period=20):
    """
    Computes Bollinger Band Width to mathematically detect volatility compression.
    """
    df['MA'] = df['close'].rolling(window=period).mean()
    df['STD'] = df['close'].rolling(window=period).std()
    df['BB_Upper'] = df['MA'] + (2 * df['STD'])
    df['BB_Lower'] = df['MA'] - (2 * df['STD'])
    df['BB_Width'] = (df['BB_Upper'] - df['BB_Lower']) / df['MA']
    return df

def verify_volume_expansion(df, multi=1.5):
    """
    Validates if the trigger volume candle satisfies institutional demand expansion metrics.
    """
    df['Volume_MA'] = df['volume'].rolling(window=20).mean()
    current_vol = df['volume'].iloc[-1]
    avg_vol = df['Volume_MA'].iloc[-1]
    return current_vol >= (avg_vol * multi)

def evaluate_breakout_profile(historical_data):
    """
    Main evaluation pipeline executed by the Quantitative Agent inside the sandbox.
    """
    df = pd.DataFrame(historical_data)
    df = calculate_volatility_compensation(df)
    vol_valid = verify_volume_expansion(df)
    
    # Filter for historical compression thresholds (bottom 15th percentile)
    vol_comp_threshold = df['BB_Width'].rolling(window=100).quantile(0.15).iloc[-1]
    current_bb_width = df['BB_Width'].iloc[-1]
    
    volatility_compressed = current_bb_width <= vol_comp_threshold
    
    return {
        "volume_expansion_valid": bool(vol_valid),
        "volatility_compressed": bool(volatility_compressed),
        "current_compression_ratio": float(current_bb_width)
    }
```
