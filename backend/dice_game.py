"""
Отдельная игра Dice Ladder в лобби.
Бонус слота (bonus_dice) не трогаем.

Правила:
  - каждый бросок списывает ставку S с баланса
  - coin +1, fire +2, diamond 0, skull -1
  - череп с 0 — сгоревший бросок, раунд продолжается
  - забрать только на чекпоинтах (5, 10, 15, ...)
  - выплата: S × multiplier(checkpoint)
"""
import random
import threading
import time
import uuid

DICE_FACE_STEPS = {
    "coin": 1,
    "diamond": 0,
    "fire": 2,
    "skull": -1,
}

DEFAULT_TIERS = [
    {"from_level": 0, "faces": {"coin": 7, "diamond": 2, "fire": 1, "skull": 2}},
    {"from_level": 1, "faces": {"coin": 5, "diamond": 2, "fire": 2, "skull": 3}},
    {"from_level": 5, "faces": {"coin": 4, "diamond": 2, "fire": 1, "skull": 5}},
    {"from_level": 10, "faces": {"coin": 3, "diamond": 2, "fire": 1, "skull": 6}},
    {"from_level": 20, "faces": {"coin": 2, "diamond": 1, "fire": 1, "skull": 8}},
    {"from_level": 40, "faces": {"coin": 1, "diamond": 1, "fire": 1, "skull": 9}},
]

DEFAULT_CHECKPOINT_EVERY = 5

DEFAULT_CHECKPOINT_MULT = {
    5: 4,
    10: 12,
    15: 28,
    20: 50,
    25: 80,
    30: 120,
}

_sessions = {}
_lock = threading.Lock()
SESSION_TTL_SEC = 60 * 30


def _now():
    return time.time()


def _cleanup():
    cutoff = _now() - SESSION_TTL_SEC
    dead = [k for k, v in _sessions.items() if v.get("updated_at", 0) < cutoff]
    for k in dead:
        _sessions.pop(k, None)


def get_dice_game_config(config: dict) -> dict:
    cfg = config.get("dice_game") or {}
    return {
        "tiers": cfg.get("tiers") or DEFAULT_TIERS,
        "checkpoint_every": int(cfg.get("checkpoint_every") or DEFAULT_CHECKPOINT_EVERY),
        "checkpoint_multipliers": cfg.get("checkpoint_multipliers") or DEFAULT_CHECKPOINT_MULT,
        "step_payout_rate": float(cfg.get("step_payout_rate", 0.4)),
    }


def step_payout_rate(config: dict) -> float:
    return get_dice_game_config(config)["step_payout_rate"]


def step_payout(bet: int, new_levels: int, config: dict) -> int:
    if new_levels <= 0 or bet <= 0:
        return 0
    return int(bet * step_payout_rate(config) * new_levels)


def checkpoint_every(config: dict) -> int:
    return get_dice_game_config(config)["checkpoint_every"]


def is_checkpoint(level: int, config: dict) -> bool:
    every = checkpoint_every(config)
    return level > 0 and every > 0 and level % every == 0


def next_checkpoint(level: int, config: dict) -> int:
    every = checkpoint_every(config)
    if every <= 0:
        return 0
    if is_checkpoint(level, config):
        return level
    return ((level // every) + 1) * every


def get_multiplier(level: int, config: dict) -> int:
    if not is_checkpoint(level, config):
        return 0
    table = get_dice_game_config(config)["checkpoint_multipliers"]
    if str(level) in table:
        return int(table[str(level)])
    if level in table:
        return int(table[level])
    every = checkpoint_every(config)
    known = [(int(k), int(v)) for k, v in table.items()]
    known.sort()
    if not known:
        return max(1, level)
    last_lvl, last_m = known[-1]
    extra = max(0, (level - last_lvl) // every)
    return last_m + extra * 20


def get_faces_for_level(level: int, config: dict):
    tiers = get_dice_game_config(config)["tiers"]
    chosen = tiers[0]
    for t in tiers:
        if int(level) >= int(t.get("from_level", 0)):
            chosen = t
    faces_cfg = chosen.get("faces", {})
    faces = []
    for face, count in faces_cfg.items():
        faces.extend([face] * int(count))
    if not faces:
        faces = ["coin", "coin", "diamond", "fire", "skull"]
    return faces


def visible_levels(level: int, config: dict, window: int = 12):
    start = max(1, level - 2)
    end = max(start + window - 1, level + 8)
    nxt = next_checkpoint(level, config)
    end = max(end, nxt)
    return [
        {
            "level": n,
            "multiplier": get_multiplier(n, config),
            "checkpoint": is_checkpoint(n, config),
        }
        for n in range(start, end + 1)
    ]


def create_session(user_id: int, bet: int) -> dict:
    with _lock:
        _cleanup()
        # одна активная сессия на игрока
        for sid, s in list(_sessions.items()):
            if s.get("user_id") == user_id and s.get("active"):
                _sessions.pop(sid, None)
        sid = str(uuid.uuid4())
        sess = {
            "id": sid,
            "user_id": user_id,
            "bet": bet,
            "level": 0,
            "paid_checkpoint": 0,
            "active": True,
            "updated_at": _now(),
        }
        _sessions[sid] = sess
        return sess


def restore_session(user_id: int, session_id: str, bet: int, level: int, paid_checkpoint: int = 0) -> dict:
    with _lock:
        sess = {
            "id": session_id,
            "user_id": user_id,
            "bet": bet,
            "level": level,
            "paid_checkpoint": int(paid_checkpoint or 0),
            "active": True,
            "updated_at": _now(),
        }
        _sessions[session_id] = sess
        return sess



def get_session(session_id: str, user_id: int):
    with _lock:
        sess = _sessions.get(session_id)
        if not sess or sess["user_id"] != user_id:
            return None
        return sess


def update_session(session_id: str, **fields):
    with _lock:
        sess = _sessions.get(session_id)
        if not sess:
            return None
        sess.update(fields)
        sess["updated_at"] = _now()
        return sess


def close_session(session_id: str):
    with _lock:
        sess = _sessions.get(session_id)
        if sess:
            sess["active"] = False
            sess["updated_at"] = _now()
        return sess


def roll_face(level: int, config: dict, force_face=None) -> str:
    valid = ("coin", "diamond", "fire", "skull")
    if force_face in valid:
        return force_face
    return random.choice(get_faces_for_level(level, config))
