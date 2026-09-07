#!/usr/bin/env python3
"""
Реальный игрок-бот: совершает настоящие спины через API бэкенда.
Каждый спин проходит те же /api/auth + /api/spin, что и игра из браузера,
попадает в journal.jsonl и виден в дашборде.
Только для локальной разработки/теста.
"""
import sys, time, json, random, urllib.request

sys.stdout.reconfigure(encoding='utf-8')
API = 'http://127.0.0.1:5000'

def http_json(method, url, payload=None, token=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}
    except Exception as e:
        return None, {'error': str(e)}

def main():
    player_id = f'dashboard_bot_{random.randint(1000,9999)}'
    print(f"[BOT] Старт для {player_id}")

    # Авторизация
    status, auth = http_json('POST', f'{API}/api/auth', {
        'platform': 'local', 'player_id': player_id
    })
    if status != 200 or 'token' not in auth:
        print(f"[BOT] Ошибка авторизации: {status} {auth}")
        sys.exit(1)
    token = auth['token']
    balance = auth['user']['balance']
    spins = 0
    wins = 0
    print(f"[BOT] Авторизован, баланс={balance}")

    keep_running = True
    while keep_running:
        try:
            # Иногда меняем ставку
            bet = random.choice([100, 200, 300, 500, 600, 800, 1000, 2000])
            if balance < bet:
                bet = max(100, balance)
                if balance < 100:
                    print("[BOT] Баланс на нуле — остановка")
                    break

            status, spin = http_json('POST', f'{API}/api/spin', {
                'bet': bet, 'is_free_spin': False, 'free_spins_remaining': 0
            }, token)
            if status == 200:
                spins += 1
                balance = spin.get('balance', balance)
                if spin.get('win', 0) > 0:
                    wins += 1
                    print(f"[BOT] #{spins} win={spin['win']} balance={balance} scatter={spin.get('scatter')}")
                else:
                    print(f"[BOT] #{spins} loss bet={bet} balance={balance}")
            elif status == 401:
                # Токен протух — переавторизация
                status, auth = http_json('POST', f'{API}/api/auth', {
                    'platform': 'local', 'player_id': player_id
                })
                if status == 200:
                    token = auth['token']
                    balance = auth['user']['balance']
            else:
                print(f"[BOT] Статус {status}: {spin}")
        except Exception as e:
            print(f"[BOT] Ошибка: {e}")

        # Ритм: спин каждые ~1.5-4 сек
        time.sleep(random.uniform(1.5, 4.0))

if __name__ == '__main__':
    main()