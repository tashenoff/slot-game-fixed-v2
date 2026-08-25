"""
Модуль авторизации — простые токены для сессии
"""
import secrets
import time
from functools import wraps
from typing import Optional, Dict, Any
from flask import request, jsonify

# Хранилище токенов в памяти: token -> {user_id, platform, player_id, created_at}
# В production лучше использовать Redis
_tokens = {}  # type: Dict[str, Dict[str, Any]]

# Время жизни токена (24 часа)
TOKEN_TTL = 24 * 60 * 60


def create_token(user_id: int, platform: str, player_id: str) -> str:
    """
    Создать токен авторизации для пользователя
    
    Returns:
        Строка токена
    """
    token = secrets.token_urlsafe(32)
    _tokens[token] = {
        'user_id': user_id,
        'platform': platform,
        'player_id': player_id,
        'created_at': time.time()
    }
    return token


def validate_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Проверить токен и вернуть данные пользователя
    
    Returns:
        Словарь с user_id, platform, player_id или None если невалидный
    """
    if not token or token not in _tokens:
        return None
    
    data = _tokens[token]
    
    # Проверяем срок действия
    if time.time() - data['created_at'] > TOKEN_TTL:
        del _tokens[token]
        return None
    
    return data


def invalidate_token(token: str):
    """Удалить токен (логаут)"""
    if token in _tokens:
        del _tokens[token]


def get_token_from_request() -> Optional[str]:
    """Извлечь токен из заголовка Authorization"""
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:]
    return None


def require_auth(f):
    """
    Декоратор для защиты эндпоинтов
    Добавляет user_id в kwargs функции
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        # Пропускаем OPTIONS запросы (CORS preflight)
        if request.method == 'OPTIONS':
            return '', 200
        
        token = get_token_from_request()
        if not token:
            return jsonify({'error': 'Требуется авторизация'}), 401
        
        token_data = validate_token(token)
        if not token_data:
            return jsonify({'error': 'Невалидный или истёкший токен'}), 401
        
        # Передаём user_id в функцию
        kwargs['user_id'] = token_data['user_id']
        return f(*args, **kwargs)
    
    return decorated


def cleanup_expired_tokens():
    """Очистить истёкшие токены (вызывать периодически)"""
    now = time.time()
    expired = [t for t, d in _tokens.items() if now - d['created_at'] > TOKEN_TTL]
    for token in expired:
        del _tokens[token]
