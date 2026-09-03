from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import random
import os

from database import init_db, get_or_create_user, get_user_by_id, update_user_balance, update_user_stats, deduct_balance, add_balance, get_user_balance
from auth import create_token, require_auth
from journal import log_spin, get_recent, get_summary

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
                "A": {"weight": 1, "payout": {"3": 3, "4": 5, "5": 12}},
                "B": {"weight": 2, "payout": {"3": 2, "4": 5, "5": 8}},
                "C": {"weight": 3, "payout": {"3": 2, "4": 3, "5": 5}},
                "D": {"weight": 4, "payout": {"3": 2, "4": 2, "5": 5}},
                "E": {"weight": 5, "payout": {"3": 2, "4": 2, "5": 3}},
                "F": {"weight": 5, "payout": {"3": 2, "4": 2, "5": 3}},
                "G": {"weight": 1, "payout": {}}
            },
            "paylines": [
                # Горизонтальные линии (центр, верх, низ)
                [{"row": 1, "col": 0}, {"row": 1, "col": 1}, {"row": 1, "col": 2}, {"row": 1, "col": 3}, {"row": 1, "col": 4}],
                [{"row": 0, "col": 0}, {"row": 0, "col": 1}, {"row": 0, "col": 2}, {"row": 0, "col": 3}, {"row": 0, "col": 4}],
                [{"row": 2, "col": 0}, {"row": 2, "col": 1}, {"row": 2, "col": 2}, {"row": 2, "col": 3}, {"row": 2, "col": 4}],
                # V-образная линия
                [{"row": 0, "col": 0}, {"row": 1, "col": 1}, {"row": 2, "col": 2}, {"row": 1, "col": 3}, {"row": 0, "col": 4}],
                # Λ-образная линия
                [{"row": 2, "col": 0}, {"row": 1, "col": 1}, {"row": 0, "col": 2}, {"row": 1, "col": 3}, {"row": 2, "col": 4}],
                # Волнистая верхняя
                [{"row": 1, "col": 0}, {"row": 0, "col": 1}, {"row": 0, "col": 2}, {"row": 0, "col": 3}, {"row": 1, "col": 4}],
                # Волнистая нижняя
                [{"row": 1, "col": 0}, {"row": 2, "col": 1}, {"row": 2, "col": 2}, {"row": 2, "col": 3}, {"row": 1, "col": 4}],
                # Диагональ вниз
                [{"row": 0, "col": 0}, {"row": 0, "col": 1}, {"row": 1, "col": 2}, {"row": 2, "col": 3}, {"row": 2, "col": 4}],
                # Диагональ вверх
                [{"row": 2, "col": 0}, {"row": 2, "col": 1}, {"row": 1, "col": 2}, {"row": 0, "col": 3}, {"row": 0, "col": 4}],
                # Малая V
                [{"row": 0, "col": 0}, {"row": 1, "col": 1}, {"row": 1, "col": 2}, {"row": 1, "col": 3}, {"row": 0, "col": 4}],
                # Малая Λ
                [{"row": 2, "col": 0}, {"row": 1, "col": 1}, {"row": 1, "col": 2}, {"row": 1, "col": 3}, {"row": 2, "col": 4}],
                # Зигзаг верх
                [{"row": 1, "col": 0}, {"row": 0, "col": 1}, {"row": 1, "col": 2}, {"row": 0, "col": 3}, {"row": 1, "col": 4}],
                # Зигзаг низ
                [{"row": 1, "col": 0}, {"row": 2, "col": 1}, {"row": 1, "col": 2}, {"row": 2, "col": 3}, {"row": 1, "col": 4}],
                # Двойная V
                [{"row": 0, "col": 0}, {"row": 1, "col": 1}, {"row": 0, "col": 2}, {"row": 1, "col": 3}, {"row": 0, "col": 4}],
                # Двойная Λ
                [{"row": 2, "col": 0}, {"row": 1, "col": 1}, {"row": 2, "col": 2}, {"row": 1, "col": 3}, {"row": 2, "col": 4}]
            ],
            "rtp_target": 0.95,  # Целевой RTP (Return to Player)
            "bonus_dice": {
                "symbol": "G",
                "trigger_count": 3,
                "levels": [],
                "dice": []
            }
        }
        with open(config_path, 'w') as f:
            json.dump(default_config, f, indent=2)
        return default_config
    
    with open(config_path, 'r') as f:
        return json.load(f)

# Глобальная переменная для хранения конфигурации
config = load_config()

