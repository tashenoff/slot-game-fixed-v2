import json
import random

config = {
    "symbols": {
        "A": {"weight": 1, "payout": {"3": 5, "4": 10, "5": 20}},
        "B": {"weight": 2, "payout": {"3": 4, "4": 8, "5": 15}},
        "C": {"weight": 3, "payout": {"3": 3, "4": 6, "5": 10}},
        "D": {"weight": 4, "payout": {"3": 2, "4": 4, "5": 8}},
        "E": {"weight": 5, "payout": {"3": 1, "4": 2, "5": 5}},
        "F": {"weight": 5, "payout": {"3": 1, "4": 2, "5": 5}}
    },
    "paylines": [
        [{"row": 1, "col": 0}, {"row": 1, "col": 1}, {"row": 1, "col": 2}, {"row": 1, "col": 3}, {"row": 1, "col": 4}],
        [{"row": 0, "col": 0}, {"row": 0, "col": 1}, {"row": 0, "col": 2}, {"row": 0, "col": 3}, {"row": 0, "col": 4}],
        [{"row": 2, "col": 0}, {"row": 2, "col": 1}, {"row": 2, "col": 2}, {"row": 2, "col": 3}, {"row": 2, "col": 4}],
        [{"row": 0, "col": 0}, {"row": 1, "col": 1}, {"row": 2, "col": 2}, {"row": 1, "col": 3}, {"row": 0, "col": 4}],
        [{"row": 2, "col": 0}, {"row": 1, "col": 1}, {"row": 0, "col": 2}, {"row": 1, "col": 3}, {"row": 2, "col": 4}]
    ]
}

def generate_random_symbol():
    symbols = config["symbols"]
    weights = [symbols[s]["weight"] for s in symbols]
    total_weight = sum(weights)
    probabilities = [w / total_weight for w in weights]
    return random.choices(list(symbols.keys()), probabilities)[0]

def generate_spin_result():
    result = []
    for row in range(3):
        result_row = []
        for col in range(5):
            result_row.append(generate_random_symbol())
        result.append(result_row)
    return result

def check_winlines(matrix):
    wins = []
    total_win = 0
    
    for line_idx, line in enumerate(config["paylines"]):
        symbols_on_line = [matrix[pos["row"]][pos["col"]] for pos in line]
        first_symbol = symbols_on_line[0]
        match_count = 1
        
        for i in range(1, len(symbols_on_line)):
            if symbols_on_line[i] == first_symbol:
                match_count += 1
            else:
                break
        
        if match_count >= 3:
            symbol_config = config["symbols"][first_symbol]
            payout = symbol_config["payout"].get(str(match_count), 0)
            total_win += payout
            wins.append({
                "line_index": line_idx,
                "symbol": first_symbol,
                "count": match_count,
                "payout": payout,
                "positions": line[:match_count]
            })
    
    return {"wins": wins, "total_win": total_win}

def handler(request):
    # CORS preflight
    if request.method == 'OPTIONS':
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            },
            "body": ""
        }
    
    try:
        body = request.body
        data = json.loads(body) if body else {}
    except:
        data = {}
    
    bet = data.get('bet', 1)
    balance = data.get('balance', 1000)
    
    if balance < bet:
        return {
            "statusCode": 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({"error": "Недостаточно средств"})
        }
    
    balance -= bet
    matrix = generate_spin_result()
    win_result = check_winlines(matrix)
    win_amount = win_result["total_win"] * bet
    balance += win_amount
    
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps({
            "matrix": matrix,
            "wins": win_result["wins"],
            "win_amount": win_amount,
            "balance": balance
        })
    }
