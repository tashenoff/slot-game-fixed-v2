import json
import os
from datetime import datetime

# Файл журнала
JOURNAL_FILE = os.path.join(os.path.dirname(__file__), 'journal.jsonl')

# Максимальное количество записей в журнале (ротация)
MAX_ENTRIES = 50000


def log_spin(user_id: int, platform: str, player_id: str,
             bet: int, is_free_spin: bool,
             matrix: list, win_amount: int, balance: int,
             scatter_triggered: bool, bonus_triggered: bool,
             free_spins_remaining: int, wins: list):
    """
    Записать один спин в журнал.
    Формат: JSONL (одна JSON-строка на спин).
    """
    entry = {
        'ts': datetime.now().isoformat(),
        'user_id': user_id,
        'platform': platform,
        'player_id': player_id,
        'bet': bet,
        'type': 'free' if is_free_spin else 'regular',
        'matrix': [''.join(row) for row in matrix],
        'win': win_amount,
        'balance': balance,
        'scatter': scatter_triggered,
        'bonus': bonus_triggered,
        'free_spins_left': free_spins_remaining,
        'wins': wins
    }

    try:
        with open(JOURNAL_FILE, 'a', encoding='utf-8') as f:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')

        # Ротация: проверяем размер файла каждые 100 записей
        _check_rotation()
    except Exception as e:
        print(f"[JOURNAL] Ошибка записи: {e}")


def _check_rotation():
    """Если файл слишком большой — обрезаем до MAX_ENTRIES строк."""
    try:
        size = os.path.getsize(JOURNAL_FILE)
        if size > 50 * 1024 * 1024:  # 50 МБ
            with open(JOURNAL_FILE, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            if len(lines) > MAX_ENTRIES:
                with open(JOURNAL_FILE, 'w', encoding='utf-8') as f:
                    f.writelines(lines[-MAX_ENTRIES:])
                print(f"[JOURNAL] Ротация: оставлено {MAX_ENTRIES} записей")
    except:
        pass


def get_recent(limit: int = 50):
    """Получить последние N записей (для показа в UI)."""
    try:
        with open(JOURNAL_FILE, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        entries = []
        for line in lines[-limit:]:
            try:
                entries.append(json.loads(line))
            except:
                continue
        return entries
    except FileNotFoundError:
        return []


def get_summary(user_id: int = None, limit: int = 1000):
    """Получить сводку по последним спинам."""
    try:
        with open(JOURNAL_FILE, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        entries = []
        for line in lines[-limit:]:
            try:
                e = json.loads(line)
                if user_id and e.get('user_id') != user_id:
                    continue
                entries.append(e)
            except:
                continue

        if not entries:
            return None

        total_bet = sum(e['bet'] for e in entries if e.get('type') == 'regular')
        total_win = sum(e['win'] for e in entries)
        total_spins = len(entries)
        free_spins = sum(1 for e in entries if e.get('type') == 'free')
        wins_count = sum(1 for e in entries if e.get('win', 0) > 0)
        scatter_triggers = sum(1 for e in entries if e.get('scatter'))
        bonus_triggers = sum(1 for e in entries if e.get('bonus'))

        return {
            'total_bet': total_bet,
            'total_win': total_win,
            'spins': total_spins,
            'free_spins': free_spins,
            'win_frequency': round(wins_count / total_spins * 100, 2) if total_spins > 0 else 0,
            'rtp': round(total_win / total_bet * 100, 2) if total_bet > 0 else 0,
            'scatter_triggers': scatter_triggers,
            'bonus_triggers': bonus_triggers
        }
    except FileNotFoundError:
        return None 
