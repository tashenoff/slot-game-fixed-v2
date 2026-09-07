#!/usr/bin/env python3
"""
Создание графиков для визуализации эмоционального анализа
"""

import json
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')  # Неграфический бэкенд

def load_analysis(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def create_emotion_timeline(results, output_file):
    """График временной линии эмоций"""
    
    indices = list(range(len(results)))
    scores = [r['emotional_score'] for r in results]
    
    # Подсчитываем эмоции
    joy_count = sum(1 for s in scores if s >= 0.3)
    neutral_count = sum(1 for s in scores if -0.3 < s < 0.3)
    pain_count = sum(1 for s in scores if s <= -0.3)
    
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(16, 12))
    fig.suptitle('Эмоциональный Анализ Игрового Процесса', fontsize=16, fontweight='bold')
    
    # График 1: Динамика emotions (последние 500 спинов)
    last_500 = min(500, len(scores))
    ax1.plot(indices[-last_500:], scores[-last_500:], 
             color='#667eea', linewidth=1, alpha=0.7)
    ax1.axhline(y=0.3, color='green', linestyle='--', alpha=0.5, label='Позитивный')
    ax1.axhline(y=-0.3, color='red', linestyle='--', alpha=0.5, label='Негативный')
    ax1.axhline(y=0, color='gray', linestyle='-', alpha=0.3)
    ax1.set_xlabel('Спин', fontsize=10)
    ax1.set_ylabel('Эмоциональный Score', fontsize=10)
    ax1.set_title(f'Динамика Эмоций (последние {last_500} спинов)', fontsize=12, fontweight='bold')
    ax1.legend(loc='upper right')
    ax1.set_ylim(-1, 1)
    ax1.grid(True, alpha=0.3)
    
    # График 2: Распределение эмоций
    colors = ['#28a745', '#ffc107', '#dc3545']
    wedges, texts, autotexts = ax2.pie(
        [joy_count, neutral_count, pain_count],
        labels=[f'😊 Позитивные\n{joy_count} ({joy_count/len(scores)*100:.1f}%)',
                f'😐 Нейтральные\n{neutral_count} ({neutral_count/len(scores)*100:.1f}%)',
                f'😤 Негативные\n{pain_count} ({pain_count/len(scores)*100:.1f})'],
        autopct=None,
        colors=colors,
        startangle=90
    )
    ax2.set_title('Распределение Эмоциональных Состояний', fontsize=12, fontweight='bold')
    
    # График 3: Размер выигрышей
    wins = [r['win'] for r in results]
    ax3.hist(wins, bins=100, color='#17a2b8', alpha=0.7, edgecolor='black')
    ax3.set_xlabel('Размер Выигрыша', fontsize=10)
    ax3.set_ylabel('Количество Спинов', fontsize=10)
    ax3.set_title('Распределение Размеров Выигрышей', fontsize=12, fontweight='bold')
    ax3.grid(True, alpha=0.3)
    
    # График 4: Баланс игрока (выборочно)
    sample_step = max(1, len(results) // 100)
    balance_data = results[::sample_step]
    balance_values = [r['balance'] for r in balance_data]
    spin_indices = [i * sample_step for i in range(len(balance_data))]
    
    ax4.plot(spin_indices, balance_values, color='#28a745', linewidth=2)
    ax4.fill_between(spin_indices, balance_values, alpha=0.3, color='#28a745')
    ax4.set_xlabel('Спин', fontsize=10)
    ax4.set_ylabel('Баланс', fontsize=10)
    ax4.set_title('Изменение Баланса Игрока', fontsize=12, fontweight='bold')
    ax4.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig(output_file, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"✅ График сохранен: {output_file}")

def create_detailed_charts(results, output_dir='charts'):
    """Создание детальных графиков"""
    import os
    os.makedirs(output_dir, exist_ok=True)
    
    # График 1: Временная линия эмоций
    create_emotion_timeline(results, os.path.join(output_dir, 'emotion_timeline.png'))
    
    # График 2: Heatmap эмоций по времени
    create_heatmap_chart(results, os.path.join(output_dir, 'emotion_heatmap.png'))
    
    # График 3: Корреляция ставки и выигрыша
    create_correlation_chart(results, os.path.join(output_dir, 'bet_win_correlation.png'))

def create_heatmap_chart(results, output_file):
    """Heatmap эмоций по времени"""
    
    # Разбиваем на временные окна
    window_size = 100
    num_windows = len(results) // window_size
    
    avg_scores = []
    for i in range(num_windows):
        start = i * window_size
        end = start + window_size
        window_scores = [results[j]['emotional_score'] for j in range(start, end)]
        avg_scores.append(sum(window_scores) / len(window_scores))
    
    fig, ax = plt.subplots(figsize=(14, 6))
    
    # Создаем heatmap
    im = ax.imshow([avg_scores], aspect='auto', cmap='RdYlGn', vmin=-1, vmax=1)
    
    ax.set_xlabel('Время (окна по 100 спинов)', fontsize=10)
    ax.set_ylabel('Средний Score', fontsize=10)
    ax.set_title('Heatmap: Средние Эмоциональные Score по Времени', fontsize=12, fontweight='bold')
    
    # Добавляем цветовую шкалу
    cbar = plt.colorbar(im, ax=ax)
    cbar.set_label('Эмоциональный Score', rotation=90)
    
    # Отметки границ
    ax.axhline(y=0.3, color='green', linestyle='--', alpha=0.5)
    ax.axhline(y=-0.3, color='red', linestyle='--', alpha=0.5)
    
    plt.tight_layout()
    plt.savefig(output_file, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"✅ Heatmap сохранен: {output_file}")

def create_correlation_chart(results, output_file):
    """Корреляция между ставкой и выигрышем"""
    
    bets = [r['bet'] for r in results]
    wins = [r['win'] for r in results]
    
    # Фильтруем только выигрышные спины
    winning_spins = [(b, w) for b, w in zip(bets, wins) if w > 0]
    if winning_spins:
        win_bets = [x[0] for x in winning_spins]
        win_wins = [x[1] for x in winning_spins]
        
        fig, ax = plt.subplots(figsize=(10, 8))
        
        # Scatter plot
        ax.scatter(win_bets, win_wins, alpha=0.3, s=10, color='#667eea')
        
        # Линия тренда
        z = np.polyfit(win_bets, win_wins, 1)
        p = np.poly1d(z)
        ax.plot(win_bets, p(win_bets), "r--", alpha=0.8, linewidth=2, label='Тренд')
        
        ax.set_xlabel('Ставка', fontsize=10)
        ax.set_ylabel('Выигрыш', fontsize=10)
        ax.set_title('Корреляция: Ставка vs Выигрыш', fontsize=12, fontweight='bold')
        ax.legend()
        ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig(output_file, dpi=150, bbox_inches='tight')
        plt.close()
        print(f"✅ Корреляционный график сохранен: {output_file}")

if __name__ == "__main__":
    print("Загрузка данных...")
    analysis_data = load_analysis('emotional_analysis.json')
    results = analysis_data['results']
    
    print("Создание графиков...")
    create_detailed_charts(results)
    
    print("\n✅ Все графики созданы в папке 'charts/'")
    print("Откройте файлы для просмотра!")
