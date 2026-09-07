#!/usr/bin/env python3
"""
Анализ эмоционального восприятия игрового процесса
Emotional Impact Score (EIS) Calculator
"""

import json
from datetime import datetime
from collections import defaultdict

def load_journal(filepath):
    """Загружает журнал спинов"""
    spins = []
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                spins.append(json.loads(line))
    return spins

def calculate_emotional_score(spins, window_size=10):
    """
    Рассчитывает эмоциональный score для каждого сегмента
    
    Факторы:
    - WinStreakBonus: бонус за серии выигрышей
    - WinSize: размер выигрыша относительно ставки
    - ScatterBonus: bonus за scatter символы
    - LossPenalty: штраф за длинные серии проигрышей
    - SurpriseFactor: неожиданность крупного выигрыша
    """
    
    results = []
    total_bet = 0
    total_win = 0
    
    # Базовые параметры
    base_bet = spins[0]['bet'] if spins else 500
    
    for i, spin in enumerate(spins):
        bet = spin['bet']
        win = spin['win']
        
        # Рассчитываем контекст вокруг текущего спина
        start_idx = max(0, i - window_size + 1)
        end_idx = min(len(spins), i + window_size)
        segment = spins[start_idx:end_idx]
        
        # Параметры сегмента
        segment_bets = sum(s['bet'] for s in segment)
        segment_wins = sum(s['win'] for s in segment)
        win_count = sum(1 for s in segment if s['win'] > 0)
        loss_count = len(segment) - win_count
        
        # Текущий результат
        is_win = win > 0
        win_ratio = win / bet if bet > 0 else 0
        
        # 1. WinStreak (текущая серия выигрышей)
        win_streak = 0
        for j in range(i, -1, -1):
            if spins[j]['win'] > 0:
                win_streak += 1
            else:
                break
        
        # 2. LossStreak (серия проигрышей)
        loss_streak = 0
        for j in range(i, -1, -1):
            if spins[j]['win'] == 0:
                loss_streak += 1
            else:
                break
        
        # 3. Emotional Factors
        factors = {}
        
        # WinStreakBonus: экспоненциальный рост от серии
        win_streak_bonus = min(win_streak * 0.15, 1.0)  # до +100%
        
        # WinSize: насколько выигрыш большой
        if win > 0:
            win_size_factor = min(win_ratio / 3, 2.0)  # x3 и выше = максимум
        else:
            win_size_factor = 0
        
        # LossPenalty: чем длиннее серия проигрышей, тем ниже настроение
        loss_penalty = min(loss_streak * 0.08, 0.6)  # до -60%
        
        # SurpriseFactor: крупный выигрыш после серии проигрышей
        if win > base_bet * 3 and loss_streak >= 3:
            surprise_factor = 0.4  # сильный бонус
        elif win > base_bet * 5:
            surprise_factor = 0.3
        else:
            surprise_factor = 0
        
        # ScatterBonus
        scatter_bonus = 0.2 if spin.get('scatter') else 0
        
        # Контекстный фактор (как мы играли перед этим)
        if loss_count >= 7 and win > 0:
            relief_factor = 0.25  # облегчение после долгого проигрыша
        else:
            relief_factor = 0
        
        # Итоговый Emotional Impact Score
        emotional_score = (
            0.3 * win_streak_bonus +      # Серия выигрышей
            0.25 * win_size_factor +       # Размер выигрыша
            0.2 * surprise_factor +        # Неожиданность
            0.15 * scatter_bonus +         # Scatter
            0.1 * relief_factor            # Облегчение
        ) - loss_penalty
        
        # Нормализация к диапазону [-1, 1]
        emotional_score = max(-1, min(1, emotional_score))
        
        # Эмоциональная метка
        if emotional_score >= 0.6:
            emotion_label = "🔥 Экстаз!"
        elif emotional_score >= 0.4:
            emotion_label = "😃 Радость"
        elif emotional_score >= 0.2:
            emotion_label = "🙂 Удовлетворение"
        elif emotional_score >= 0:
            emotion_label = "😐 Нейтрально"
        elif emotional_score >= -0.3:
            emotion_label = "😒 Разочарование"
        elif emotional_score >= -0.6:
            emotion_label = "😤 Злость"
        else:
            emotion_label = "😡 Ярость"
        
        result = {
            'index': i,
            'timestamp': spin['ts'],
            'bet': bet,
            'win': win,
            'balance': spin['balance'],
            'win_ratio': win_ratio,
            'win_streak': win_streak,
            'loss_streak': loss_streak,
            'emotional_score': emotional_score,
            'emotion_label': emotion_label,
            'factors': {
                'win_streak_bonus': win_streak_bonus,
                'win_size_factor': win_size_factor,
                'surprise_factor': surprise_factor,
                'scatter_bonus': scatter_bonus,
                'relief_factor': relief_factor,
                'loss_penalty': loss_penalty
            }
        }
        
        results.append(result)
        total_bet += bet
        total_win += win
    
    return results, total_bet, total_win

