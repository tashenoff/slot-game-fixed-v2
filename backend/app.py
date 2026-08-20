from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import random
import os

app = Flask(__name__)
CORS(app)

# Загрузка конфигурации символов и выигрышных линий
def load_config():
    config_path = os.path.join(os.path.dirname(__file__), 'config.json')
    if not os.path.exists(config_path):
        # Создаем конфигурацию по умолчанию, если файл не существует
        default_config = {
            "symbols": {
                "A": {"weight": 1, "payout": {"3": 5, "4": 10, "5": 20}},
                "B": {"weight": 2, "payout": {"3": 4, "4": 8, "5": 15}},
                "C": {"weight": 3, "payout": {"3": 3, "4": 6, "5": 10}},
                "D": {"weight": 4, "payout": {"3": 2, "4": 4, "5": 8}},
                "E": {"weight": 5, "payout": {"3": 1, "4": 2, "5": 5}},
                "F": {"weight": 5, "payout": {"3": 1, "4": 2, "5": 5}}
            },
            "paylines": [
                # Горизонтальные линии (центр, верх, низ)
                [{"row": 1, "col": 0}, {"row": 1, "col": 1}, {"row": 1, "col": 2}, {"row": 1, "col": 3}, {"row": 1, "col": 4}],
                [{"row": 0, "col": 0}, {"row": 0, "col": 1}, {"row": 0, "col": 2}, {"row": 0, "col": 3}, {"row": 0, "col": 4}],
                [{"row": 2, "col": 0}, {"row": 2, "col": 1}, {"row": 2, "col": 2}, {"row": 2, "col": 3}, {"row": 2, "col": 4}],
                # V-образная линия
                [{"row": 0, "col": 0}, {"row": 1, "col": 1}, {"row": 2, "col": 2}, {"row": 1, "col": 3}, {"row": 0, "col": 4}],
                # Λ-образная линия
                [{"row": 2, "col": 0}, {"row": 1, "col": 1}, {"row": 0, "col": 2}, {"row": 1, "col": 3}, {"row": 2, "col": 4}]
            ],
            "rtp_target": 0.95  # Целевой RTP (Return to Player)
        }
        with open(config_path, 'w') as f:
            json.dump(default_config, f, indent=2)
        return default_config
    
    with open(config_path, 'r') as f:
        return json.load(f)

# Глобальная переменная для хранения конфигурации
config = load_config()

# Глобальная переменная для хранения баланса пользователя
user_balance = 1000

# Генерация случайного символа с учетом весов
def generate_random_symbol():
    symbols = config["symbols"]
    weights = [symbols[s]["weight"] for s in symbols]
    total_weight = sum(weights)
    
    # Нормализация весов для получения вероятностей
    probabilities = [w / total_weight for w in weights]
    
    # Выбор символа на основе вероятностей
    return random.choices(list(symbols.keys()), probabilities)[0]

# Генерация матрицы результатов спина
def generate_spin_result():
    result = []
    for row in range(3):
        result_row = []
        for col in range(5):
            result_row.append(generate_random_symbol())
        result.append(result_row)
    return result

# Проверка выигрышных линий
def check_winlines(matrix):
    wins = []
    total_win = 0
    
    for line_idx, line in enumerate(config["paylines"]):
        # Получаем символы на линии
        symbols_on_line = [matrix[pos["row"]][pos["col"]] for pos in line]
        
        # Проверяем совпадения символов
        first_symbol = symbols_on_line[0]
        match_count = 1
        
        for i in range(1, len(symbols_on_line)):
            if symbols_on_line[i] == first_symbol:
                match_count += 1
            else:
                break
        
        # Проверяем, есть ли выигрыш
        if match_count >= 3:
            payout_table = config["symbols"][first_symbol]["payout"]
            if str(match_count) in payout_table:
                win_amount = payout_table[str(match_count)]
                wins.append({
                    "line": line_idx,
                    "symbol": first_symbol,
                    "count": match_count,
                    "win": win_amount
                })
                total_win += win_amount
    
    return {"wins": wins, "total_win": total_win}

