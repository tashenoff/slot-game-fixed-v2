"""
Telegram Bot для Slot Game.
Работает в режиме long polling (без вебхука).
Запускается в отдельном потоке из app.py.
"""
import os
import threading
import time
import json
import hashlib
import hmac
import urllib.parse

import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

# ============================================================
# Чтение переменных окружения
# ============================================================
BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
APP_URL = os.environ.get('TELEGRAM_APP_URL', '')
# ============================================================
# Верификация initData от Telegram Mini App
# Документация: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
# ============================================================
def verify_telegram_init_data(init_data: str) -> bool:
    """
    Проверяет подпись initData, используя bot token.
    Возвращает True, если данные валидны.
    """
    if not BOT_TOKEN or not init_data:
        return False

    try:
        # Парсим query string
        parsed = urllib.parse.parse_qs(init_data)
        # Берём hash из данных
        hash_value = parsed.get('hash', [None])[0]
        if not hash_value:
            return False

        # Удаляем hash из данных для проверки
        data_check = []
        for key in sorted(parsed.keys()):
            if key != 'hash':
                data_check.append(f"{key}={parsed[key][0]}")

        data_check_string = '\n'.join(data_check)

        # Создаём секретный ключ из токена бота
        secret_key = hashlib.sha256(BOT_TOKEN.encode()).digest()

        # Вычисляем HMAC-SHA256
        computed_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256
        ).hexdigest()

        return computed_hash == hash_value
    except Exception as e:
        print(f"[TELEGRAM_VERIFY] Ошибка верификации: {e}")
        return False


def parse_init_data_user(init_data: str):
    """
    Извлекает данные пользователя из initData.
    Возвращает словарь с id, first_name, last_name, username или None.
    """
    try:
        parsed = urllib.parse.parse_qs(init_data)
        user_json = parsed.get('user', [None])[0]
        if user_json:
            return json.loads(user_json)
    except Exception as e:
        print(f"[TELEGRAM_PARSE] Ошибка парсинга user: {e}")
    return None

_bot_instance = None
_bot_thread = None
# ============================================================
# Создание экземпляра бота
# ============================================================
def create_bot():
    """Создать и настроить Telegram бота."""
    if not BOT_TOKEN:
        print("[TELEGRAM_BOT] ❌ TELEGRAM_BOT_TOKEN не указан, бот не запущен")
        return None

    bot = telebot.TeleBot(BOT_TOKEN, parse_mode='HTML')

    # ---- Команда /start ----
    @bot.message_handler(commands=['start'])
    def start_handler(message):
        """Отправляет приветствие и кнопку для открытия Mini App."""
        if not APP_URL:
            bot.reply_to(
                message,
                "❌ Ошибка: Mini App не настроен. Администратор не указал TELEGRAM_APP_URL."
            )
            return

        markup = InlineKeyboardMarkup()
        button = InlineKeyboardButton(
            text="🎰 Играть в Slot Game",
            web_app=WebAppInfo(url=APP_URL)
        )
        markup.add(button)

        user = message.from_user
        welcome_text = (
            f"👋 Привет, {user.first_name}!\n\n"
            f"🎰 Добро пожаловать в Slot Game!\n\n"
            f"Нажми кнопку ниже, чтобы открыть игру 🚀"
        )
        bot.send_message(message.chat.id, welcome_text, reply_markup=markup)

    # ---- Команда /help ----
    @bot.message_handler(commands=['help'])
    def help_handler(message):
        help_text = (
            "🎰 <b>Slot Game</b>\n\n"
            "Команды:\n"
            "  /start — Запустить игру\n"
            "  /help — Показать эту справку\n"
            "  /about — О проекте\n\n"
            "Нажми /start чтобы открыть игровое меню!"
        )
        bot.reply_to(message, help_text)

    # ---- Команда /about ----
    @bot.message_handler(commands=['about'])
    def about_handler(message):
        about_text = (
            "🎰 <b>Slot Game v0.1</b>\n\n"
            "Классический слот с 5 барабанами, фриспинами и Dice-бонусом.\n\n"
            "Работает на нашем сервере."
        )
        bot.reply_to(message, about_text)

    # ---- Остальные сообщения ----
    @bot.message_handler(func=lambda msg: True)
    def fallback_handler(message):
        bot.reply_to(message, "Используй /start чтобы открыть игру 🎰")

    print(f"[TELEGRAM_BOT] ✅ Бот создан, токен: ...{BOT_TOKEN[-8:]}")
    return bot
# ============================================================
# Запуск бота в отдельном потоке
# ============================================================
def run_bot():
    """Запустить polling бота (блокирующий вызов)."""
    global _bot_instance
    bot = create_bot()
    if not bot:
        return

    _bot_instance = bot
    print("[TELEGRAM_BOT] 🔄 Запуск polling...")
    try:
        bot.infinity_polling(skip_pending=True, timeout=30)
    except Exception as e:
        print(f"[TELEGRAM_BOT] ❌ Ошибка polling: {e}")
        time.sleep(5)
        # Перезапуск при ошибке
        run_bot()


def start_bot_thread():
    """Запустить бота в фоновом потоке."""
    global _bot_thread
    if _bot_thread and _bot_thread.is_alive():
        print("[TELEGRAM_BOT] Бот уже запущен")
        return

    if not BOT_TOKEN or not APP_URL:
        print(f"[TELEGRAM_BOT] ⚠️ Не запущен: BOT_TOKEN={'✅' if BOT_TOKEN else '❌'}, APP_URL={'✅' if APP_URL else '❌'}")
        return

    _bot_thread = threading.Thread(target=run_bot, daemon=True)
    _bot_thread.start()
    print(f"[TELEGRAM_BOT] ✅ Бот запущен в фоновом потоке")


def stop_bot():
    """Остановить бота."""
    global _bot_instance
    if _bot_instance:
        try:
            _bot_instance.stop_polling()
            print("[TELEGRAM_BOT] Бот остановлен")
        except Exception as e:
            print(f"[TELEGRAM_BOT] Ошибка остановки: {e}")


# ============================================================
# API для Flask — функция получения initData из запроса
# ============================================================
def get_telegram_init_data(request):
    """
    Извлечь Telegram initData из заголовка или тела запроса.
    Используется в эндпоинте /auth.
    """
    # Из заголовка
    init_data = request.headers.get('X-Telegram-Init-Data', '')
    if init_data:
        return init_data

    # Из тела запроса
    data = request.get_json(silent=True) or {}
    return data.get('telegram_init_data', None)


if __name__ == '__main__':
    # Для тестирования отдельно
    from dotenv import load_dotenv
    load_dotenv()
    BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    APP_URL = os.environ.get('TELEGRAM_APP_URL', '')
    start_bot_thread()
    # Держим поток живым
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        stop_bot()
        print("[TELEGRAM_BOT] Бот остановлен")