def analyze_emotional_patterns(results):
    """Анализирует паттерны эмоциональных состояний"""
    
    stats = {
        'total_spins': len(results),
        'positive_spins': 0,
        'negative_spins': 0,
        'neutral_spins': 0,
        'max_positive': -float('inf'),
        'max_negative': float('inf'),
        'avg_emotion': 0,
        'emotion_variance': 0,
        'longest_joy_streak': 0,
        'longest_pain_streak': 0,
        'current_joy_streak': 0,
        'current_pain_streak': 0,
        'big_wins_count': 0,
        'scare_spins': 0
    }
    
    joy_streak = 0
    pain_streak = 0
    
    for r in results:
        score = r['emotional_score']
        stats['avg_emotion'] += score
        
        if score >= 0.3:
            stats['positive_spins'] += 1
            joy_streak += 1
            pain_streak = 0
            if joy_streak > stats['longest_joy_streak']:
                stats['longest_joy_streak'] = joy_streak
            if score > stats['max_positive']:
                stats['max_positive'] = score
        elif score <= -0.3:
            stats['negative_spins'] += 1
            pain_streak += 1
            joy_streak = 0
            if pain_streak > stats['longest_pain_streak']:
                stats['longest_pain_streak'] = pain_streak
            if score < stats['max_negative']:
                stats['max_negative'] = score
        else:
            stats['neutral_spins'] += 1
            joy_streak = 0
            pain_streak = 0
        
        if r['win'] >= r['bet'] * 3:
            stats['big_wins_count'] += 1
        
        if r['factors']['surprise_factor'] > 0:
            stats['scare_spins'] += 1
    
    stats['avg_emotion'] /= len(results)
    
    # Дисперсия эмоций
    variance_sum = sum((r['emotional_score'] - stats['avg_emotion']) ** 2 for r in results)
    stats['emotion_variance'] = variance_sum / len(results)
    
    return stats

