#!/usr/bin/env python3
"""
Простой текстовый отчет с ASCII-графиками
"""

import json

def load_analysis(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def create_ascii_bar(value, max_value, width=40):
    """Создает ASCII бар-чарт"""
    if max_value == 0:
        return ""
    filled = int((value / max_value) * width)
    return "█" * filled + "░" * (width - filled)

def generate_text_report(analysis_data):
    results = analysis_data['results']
    summary = analysis_data['summary']
    
    # Подготовка данных
    scores = [r['emotional_score'] for r in results]
    wins = [r['win'] for r in results]
    
    joy_count = sum(1 for s in scores if s >= 0.3)
    neutral_count = sum(1 for s in scores if -0.3 < s < 0.3)
    pain_count = sum(1 for s in scores if s <= -0.3)
    
    report = []
    report.append("=" * 80)
    report.append("🎰 ЭМОЦИОНАЛЬНЫЙ АНАЛИЗ ИГРОВОГО ПРОЦЕССА - ТЕКСТОВЫЙ ОТЧЕТ")
    report.append("=" * 80)
    report.append("")
    
    # Общая статистика
    report.append("📊 ОБЩАЯ СТАТИСТИКА:")
    report.append("-" * 40)
    report.append(f"Всего спинов:     {summary['total_spins']:,}")
    report.append(f"Общая ставка:      {summary['total_bet']:,}")
    report.append(f"Общий выигрыш:     {summary['total_win']:,}")
    report.append(f"RTP:               {summary['rtp']:.2f}%")
    report.append("")
    
    # Распределение эмоций - ASCII bar chart
    report.append("😊 РАСПРЕДЕЛЕНИЕ ЭМОЦИЙ:")
    report.append("-" * 40)
    
    max_count = max(joy_count, neutral_count, pain_count)
    
    joy_bar = create_ascii_bar(joy_count, max_count)
    neutral_bar = create_ascii_bar(neutral_count, max_count)
    pain_bar = create_ascii_bar(pain_count, max_count)
    
    report.append(f"😊 Позитивные:   {joy_bar} {joy_count} ({joy_count/len(scores)*100:.1f}%)")
    report.append(f"😐 Нейтральные:  {neutral_bar} {neutral_count} ({neutral_count/len(scores)*100:.1f}%)")
    report.append(f"😤 Негативные:   {pain_bar} {pain_count} ({pain_count/len(scores)*100:.1f}%)")
    report.append("")
    
    # Временная динамика эмоций (выборочно каждые 500 спинов)
    report.append("📈 ДИНАМИКА ЭМОЦИЙ ПО ВРЕМЕНИ:")
    report.append("-" * 40)
    
    window_size = 500
    num_windows = min(20, len(results) // window_size)
    
    for i in range(num_windows):
        start = i * window_size
        end = start + window_size
        window_scores = [results[j]['emotional_score'] for j in range(start, end)]
        avg_score = sum(window_scores) / len(window_scores)
        
        # ASCII график
        if avg_score >= 0.3:
            emoji = "😊"
        elif avg_score <= -0.3:
            emoji = "😤"
        else:
            emoji = "😐"
        
        score_str = f"{avg_score:+.2f}"
        report.append(f"Спины {start:5d}-{end:5d}: {emoji} {score_str:>6} | {create_ascii_bar(abs(avg_score), 1, 20)}")
    
    report.append("")
    
    # Крупные выигрыши
    big_wins = [(i, r) for i, r in enumerate(results) if r['win'] >= r['bet'] * 3]
    
    report.append("💰 КРУПНЫЕ ВЫИГРЫШИ (x3+ от ставки):")
    report.append("-" * 40)
    report.append(f"Всего крупных выигрышей: {len(big_wins)}")
    report.append("")
    
    # Топ 10 крупнейших
    top_big_wins = sorted(big_wins, key=lambda x: x[1]['win'], reverse=True)[:10]
    report.append("ТОП-10 КРУПНЕЙШИХ ВЫИГРЫШЕЙ:")
    for rank, (idx, r) in enumerate(top_big_wins, 1):
        multiplier = r['win'] / r['bet'] if r['bet'] > 0 else 0
        report.append(f"  {rank}. Спин #{idx+1:5d}: Ставка {r['bet']:>6,} → Выигрыш {r['win']:>8,} (x{multiplier:.1f}) {emoji_for_score(r['emotional_score'])}")
    
    report.append("")
    
    # Серии проигрышей
    report.append("🔥 СЕРИИ ПРОИГРЫШЕЙ:")
    report.append("-" * 40)
    
    current_loss_streak = 0
    longest_streak = 0
    streak_start = 0
    longest_streak_info = None
    
    for i, r in enumerate(results):
        if r['win'] == 0:
            if current_loss_streak == 0:
                streak_start = i
            current_loss_streak += 1
            if current_loss_streak > longest_streak:
                longest_streak = current_loss_streak
                longest_streak_info = (streak_start, i)
        else:
            current_loss_streak = 0
    
    report.append(f"Длиннейшая серия проигрышей: {longest_streak} спинов")
    if longest_streak_info:
        start, end = longest_streak_info
        report.append(f"  Период: Спины #{start+1} - #{end+1}")
        report.append(f"  Потеря за серию: {(end-start+1) * 500:,} монет")
    
    report.append("")
    
    # Серии выигрышей
    report.append("🎉 СЕРИИ ВЫИГРЫШЕЙ:")
    report.append("-" * 40)
    
    current_win_streak = 0
    longest_win_streak = 0
    win_streak_start = 0
    
    for i, r in enumerate(results):
        if r['win'] > 0:
            if current_win_streak == 0:
                win_streak_start = i
            current_win_streak += 1
            if current_win_streak > longest_win_streak:
                longest_win_streak = current_win_streak
        else:
            current_win_streak = 0
    
    report.append(f"Длиннейшая серия выигрышей: {longest_win_streak} спинов")
    report.append("")
    
    # Рекомендации
    report.append("💡 РЕКОМЕНДАЦИИ ПО УЛУЧШЕНИЮ:")
    report.append("-" * 40)
    
    recommendations = []
    
    if longest_streak > 15:
        recommendations.append("⚠️ Сократить максимальную серию проигрышей (сейчас {})".format(longest_streak))
    
    if joy_count / len(scores) < 0.2:
        recommendations.append("🎯 Увеличить частоту позитивных моментов")
    
    if pain_count / len(scores) > 0.25:
        recommendations.append("🔧 Снизить интенсивность негативных моментов")
    
    if len(big_wins) / len(results) < 0.1:
        recommendations.append("✨ Добавить больше крупных выигрышей")
    
    if not recommendations:
        recommendations.append("✅ Игра сбалансирована! Можно оставить как есть.")
    
    for rec in recommendations:
        report.append(rec)
    
    report.append("")
    report.append("=" * 80)
    report.append("КОНЕЦ ОТЧЕТА")
    report.append("=" * 80)
    
    return "\n".join(report)

def emoji_for_score(score):
    if score >= 0.6:
        return "🔥"
    elif score >= 0.3:
        return "😊"
    elif score <= -0.6:
        return "😡"
    elif score <= -0.3:
        return "😤"
    else:
        return "😐"

if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    print("Загрузка данных...")
    analysis_data = load_analysis('emotional_analysis.json')
    
    print("Генерация текстового отчета...")
    report = generate_text_report(analysis_data)
    
    output_file = 'emotional_analysis_report.txt'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n[OK] Текстовый отчет сохранен: {output_file}")
    print("")
    print("=" * 80)
    print("ОТЧЕТ:")
    print("=" * 80)
    print(report)