# Получение лимитов ставок из конфига
def get_bet_limits():
    """Вернуть словарь с лимитами ставок (с значениями по умолчанию)."""
    bl = config.get("bet_limits", {})
    return {
        "min": bl.get("min", 100),
        "max": bl.get("max", 5000),
        "default": bl.get("default", 500),
        "presets": bl.get("presets", [100, 200, 500, 1000, 2000, 5000])
    }

def validate_bet(bet: int) -> tuple:
    """
    Проверить, что ставка в допустимых пределах.
    Возвращает (is_valid: bool, error_message: str или None).
    """
    limits = get_bet_limits()
    if bet <= 0:
        return False, "Ставка должна быть положительным числом"
    if bet < limits["min"]:
        return False, f"Минимальная ставка: {limits['min']}"
    if bet > limits["max"]:
        return False, f"Максимальная ставка: {limits['max']}"
    return True, None

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
def generate_spin_result(test_mode=False, is_free_spin=False, test_bonus=False):
    result = []
    for row in range(3):
        result_row = []
        for col in range(5):
            # В тестовом режиме бонуса — гарантируем 3 бонусных символа на барабанах 0,1,2
            if test_bonus and col < 3 and row == 1:  # Средний ряд, колонки 0,1,2
                result_row.append(config.get("bonus_dice", {}).get("symbol", "G"))
            # В тестовом режиме — гарантируем 3 Scatter на барабанах 0,1,2
            elif test_mode and col < 3 and row == 1:  # Средний ряд, колонки 0,1,2
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

# ============== БОНУСНАЯ ИГРА DICE LADDER ==============
# Грани кубика:
#   coin    🪙  — подъём на +1 ступень (множитель растёт)
#   diamond 💎  — безопасный шаг (остаёмся на месте, выигрыш не теряется)
#   fire    🔥  — сразу +2 ступени
#   skull   💀  — проигрыш бонуса (весь выигрыш сгорает)

DICE_FACE_STEPS = {
    "coin": 1,
    "diamond": 0,
    "fire": 2,
    "skull": 0,
}

def check_bonus(matrix):
    """Проверка бонусного символа (по всей матрице, как scatter)"""
    bonus_config = config.get("bonus_dice", {})
    bonus_symbol = bonus_config.get("symbol", "G")
    trigger_count = bonus_config.get("trigger_count", 3)
    count = sum(1 for row in matrix for sym in row if sym == bonus_symbol)
    return {
        "g_count": count,
        "triggered": count >= trigger_count,
        "trigger_count": trigger_count,
    }

def get_bonus_levels():
    """Список ступеней бонусной лестницы"""
    return config.get("bonus_dice", {}).get("levels", [])

def get_bonus_multiplier(level):
    """Множитель для заданной ступени"""
    for entry in get_bonus_levels():
        if int(entry.get("level")) == int(level):
            return int(entry.get("multiplier", 0))
    return 0

def get_bonus_max_level():
    """Максимальная ступень (вершина лестницы)"""
    levels = get_bonus_levels()
    return max((int(l["level"]) for l in levels), default=0)

def get_dice_faces(level):
    """Список граней кубика для текущей ступени (по весам из конфига)"""
    dice_cfg = config.get("bonus_dice", {}).get("dice", [])
    entry = next((d for d in dice_cfg if int(d.get("level")) == int(level)), None)
    if entry is None and dice_cfg:
        # Для уровня 0 (старт) и неизвестных уровней используем самую лёгкую запись
        entry = dice_cfg[0]
    faces_cfg = entry.get("faces", {}) if entry else {"coin": 2, "diamond": 2, "fire": 1, "skull": 1}
    faces = []
    for face, count in faces_cfg.items():
        faces.extend([face] * int(count))
    if not faces:
        faces = ["coin", "coin", "diamond", "diamond", "fire", "skull"]
    return faces