def generate_report(results, total_bet, total_win):
    """Генерирует подробный отчет"""
    
    print("=" * 80)
    print("🎰 ЭМОЦИОНАЛЬНЫЙ АНАЛИЗ ИГРОВОГО ПРОЦЕССА")
    print("=" * 80)
    print()
    
    # Общая статистика
    stats = analyze_emotional_patterns(results)
    
    print("📊 ОБЩАЯ СТАТИСТИКА:")
    print(f"   Всего спинов: {stats['total_spins']}")
    print(f"   Общая ставка: {total_bet:,}")
    print(f"   Общий выигрыш: {total_win:,}")
    rtp = (total_win / total_bet) * 100 if total_bet > 0 else 0
    print(f"   RTP: {rtp:.2f}%")
    print()
    
    # Эмоциональная статистика
    print("😊 ЭМОЦИОНАЛЬНАЯ СТАТИСТИКА:")
    print(f"   Позитивные спины (score ≥ 0.3): {stats['positive_spins']} ({stats['positive_spins']/len(results)*100:.1f}%)")
    print(f"   Негативные спины (score ≤ -0.3): {stats['negative_spins']} ({stats['negative_spins']/len(results)*100:.1f}%)")
    print(f"   Нейтральные спины: {stats['neutral_spins']} ({stats['neutral_spins']/len(results)*100:.1f}%)")
    print()
    
    print("📈 ЭМОЦИОНАЛЬНЫЕ ПАТТЕРНЫ:")
    print(f"   Средняя эмоциональность: {stats['avg_emotion']:.3f}")
    print(f"   Дисперсия эмоций: {stats['emotion_variance']:.3f}")
    print(f"   Максимальный позитив: {stats['max_positive']:.3f}")
    print(f"   Минимальный негатив: {stats['max_negative']:.3f}")
    print()
    
    print("🔥 СЕРИИ:")
    print(f"   longest_joy_streak: {stats['longest_joy_streak']}")
    print(f"   longest_pain_streak: {stats['longest_pain_streak']}")
    print()
    
    print("💰 КРУПНЫЕ ВЫИГРЫШИ:")
    print(f"   Выигрыши x3+ от ставки: {stats['big_wins_count']}")
    print(f"   Неожиданные крупные выигрыши: {stats['scare_spins']}")
    print()
    
    # Примеры самых эмоциональных моментов
    print("🌟 ТОП-5 САМЫХ ПОЗИТИВНЫХ МОМЕНТОВ:")
    top_positive = sorted(results, key=lambda x: x['emotional_score'], reverse=True)[:5]
    for i, r in enumerate(top_positive, 1):
        print(f"   {i}. Спин #{r['index']+1}: {r['emotion_label']}")
        print(f"      Ставка: {r['bet']}, Выигрыш: {r['win']}, Score: {r['emotional_score']:.3f}")
        print(f"      Баланс: {r['balance']}")
        print()
    
    print("😤 ТОП-5 САМЫХ НЕГАТИВНЫХ МОМЕНТОВ:")
    top_negative = sorted(results, key=lambda x: x['emotional_score'])[:5]
    for i, r in enumerate(top_negative, 1):
        print(f"   {i}. Спин #{r['index']+1}: {r['emotion_label']}")
        print(f"      Ставка: {r['bet']}, Выигрыш: {r['win']}, Score: {r['emotional_score']:.3f}")
        print(f"      Баланс: {r['balance']}")
        print()
    
    # Анализ волатильности
    print("📊 АНАЛИЗ ВОЛАТИЛЬНОСТИ:")
    high_volatility = [r for r in results if abs(r['emotional_score']) >= 0.5]
    low_volatility = [r for r in results if abs(r['emotional_score']) < 0.2]
    
    print(f"   Высокая эмоциональность (|score| ≥ 0.5): {len(high_volatility)} ({len(high_volatility)/len(results)*100:.1f}%)")
    print(f"   Низкая эмоциональность (|score| < 0.2): {len(low_volatility)} ({len(low_volatility)/len(results)*100:.1f}%)")
    print()
    
    # Вывод
    print("💡 ВЫВОДЫ:")
    if stats['avg_emotion'] > 0.1:
        print("   ✅ Игра вызывает в целом позитивные эмоции!")
    elif stats['avg_emotion'] > -0.1:
        print("   ⚖️ Эмоциональный баланс нейтральный")
    else:
        print("   ⚠️ Игра может вызывать негативные эмоции")
    
    if stats['longest_pain_streak'] > 10:
        print(f"   ⚠️ Длинные серии проигрышей ({stats['longest_pain_streak']}+) могут разочаровывать игроков")
    
    if stats['big_wins_count'] > len(results) * 0.05:
        print(f"   🎉 Частые крупные выигрыши ({stats['big_wins_count']}) поддерживают интерес")
    
    print()
    print("=" * 80)

if __name__ == "__main__":
    # Загрузка данных
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    print("Загрузка журнала...")
    spins = load_journal('journal.jsonl')
    print(f"   Найдено {len(spins)} спинов")
    
    # Расчет эмоциональных score
    print("Расчет эмоциональных score...")
    results, total_bet, total_win = calculate_emotional_score(spins, window_size=10)
    
    # Генерация отчета
    generate_report(results, total_bet, total_win)
    
    # Сохранение детальных результатов
    output_file = 'emotional_analysis.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'results': results,
            'summary': {
                'total_spins': len(results),
                'total_bet': total_bet,
                'total_win': total_win,
                'rtp': (total_win / total_bet) * 100 if total_bet > 0 else 0
            }
        }, f, ensure_ascii=False, indent=2)
    
    print(f"\nДетальные результаты сохранены в {output_file}")
