from flask import Flask, request, jsonify
import re
import random

app = Flask(__name__)

@app.route('/api/chat', methods=['POST'])
def chat_endpoint():
    data = request.json
    prompt = data.get('prompt', '').lower()
    ticker = data.get('ticker', 'UNKNOWN')
    persona = data.get('persona', 'Master Analyst')
    context = data.get('context', {})
    
    # 1. Check for specific greetings or general questions
    if prompt in ['hi', 'hello', 'hey', 'help']:
        return jsonify({"response": f"Hello! I am your **{persona}**. I can analyze technicals, fundamentals, or market conditions. Ask me about a specific ticker, or ask me for a general market breakdown!"})
        
    # 2. Extract ticker from prompt if the user typed something like "what about AAPL?"
    words = prompt.upper().replace('?', '').replace(',', '').split()
    target_ticker = ticker
    for word in words:
        if word.isalpha() and 1 <= len(word) <= 5 and word.isupper():
            # Weak heuristic for a ticker symbol, but let's assume if it's all caps it might be a ticker
            pass # Keep it simple for now, use the context ticker if available
            
    # 3. Generate response based on Persona and Context
    response_text = ""
    
    if ticker != 'UNKNOWN' and isinstance(context, dict) and 'stage' in context:
        stage = context.get('stage', 'Unknown')
        perf = context.get('perf', 0)
        rs = context.get('rs_spy_1mo', 0)
        mom = context.get('momentum_text', 'Neutral')
        
        if "master analyst" in persona.lower():
            response_text = f"**{ticker} Analysis:**\\nStructurally, {ticker} is currently in **{stage}**. Over the last month, it has an RS (Relative Strength) of {rs:.2f}% vs the SPY. The current momentum signature is {mom}. "
            if perf > 0:
                response_text += f"Today it is up {perf:.2f}%, showing continued buying pressure."
            else:
                response_text += f"Today it is down {perf:.2f}%, indicating short-term weakness."
                
        elif "risk manager" in persona.lower():
            response_text = f"**{ticker} Risk Assessment:**\\nWith the asset in **{stage}** and momentum showing as '{mom}', you must strictly manage downside risk. A 1% total portfolio risk rule is advised. If the daily trend breaks below the 200 SMA, exit immediately."
            
        elif "options flow" in persona.lower():
            response_text = f"**{ticker} Flow Speculation:**\\nWhile I don't have live options flow data right this second, the structural **{stage}** and {rs:.2f}% RS suggests institutions are positioning directionally. Watch for unusual call sweepers if it breaks the nearest pivot."
            
        else:
            response_text = f"As the **{persona}**, my read on {ticker} is driven by its {stage} structure and {mom} momentum."
            
    else:
        # Generic response if no context is provided
        responses = [
            f"Based on my quantitative models, the market is highly rotational right now. Focus on Leading quadrant sectors.",
            f"As your {persona}, I'm scanning the data... Ensure you stick to your core trade plans and manage risk.",
            f"That's an interesting question. My internal scanner shows we need to wait for structural confluence before taking massive directional bets."
        ]
        response_text = random.choice(responses)
        
        # If they asked about a specific term
        if 'market' in prompt or 'spy' in prompt:
            response_text = "The broader market (SPY) dictates 50% of an asset's movement. Always check the RRG daily quadrant for SPY before trading."

    return jsonify({"response": response_text})

if __name__ == '__main__':
    with app.test_request_context(json={"prompt": "what do you think?", "ticker": "NVDA", "persona": "Master Analyst", "context": {"stage": "Stage 2 (Advancing)", "perf": 2.5, "rs_spy_1mo": 15.2, "momentum_text": "🔥 Momentum Building"}}):
        print(chat_endpoint().json)
