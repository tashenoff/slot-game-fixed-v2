"""
Модуль для работы с базой данных SQLite
"""
import sqlite3
import os
import threading
from contextlib import contextmanager
from datetime import datetime
from typing import Optional, Dict, Any

# Путь к файлу базы данных
DB_PATH = os.path.join(os.path.dirname(__file__), 'game.db')

# Начальный баланс для новых игроков
INITIAL_BALANCE = 10000

# Блокировка для потокобезопасного доступа к БД
_db_lock = threading.Lock()


def init_db():
    """Инициализация базы данных и создание таблиц"""
    with get_db() as db:
        # PRAGMA настройки now applied in get_connection()
        db.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform TEXT NOT NULL,
                player_id TEXT NOT NULL,
                balance INTEGER DEFAULT 10000,
                total_spins INTEGER DEFAULT 0,
                total_wagered INTEGER DEFAULT 0,
                total_won INTEGER DEFAULT 0,
                biggest_win INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(platform, player_id)
            )
        ''')
        db.execute('''
            CREATE TABLE IF NOT EXISTS dice_sessions (
                user_id INTEGER PRIMARY KEY,
                session_id TEXT NOT NULL,
                bet INTEGER NOT NULL,
                level INTEGER NOT NULL DEFAULT 0,
                paid_checkpoint INTEGER NOT NULL DEFAULT 0,
                active INTEGER NOT NULL DEFAULT 1,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cols = [r[1] for r in db.execute('PRAGMA table_info(dice_sessions)').fetchall()]
        if 'paid_checkpoint' not in cols:
            db.execute('ALTER TABLE dice_sessions ADD COLUMN paid_checkpoint INTEGER NOT NULL DEFAULT 0')
        db.commit()
        print(f"[DB] База данных инициализирована: {DB_PATH} (persistent connection)")


@contextmanager
def get_db():
    """Контекстный менеджер для подключения к БД (потокобезопасный)"""
    with _db_lock:
        conn = get_connection()
        try:
            yield conn
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            pass  # НЕ закрываем соединение


def get_connection():
    """Получить постоянное соединение с БД (создаётся один раз)"""
    if not hasattr(get_connection, 'conn') or get_connection.conn is None:
        get_connection.conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        get_connection.conn.row_factory = sqlite3.Row
        # Оптимизации производительности (без WAL — DELETE journal)
        get_connection.conn.execute('PRAGMA synchronous=OFF')  # быстрее, WAL не нужен
        get_connection.conn.execute('PRAGMA cache_size=-8000')
        print(f"[DB] Постоянное соединение создано: {DB_PATH}")
    return get_connection.conn


def get_or_create_user(platform: str, player_id: str) -> dict:
    """
    Получить пользователя или создать нового
    
    Args:
        platform: Название платформы (yandex, vk, local)
        player_id: ID игрока на платформе
        
    Returns:
        Словарь с данными пользователя
    """
    with get_db() as db:
        # Пробуем найти существующего пользователя
        cursor = db.execute(
            'SELECT * FROM users WHERE platform = ? AND player_id = ?',
            (platform, player_id)
        )
        user = cursor.fetchone()
        
        if user:
            # Обновляем last_seen_at
            db.execute(
                'UPDATE users SET last_seen_at = ? WHERE id = ?',
                (datetime.now(), user['id'])
            )
            db.commit()
            return dict(user)
        
        # Создаём нового пользователя
        cursor = db.execute(
            '''INSERT INTO users (platform, player_id, balance) 
               VALUES (?, ?, ?)''',
            (platform, player_id, INITIAL_BALANCE)
        )
        db.commit()
        
        # Получаем созданного пользователя
        cursor = db.execute(
            'SELECT * FROM users WHERE id = ?',
            (cursor.lastrowid,)
        )
        user = cursor.fetchone()
        print(f"[DB] Создан новый пользователь: {platform}:{player_id}")
        return dict(user)


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Получить пользователя по внутреннему ID"""
    with get_db() as db:
        cursor = db.execute('SELECT * FROM users WHERE id = ?', (user_id,))
        user = cursor.fetchone()
        return dict(user) if user else None


def get_user_balance(user_id: int) -> Optional[int]:
    """Получить текущий баланс пользователя"""
    with get_db() as db:
        cursor = db.execute(
            'SELECT balance FROM users WHERE id = ?',
            (user_id,)
        )
        row = cursor.fetchone()
        return dict(row)['balance'] if row else None


def deduct_balance(user_id: int, amount: int) -> Optional[int]:
    """
    Атомарно списать баланс.
    Возвращает новый баланс или None если недостаточно средств.
    SQLite гарантирует атомарность UPDATE с условием.
    """
    with get_db() as db:
        # Атомарная операция: уменьшаем только если хватает
        cursor = db.execute(
            'UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?',
            (amount, user_id, amount)
        )
        db.commit()
        if cursor.rowcount == 0:
            return None  # Недостаточно средств
        # Возвращаем новый баланс
        cursor = db.execute(
            'SELECT balance FROM users WHERE id = ?',
            (user_id,)
        )
        row = cursor.fetchone()
        return dict(row)['balance']


def add_balance(user_id: int, amount: int) -> Optional[int]:
    """Атомарно добавить баланс (пополнение, награда за рекламу)"""
    with get_db() as db:
        db.execute(
            'UPDATE users SET balance = balance + ? WHERE id = ?',
            (amount, user_id)
        )
        db.commit()
        cursor = db.execute(
            'SELECT balance FROM users WHERE id = ?',
            (user_id,)
        )
        row = cursor.fetchone()
        return dict(row)['balance'] if row else None


def update_user_balance(user_id: int, new_balance: int) -> bool:
    """Обновить баланс пользователя (прямая установка)"""
    with get_db() as db:
        db.execute(
            'UPDATE users SET balance = ? WHERE id = ?',
            (new_balance, user_id)
        )
        db.commit()
        return True


def update_user_stats(user_id: int, bet: int, win: int):
    """Обновить статистику после спина"""
    with get_db() as db:
        db.execute('''
            UPDATE users SET 
                total_spins = total_spins + 1,
                total_wagered = total_wagered + ?,
                total_won = total_won + ?,
                biggest_win = MAX(biggest_win, ?)
            WHERE id = ?
        ''', (bet, win, win, user_id))
        db.commit()


def get_user_stats(user_id: int) -> Optional[Dict[str, Any]]:
    """Получить статистику пользователя"""
    with get_db() as db:
        cursor = db.execute('''
            SELECT 
                total_spins,
                total_wagered,
                total_won,
                biggest_win,
                CASE WHEN total_wagered > 0 
                     THEN ROUND(total_won * 100.0 / total_wagered, 2) 
                     ELSE 0 
                END as rtp
            FROM users WHERE id = ?
        ''', (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def save_dice_session(user_id: int, session_id: str, bet: int, level: int, active: bool = True, paid_checkpoint: int = 0):
    with get_db() as db:
        db.execute(
            '''INSERT INTO dice_sessions (user_id, session_id, bet, level, paid_checkpoint, active, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET
                 session_id = excluded.session_id,
                 bet = excluded.bet,
                 level = excluded.level,
                 paid_checkpoint = excluded.paid_checkpoint,
                 active = excluded.active,
                 updated_at = excluded.updated_at''',
            (user_id, session_id, bet, level, int(paid_checkpoint or 0), 1 if active else 0, datetime.now())
        )
        db.commit()


def get_dice_session(user_id: int) -> Optional[Dict[str, Any]]:
    with get_db() as db:
        cursor = db.execute(
            'SELECT * FROM dice_sessions WHERE user_id = ? AND active = 1',
            (user_id,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def close_dice_session(user_id: int):
    with get_db() as db:
        db.execute(
            'UPDATE dice_sessions SET active = 0, updated_at = ? WHERE user_id = ?',
            (datetime.now(), user_id)
        )
        db.commit()