@app.route('/api/bonus_dice/roll', methods=['POST'])
@require_auth
def bonus_dice_roll(user_id: int):
    """Бросок кубика в бонусной игре Dice Ladder"""
    user = get_user_by_id(user_id)
    if not user:
        return jsonify({'error': 'Пользователь не найден'}), 404

    data = request.get_json() or {}
    bet = int(data.get('bet', 0))
    level = int(data.get('level', 0))
    force_face = data.get('force_face')  # для тестирования

    max_level = get_bonus_max_level()
    # Валидируем ставку (диапазон из конфига, защита от отрицательных ставок)
    is_valid, error_msg = validate_bet(bet)
    if not is_valid:
        return jsonify({'error': error_msg}), 400
    if level < 0 or level > max_level:
        return jsonify({'error': 'Неверный уровень'}), 400

    # Выбираем грань (test-режим позволяет форсировать результат)
    valid_faces = ("coin", "diamond", "fire", "skull")
    if force_face in valid_faces:
        face = force_face
    else:
        face = random.choice(get_dice_faces(level))

    # Считаем новую ступень
    steps = DICE_FACE_STEPS.get(face, 0)
    new_level = min(level + steps, max_level)
    reached_top = new_level >= max_level and level < max_level
    game_over = face == "skull" or reached_top

    multiplier = get_bonus_multiplier(new_level)
    # При 💀 выигрыш сгорает, при остальных гранях — выигрыш = ставка × множитель ступени
    win_amount = bet * multiplier if face != "skull" else 0

    balance = user['balance']
    # При достижении вершины — автоматический кэшаут (баланс начисляется сразу)
    if reached_top and win_amount > 0:
        balance += win_amount
        update_user_balance(user_id, balance)
        print(f"[BONUS] user_id={user_id} достиг вершины лестницы, выигрыш={win_amount}, balance={balance}")

    return jsonify({
        'face': face,
        'new_level': new_level,
        'win_amount': win_amount,
        'game_over': game_over,
        'reached_top': reached_top,
        'balance': balance,
        'levels': get_bonus_levels(),
        'multiplier': multiplier,
    })


