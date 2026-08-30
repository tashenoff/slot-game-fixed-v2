from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import random
import os

from database import init_db, get_or_create_user, get_user_by_id, update_user_balance, update_user_stats
from auth import create_token, require_auth

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"], "allow_headers": ["Content-Type", "Authorization"]}})

# Инициализация БД при старте
init_db()

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

# Генерация случайного символа с учетом весов
def generate_random_symbol(col=None, is_free_spin=False):
    symbols = config["symbols"]
    free_spins_weights = config.get("free_spins_weights", {})

    # Во время фриспинов используем улучшенные веса (ценные символы чаще)
    if is_free_spin:
        weights = [free_spins_weights.get(s, symbols[s]["weight"]) for s in symbols]
    else:
        weights = [symbols[s]["weight"] for s in symbols]
    
    # Scatter ("S") может выпасть только на колонках 0, 1, 2 (первые 3 барабана)
    # На колонках 3, 4 исключаем Scatter из пула
    if col is not None and col >= 3:
        symbols_without_scatter = {k: v for k, v in symbols.items() if k != config.get("scatter_symbol", "S")}
        if is_free_spin:
            weights_without = [free_spins_weights.get(s, symbols[s]["weight"]) for s in symbols_without_scatter]
        else:
            weights_without = [symbols_without_scatter[s]["weight"] for s in symbols_without_scatter]
        total_weight = sum(weights_without)
        probabilities = [w / total_weight for w in weights_without]
        return random.choices(list(symbols_without_scatter.keys()), probabilities)[0]
    
    total_weight = sum(weights)
    probabilities = [w / total_weight for w in weights]
    
    return random.choices(list(symbols.keys()), probabilities)[0]

# Генерация матрицы результатов спина
def generate_spin_result(test_mode=False, is_free_spin=False):
    result = []
    for row in range(3):
        result_row = []
        for col in range(5):
            # В тестовом режиме — гарантируем 3 Scatter на барабанах 0,1,2
            if test_mode and col < 3 and row == 1:  # Средний ряд, колонки 0,1,2
                result_row.append(config.get("scatter_symbol", "S"))
            else:
                # Передаём колонку и флаг фриспина
                result_row.append(generate_random_symbol(col, is_free_spin))
        result.append(result_row)
    return result

# Проверка Scatter символов (по всей матрице, не по линиям)
def check_scatter(matrix):
    scatter_symbol = config.get("scatter_symbol", "S")
    free_spins_config = config.get("free_spins", {})
    trigger_count = free_spins_config.get("trigger_count", 3)
    
    scatter_count = 0
    for row in matrix:
        for sym in row:
            if sym == scatter_symbol:
                scatter_count += 1
    
    triggered = scatter_count >= trigger_count
    return {
        "scatter_count": scatter_count,
        "triggered": triggered,
        "trigger_count": trigger_count
    }

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

# ============== АВТОРИЗАЦИЯ ==============

@app.route('/api/auth', methods=['POST'])
def auth():
    """
    Авторизация игрока по platform + player_id
    Возвращает токен для последующих запросов
    """
    data = request.get_json() or {}
    platform = data.get('platform')
    player_id = data.get('player_id')
    
    if not platform or not player_id:
        return jsonify({'error': 'Требуются platform и player_id'}), 400
    
    # Получаем или создаём пользователя
    user = get_or_create_user(platform, player_id)
    
    # Создаём токен
    token = create_token(user['id'], platform, player_id)
    
    print(f"[AUTH] {platform}:{player_id} -> user_id={user['id']}, balance={user['balance']}")
    
    return jsonify({
        'token': token,
        'user': {
            'id': user['id'],
            'balance': user['balance'],
            'total_spins': user['total_spins'],
            'biggest_win': user['biggest_win']
        }
    })


# ============== ИГРОВЫЕ ЭНДПОИНТЫ ==============