@app.route('/api/spin', methods=['POST'])
def spin():
    global user_balance
    
    # Получаем ставку из запроса
    data = request.get_json()
    bet = data.get('bet', 1)
    
    # Проверяем, достаточно ли баланса
    if user_balance < bet:
        return jsonify({"error": "Недостаточно средств"}), 400
    
    # Списываем ставку
    user_balance -= bet
    
    # Генерируем результат спина
    matrix = generate_spin_result()
    
    # Проверяем выигрыш
    win_result = check_winlines(matrix)
    
    # Умножаем выигрыш на ставку
    win_amount = win_result["total_win"] * bet
    
    # Добавляем выигрыш к балансу
    user_balance += win_amount
    
    return jsonify({
        "matrix": matrix,
        "wins": win_result["wins"],
        "win_amount": win_amount,
        "balance": user_balance
    })

@app.route('/api/balance', methods=['GET'])
def get_balance():
    return jsonify({"balance": user_balance})

@app.route('/api/reset_balance', methods=['POST'])
def reset_balance():
    global user_balance
    user_balance = 1000
    return jsonify({"balance": user_balance})

@app.route('/api/multi_spin', methods=['POST'])
def multi_spin():
    global user_balance
    
    # Получаем ставку из запроса
    data = request.get_json() or {}
    bet = data.get('bet', 1)
    spins = data.get('spins', 1000)
    
    # Ограничиваем количество спинов
    if spins > 1000:
        spins = 1000
    
    # Проверяем, достаточно ли баланса для одного спина
    if user_balance < bet:
        return jsonify({"error": "Недостаточно средств"}), 400
    
    # Статистика
    stats = {
        "total_bet": 0,
        "total_win": 0,
        "spins": 0,
        "symbol_frequency": {s: 0 for s in config["symbols"]},
        "win_frequency": 0,
        "biggest_win": 0,
        "rtp": 0,
        "balance": user_balance
    }
    
    # Выполняем спины
    for _ in range(spins):
        # Проверяем, достаточно ли баланса для текущего спина
        if user_balance < bet:
            break
            
        # Списываем ставку
        user_balance -= bet
        stats["total_bet"] += bet
        stats["spins"] += 1
        
        # Генерируем результат спина
        matrix = generate_spin_result()
        
        # Подсчитываем частоту символов
        for row in matrix:
            for symbol in row:
                stats["symbol_frequency"][symbol] += 1
        
        # Проверяем выигрыш
        win_result = check_winlines(matrix)
        win_amount = win_result["total_win"] * bet
        
        # Обновляем статистику
        stats["total_win"] += win_amount
        if win_amount > 0:
            stats["win_frequency"] += 1
        if win_amount > stats["biggest_win"]:
            stats["biggest_win"] = win_amount
        
        # Добавляем выигрыш к балансу
        user_balance += win_amount
    
    # Обновляем баланс в статистике
    stats["balance"] = user_balance
    
    # Рассчитываем RTP
    stats["rtp"] = stats["total_win"] / stats["total_bet"] if stats["total_bet"] > 0 else 0
    stats["win_frequency"] = stats["win_frequency"] / stats["spins"] if stats["spins"] > 0 else 0
    
    # Нормализуем частоту символов (в процентах)
    total_symbols = sum(stats["symbol_frequency"].values())
    for symbol in stats["symbol_frequency"]:
        stats["symbol_frequency"][symbol] = round(stats["symbol_frequency"][symbol] * 100 / total_symbols, 2) if total_symbols > 0 else 0
    
    return jsonify({
        "stats": stats,
        "balance": user_balance
    })

@app.route('/api/config', methods=['GET'])
def get_config():
    return jsonify(config)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