@app.route('/api/bonus_dice/cashout', methods=['POST'])
@require_auth
def bonus_dice_cashout(user_id: int):
    """Забрать текущий выигрыш в бонусной игре Dice Ladder"""
    user = get_user_by_id(user_id)
    if not user:
        return jsonify({'error': 'Пользователь не найден'}), 404

    data = request.get_json() or {}
    bet = int(data.get('bet', 0))
    level = int(data.get('level', 0))

    if level <= 0:
        return jsonify({'error': 'Нет выигрыша для забора'}), 400

    multiplier = get_bonus_multiplier(level)
    win_amount = bet * multiplier
    if win_amount <= 0:
        return jsonify({'error': 'Нет выигрыша для забора'}), 400

    balance = user['balance'] + win_amount
    update_user_balance(user_id, balance)
    print(f"[BONUS] user_id={user_id} забрал выигрыш на ступени {level} (x{multiplier}) = {win_amount}, balance={balance}")

    return jsonify({
        'win_amount': win_amount,
        'balance': balance,
        'level': level,
        'multiplier': multiplier,
    })

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
    
    # Валидируем ставку (диапазон из конфига, защита от отрицательных ставок)
    is_valid, error_msg = validate_bet(bet)
    if not is_valid:
        return jsonify({'error': error_msg}), 400
    
    is_free_spin = data.get('is_free_spin', False)
    free_spins_remaining = data.get('free_spins_remaining', 0)
    test_mode = data.get('test_free_spins', False)  # Тестовый режим для гарантированного фриспина
    test_bonus = data.get('test_bonus', False)  # Тестовый режим для гарантированного бонуса
    
    free_spins_config = config.get("free_spins", {})
    fs_multiplier = free_spins_config.get("multiplier", 2)
    
    # Если это не фриспин — списываем ставку атомарно
    if not is_free_spin:
        balance = deduct_balance(user_id, bet)
        if balance is None:
            return jsonify({'error': 'Недостаточно средств'}), 400
    else:
        # Фриспин — ставка не списывается, получаем текущий баланс
        balance = get_user_balance(user_id)
        if balance is None:
            return jsonify({'error': 'Пользователь не найден'}), 404
    
    # Генерируем результат спина (с улучшенными весами для фриспинов)
    matrix = generate_spin_result(test_mode=test_mode, is_free_spin=is_free_spin, test_bonus=test_bonus)
    
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

    # Проверяем бонусный символ (триггер Dice Ladder)
    bonus_result = check_bonus(matrix)
    
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
    
    # Начисляем выигрыш (атомарно)
    if win_amount > 0:
        new_balance = add_balance(user_id, win_amount)
    else:
        new_balance = balance
    
    # Обновляем статистику (атомарно)
    from database import get_db
    with get_db() as db:
        db.execute('''
            UPDATE users SET 
                total_spins = total_spins + 1,
                total_wagered = total_wagered + ?,
                total_won = total_won + ?,
                biggest_win = MAX(biggest_win, ?)
            WHERE id = ?
        ''', (bet if not is_free_spin else 0, win_amount, win_amount, user_id))
        db.commit()
    
    # Логируем спин в журнал
    log_spin(
        user_id=user_id,
        platform=user.get('platform', ''),
        player_id=user.get('player_id', ''),
        bet=bet,
        is_free_spin=is_free_spin,
        matrix=matrix,
        win_amount=win_amount,
        balance=new_balance,
        scatter_triggered=scatter_result['triggered'],
        bonus_triggered=bonus_result['triggered'],
        free_spins_remaining=free_spins_remaining_new,
        wins=win_result['wins']
    )
    
    return jsonify({
        'matrix': matrix,
        'wins': win_result['wins'],
        'win_amount': win_amount,
        'balance': new_balance,
        'is_free_spin': is_free_spin,
        'free_spins_triggered': free_spins_triggered,
        'free_spins_remaining': free_spins_remaining_new,
        'free_spins_multiplier': fs_multiplier if is_free_spin else 1,
        'scatter_count': scatter_result["scatter_count"],
        'bonus_triggered': bonus_result["triggered"],
        'bonus_symbol_count': bonus_result["g_count"],
        'bonus_levels': get_bonus_levels()
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
    """Множественный спин для тестирования (симуляция, без изменения реального баланса)"""
    user = get_user_by_id(user_id)
    if not user:
        return jsonify({'error': 'Пользователь не найден'}), 404
    
    data = request.get_json() or {}
    bet = data.get('bet', 1)
    spins = data.get('spins', 1000)
    
    # Валидируем ставку (диапазон из конфига, защита от отрицательных ставок)
    is_valid, error_msg = validate_bet(bet)
    if not is_valid:
        return jsonify({'error': error_msg}), 400
    
    # Ограничиваем количество спинов
    if spins > 100000:
        spins = 100000
    
    # Проверяем, достаточно ли баланса для одного обычного спина
    if user['balance'] < bet:
        return jsonify({'error': 'Недостаточно средств'}), 400
    
    start_balance = user['balance']
    virtual_balance = start_balance  # Виртуальный баланс — реальный НЕ ТРОГАЕМ
    
    free_spins_config = config.get("free_spins", {})
    fs_trigger_count = free_spins_config.get("trigger_count", 3)
    fs_count = free_spins_config.get("free_spins_count", 10)
    fs_multiplier = free_spins_config.get("multiplier", 3)
    fs_retrigger_free_spins = free_spins_config.get("retrigger_free_spins", 10)
    
    bonus_config = config.get("bonus_dice", {})
    bonus_symbol = bonus_config.get("symbol", "G")
    bonus_trigger_count = bonus_config.get("trigger_count", 3)
    
    # Статистика
    stats = {
        'start_balance': start_balance,
        'total_bet': 0,
        'total_win': 0,
        'spins': 0,
        'free_spins_played': 0,
        'symbol_frequency': {s: 0 for s in config['symbols']},
        'win_frequency': 0,
        'biggest_win': 0,
        'scatter_triggers': 0,
        'bonus_triggers': 0,
        'rtp': 0,
        'balance': virtual_balance,
        'win_breakdown': {
            'regular_spins': 0,      # выигрыши от обычных спинов
            'free_spins': 0,          # выигрыши от фриспинов
            'dice_bonus': 0           # выигрыши от Dice-бонуса
        }
    }
    
    free_spins_remaining = 0
    
    # Симуляция спинов (реальный баланс в БД не меняется)
    for _ in range(spins):
        # Если обычный спин и не хватает виртуального баланса — останавливаемся
        if free_spins_remaining <= 0 and virtual_balance < bet:
            break
        
        is_free_spin = free_spins_remaining > 0
        
        # Списываем ставку только для обычных спинов
        if not is_free_spin:
            virtual_balance -= bet
            stats['total_bet'] += bet
        else:
            free_spins_remaining -= 1
            stats['free_spins_played'] += 1
        
        stats['spins'] += 1
        
        # Генерируем результат спина (с улучшенными весами для фриспинов)
        matrix = generate_spin_result(is_free_spin=is_free_spin)
        
        # Подсчитываем частоту символов
        for row in matrix:
            for symbol in row:
                stats['symbol_frequency'][symbol] += 1
        
        # Проверяем выигрыш по линиям
        win_result = check_winlines(matrix)
        win_amount = win_result['total_win'] * bet
        
        # Если фриспин — применяем множитель
        if is_free_spin and win_amount > 0:
            win_amount *= fs_multiplier
            stats['win_breakdown']['free_spins'] += win_amount
        else:
            stats['win_breakdown']['regular_spins'] += win_amount
        
        # Проверяем Scatter (триггер фриспинов)
        scatter_result = check_scatter(matrix)
        if scatter_result["triggered"]:
            stats['scatter_triggers'] += 1
            if is_free_spin:
                free_spins_remaining += fs_retrigger_free_spins  # ре-триггер
            else:
                free_spins_remaining += fs_count
        
        # Проверяем бонус Dice Ladder
        bonus_result = check_bonus(matrix)
        if bonus_result["triggered"]:
            stats['bonus_triggers'] += 1
            # Симуляция Dice-бонуса: играем лестницу
            dice_level = 1
            while True:
                face = random.choice(get_dice_faces(dice_level))
                steps = DICE_FACE_STEPS.get(face, 0)
                dice_level = min(dice_level + steps, get_bonus_max_level())
                if face == "skull":
                    break  # проигрыш — 0
                if dice_level >= get_bonus_max_level():
                    # Достиг вершины — выигрыш с множителем
                    mult = get_bonus_multiplier(dice_level)
                    bonus_win = bet * mult
                    stats['win_breakdown']['dice_bonus'] += bonus_win
                    stats['total_win'] += bonus_win
                    virtual_balance += bonus_win
                    if bonus_win > stats['biggest_win']:
                        stats['biggest_win'] = bonus_win
                    break
                # Решаем: cashout или продолжить? (50% шанс забрать, 50% рискнуть)
                cashout_chance = 0.4  # 40% шанс что игрок заберёт на каждой ступени
                mult = get_bonus_multiplier(dice_level)
                if random.random() < cashout_chance:
                    bonus_win = bet * mult
                    stats['win_breakdown']['dice_bonus'] += bonus_win
                    stats['total_win'] += bonus_win
                    virtual_balance += bonus_win
                    if bonus_win > stats['biggest_win']:
                        stats['biggest_win'] = bonus_win
                    break
        
        # Обновляем статистику выигрышей
        stats['total_win'] += win_amount
        if win_amount > 0:
            stats['win_frequency'] += 1
        if win_amount > stats['biggest_win']:
            stats['biggest_win'] = win_amount
        
        # Добавляем выигрыш к виртуальному балансу
        virtual_balance += win_amount
    
    # Баланс в статистике = виртуальный (реальный в БД НЕ МЕНЯЕТСЯ)
    stats['balance'] = virtual_balance
    stats['balance_change'] = virtual_balance - start_balance
    
    # Рассчитываем RTP (только по обычным спинам, т.к. total_bet = 0 для фриспинов)
    stats['rtp'] = stats['total_win'] / stats['total_bet'] if stats['total_bet'] > 0 else 0
    stats['win_frequency'] = stats['win_frequency'] / stats['spins'] if stats['spins'] > 0 else 0
    
    # Нормализуем частоту символов (в процентах)
    total_symbols = sum(stats['symbol_frequency'].values())
    for symbol in stats['symbol_frequency']:
        stats['symbol_frequency'][symbol] = round(stats['symbol_frequency'][symbol] * 100 / total_symbols, 2) if total_symbols > 0 else 0
    
    return jsonify({
        'stats': stats,
        'balance': virtual_balance
    })

@app.route('/api/config', methods=['GET'])
def get_config():
    return jsonify(config)


@app.route('/api/journal/recent', methods=['GET'])
@require_auth
def journal_recent(user_id: int):
    """Последние записи журнала для текущего пользователя."""
    limit = request.args.get('limit', 50, type=int)
    entries = get_recent(limit)
    # Фильтруем только записи текущего пользователя
    entries = [e for e in entries if e.get('user_id') == user_id]
    return jsonify({'entries': entries})


@app.route('/api/journal/summary', methods=['GET'])
@require_auth
def journal_summary(user_id: int):
    """Сводка по последним спинам из журнала."""
    limit = request.args.get('limit', 1000, type=int)
    summary = get_summary(user_id=user_id, limit=limit)
    if summary:
        return jsonify(summary)
    return jsonify({'error': 'Нет данных в журнале'}), 404


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
    
    # Начисляем награду (атомарно)
    new_balance = add_balance(user_id, AD_REWARD_AMOUNT)
    
    # Обновляем время последней награды
    last_ad_reward[user_id] = current_time
    
    print(f"[AD_REWARD] user_id={user_id} получил {AD_REWARD_AMOUNT} монет, новый баланс={new_balance}")
    
    return jsonify({
        'balance': new_balance,
        'reward': AD_REWARD_AMOUNT
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