@app.route('/api/spin', methods=['POST'])
@require_auth
def spin(user_id: int):
    """Спин с авторизацией (поддерживает фриспины)"""
    user = get_user_by_id(user_id)
    if not user:
        return jsonify({'error': 'Пользователь не найден'}), 404
    
    # Получаем ставку и статус фриспинов из запроса
    data = request.get_json() or {}
    bet = data.get('bet', 1)
    is_free_spin = data.get('is_free_spin', False)
    free_spins_remaining = data.get('free_spins_remaining', 0)
    test_mode = data.get('test_free_spins', False)  # Тестовый режим для гарантированного фриспина
    
    free_spins_config = config.get("free_spins", {})
    fs_multiplier = free_spins_config.get("multiplier", 2)
    
    # Если это не фриспин — проверяем баланс и списываем ставку
    if not is_free_spin:
        if user['balance'] < bet:
            return jsonify({'error': 'Недостаточно средств'}), 400
        balance = user['balance'] - bet
    else:
        # Фриспин — ставка не списывается
        balance = user['balance']
    
    # Генерируем результат спина (с улучшенными весами для фриспинов)
    matrix = generate_spin_result(test_mode=test_mode, is_free_spin=is_free_spin)
    
    # Проверяем регулярные выигрышные линии
    win_result = check_winlines(matrix)
    
    # Умножаем выигрыш на ставку
    win_amount = win_result['total_win'] * bet
    
    # Если это фриспин — применяем множитель
    if is_free_spin and win_amount > 0:
        win_amount *= fs_multiplier
    
    # Проверяем Scatter (триггер фриспинов)
    scatter_result = check_scatter(matrix)
    free_spins_triggered = 0
    
    if scatter_result["triggered"]:
        # Если фриспины уже активны — это ре-триггер
        if is_free_spin:
            free_spins_triggered = free_spins_config.get("retrigger_free_spins", 10)
        else:
            free_spins_triggered = free_spins_config.get("free_spins_count", 10)
    
    # Обновляем оставшиеся фриспины
    if free_spins_triggered > 0:
        free_spins_remaining_new = free_spins_remaining + free_spins_triggered
    elif is_free_spin:
        free_spins_remaining_new = free_spins_remaining - 1
    else:
        free_spins_remaining_new = 0
    
    # Вычисляем новый баланс (для фриспинов — добавляем выигрыш)
    if not is_free_spin:
        new_balance = balance + win_amount
    else:
        new_balance = balance + win_amount
    
    # Сохраняем в БД — одно соединение для всех операций
    from database import get_db
    with get_db() as db:
        db.execute(
            'UPDATE users SET balance = ? WHERE id = ?',
            (new_balance, user_id)
        )
        db.execute('''
            UPDATE users SET 
                total_spins = total_spins + 1,
                total_wagered = total_wagered + ?,
                total_won = total_won + ?,
                biggest_win = MAX(biggest_win, ?)
            WHERE id = ?
        ''', (bet if not is_free_spin else 0, win_amount, win_amount, user_id))
        db.commit()
    
    return jsonify({
        'matrix': matrix,
        'wins': win_result['wins'],
        'win_amount': win_amount,
        'balance': new_balance,
        'is_free_spin': is_free_spin,
        'free_spins_triggered': free_spins_triggered,
        'free_spins_remaining': free_spins_remaining_new,
        'free_spins_multiplier': fs_multiplier if is_free_spin else 1,
        'scatter_count': scatter_result["scatter_count"]
    })


@app.route('/api/balance', methods=['GET'])
@require_auth
def get_balance(user_id: int):
    """Получить баланс авторизованного пользователя"""
    user = get_user_by_id(user_id)
    if not user:
        return jsonify({'error': 'Пользователь не найден'}), 404
    
    return jsonify({'balance': user['balance']})


@app.route('/api/reset_balance', methods=['POST'])
@require_auth
def reset_balance(user_id: int):
    """Сбросить баланс (для тестирования)"""
    update_user_balance(user_id, 10000)
    return jsonify({'balance': 10000})

@app.route('/api/multi_spin', methods=['POST'])
@require_auth
def multi_spin(user_id: int):
    """Множественный спин для тестирования"""
    user = get_user_by_id(user_id)
    if not user:
        return jsonify({'error': 'Пользователь не найден'}), 404
    
    balance = user['balance']
    
    # Получаем ставку из запроса
    data = request.get_json() or {}
    bet = data.get('bet', 1)
    spins = data.get('spins', 1000)
    
    # Ограничиваем количество спинов
    if spins > 1000:
        spins = 1000
    
    # Проверяем, достаточно ли баланса для одного спина
    if balance < bet:
        return jsonify({'error': 'Недостаточно средств'}), 400
    
    # Статистика
    stats = {
        'total_bet': 0,
        'total_win': 0,
        'spins': 0,
        'symbol_frequency': {s: 0 for s in config['symbols']},
        'win_frequency': 0,
        'biggest_win': 0,
        'rtp': 0,
        'balance': balance
    }
    
    # Выполняем спины
    for _ in range(spins):
        # Проверяем, достаточно ли баланса для текущего спина
        if balance < bet:
            break
            
        # Списываем ставку
        balance -= bet
        stats['total_bet'] += bet
        stats['spins'] += 1
        
        # Генерируем результат спина
        matrix = generate_spin_result()
        
        # Подсчитываем частоту символов
        for row in matrix:
            for symbol in row:
                stats['symbol_frequency'][symbol] += 1
        
        # Проверяем выигрыш
        win_result = check_winlines(matrix)
        win_amount = win_result['total_win'] * bet
        
        # Обновляем статистику
        stats['total_win'] += win_amount
        if win_amount > 0:
            stats['win_frequency'] += 1
        if win_amount > stats['biggest_win']:
            stats['biggest_win'] = win_amount
        
        # Добавляем выигрыш к балансу
        balance += win_amount
    
    # Сохраняем баланс в БД
    update_user_balance(user_id, balance)
    
    # Обновляем баланс в статистике
    stats['balance'] = balance
    
    # Рассчитываем RTP
    stats['rtp'] = stats['total_win'] / stats['total_bet'] if stats['total_bet'] > 0 else 0
    stats['win_frequency'] = stats['win_frequency'] / stats['spins'] if stats['spins'] > 0 else 0
    
    # Нормализуем частоту символов (в процентах)
    total_symbols = sum(stats['symbol_frequency'].values())
    for symbol in stats['symbol_frequency']:
        stats['symbol_frequency'][symbol] = round(stats['symbol_frequency'][symbol] * 100 / total_symbols, 2) if total_symbols > 0 else 0
    
    return jsonify({
        'stats': stats,
        'balance': balance
    })

@app.route('/api/config', methods=['GET'])
def get_config():
    return jsonify(config)


# Награда за просмотр рекламы
AD_REWARD_AMOUNT = 1000
AD_REWARD_COOLDOWN = 30  # Минимальный интервал между наградами (секунды)

# Словарь для отслеживания времени последней награды (в production использовать Redis/БД)
last_ad_reward = {}

@app.route('/api/ad_reward', methods=['POST', 'OPTIONS'])
@require_auth
def claim_ad_reward(user_id: int):
    """Начисление награды за просмотр рекламы"""
    import time
    
    user = get_user_by_id(user_id)
    if not user:
        return jsonify({'error': 'Пользователь не найден'}), 404
    
    current_time = time.time()
    
    # Проверяем cooldown (защита от накрутки)
    if user_id in last_ad_reward:
        time_since_last = current_time - last_ad_reward[user_id]
        if time_since_last < AD_REWARD_COOLDOWN:
            remaining = int(AD_REWARD_COOLDOWN - time_since_last)
            return jsonify({
                'error': f'Подождите {remaining} секунд перед следующей наградой'
            }), 429
    
    # Начисляем награду
    new_balance = user['balance'] + AD_REWARD_AMOUNT
    update_user_balance(user_id, new_balance)
    
    # Обновляем время последней награды
    last_ad_reward[user_id] = current_time
    
    print(f"[AD_REWARD] user_id={user_id} получил {AD_REWARD_AMOUNT} монет, новый баланс={new_balance}")
    
    return jsonify({
        'balance': new_balance,
        'reward': AD_REWARD_AMOUNT
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
