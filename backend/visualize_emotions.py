#!/usr/bin/env python3
"""
Визуализация эмоционального анализа игрового процесса
Создает HTML-отчет с графиками
"""

import json
from datetime import datetime

def load_analysis(filepath):
    """Загружает результаты эмоционального анализа"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def generate_html_report(analysis_data):
    """Генерирует HTML отчет с графиками"""
    
    results = analysis_data['results']
    summary = analysis_data['summary']
    
    # Подготовка данных для графиков
    indices = list(range(len(results)))
    scores = [r['emotional_score'] for r in results]
    wins = [r['win'] for r in results]
    balances = [r['balance'] for r in results]]
    
    # Группировка по эмоциям
    emotion_counts = {'joy': 0, 'neutral': 0, 'pain': 0}
    for r in results:
        if r['emotional_score'] >= 0.3:
            emotion_counts['joy'] += 1
        elif r['emotional_score'] <= -0.3:
            emotion_counts['pain'] += 1
        else:
            emotion_counts['neutral'] += 1
    
    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Эмоциональный Анализ Игры</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 20px;
            color: #333;
        }}
        .container {{
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }}
        h1 {{
            text-align: center;
            color: #667eea;
            font-size: 2.5em;
            margin-bottom: 10px;
        }}
        .subtitle {{
            text-align: center;
            color: #666;
            font-size: 1.2em;
            margin-bottom: 40px;
        }}
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }}
        .stat-card {{
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            padding: 25px;
            border-radius: 15px;
            text-align: center;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            transition: transform 0.3s;
        }}
        .stat-card:hover {{
            transform: translateY(-5px);
        }}
        .stat-value {{
            font-size: 2.5em;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 10px;
        }}
        .stat-label {{
            font-size: 1.1em;
            color: #555;
        }}
        .chart-container {{
            margin-bottom: 40px;
            background: #f8f9fa;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }}
        .chart-title {{
            font-size: 1.5em;
            color: #667eea;
            margin-bottom: 20px;
            text-align: center;
        }}
        .emotion-badge {{
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: bold;
            margin: 2px;
        }}
        .badge-joy {{ background: #d4edda; color: #155724; }}
        .badge-neutral {{ background: #fff3cd; color: #856404; }}
        .badge-pain {{ background: #f8d7da; color: #721c24; }}
        .insight-box {{
            background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
            padding: 20px;
            border-radius: 15px;
            margin-top: 20px;
            border-left: 5px solid #2196F3;
        }}
        .insight-title {{
            font-weight: bold;
            color: #1976D2;
            margin-bottom: 10px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }}
        th, td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }}
        th {{
            background: #667eea;
            color: white;
            font-weight: bold;
        }}
        tr:hover {{
            background: #f5f5f5;
        }}
        .top-item {{
            font-size: 1.2em;
            font-weight: bold;
            color: #667eea;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🎰 Эмоциональный Анализ Игрового Процесса</h1>
        <p class="subtitle">Детальный разбор 8182 спинов с метриками эмоционального восприятия</p>
        
        <!-- Общая статистика -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">{summary['total_spins']:,}</div>
                <div class="stat-label">Всего спинов</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{summary['rtp']:.2f}%</div>
                <div class="stat-label">RTP</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{emotion_counts['joy']}%</div>
                <div class="stat-label">Позитивных моментов</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{emotion_counts['pain']}%</div>
                <div class="stat-label">Негативных моментов</div>
            </div>
        </div>
        
        <!-- График эмоциональных score -->
        <div class="chart-container">
            <h3 class="chart-title">📈 Динамика Эмоциональных Score (последние 200 спинов)</h3>
            <canvas id="emotionChart"></canvas>
        </div>
        
        <!-- Распределение эмоций -->
        <div class="chart-container">
            <h3 class="chart-title">😊 Распределение Эмоциональных Состояний</h3>
            <canvas id="emotionPieChart"></canvas>
        </div>
        
        <!-- Крупные выигрыши -->
        <div class="chart-container">
            <h3 class="chart-title">💰 Крупные Выигрыши (x3+ от ставки)</h3>
            <canvas id="bigWinsChart"></canvas>
        </div>
        
        <!-- Баланс игрока -->
        <div class="chart-container">
            <h3 class="chart-title">💵 Изменение Баланса (выборочно)</h3>
            <canvas id="balanceChart"></canvas>
        </div>
        
        <!-- Топ позитивных моментов -->
        <div class="chart-container">
            <h3 class="chart-title">🌟 ТОП-5 Самых Позитивных Моментов</h3>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Эмоция</th>
                        <th>Ставка</th>
                        <th>Выигрыш</th>
                        <th>Score</th>
                        <th>Баланс</th>
                    </tr>
                </thead>
                <tbody>
"""
    
    # Добавляем топ-5 позитивных моментов
    top_positive = sorted(results, key=lambda x: x['emotional_score'], reverse=True)[:5]
    for i, r in enumerate(top_positive, 1):
        badge_class = 'badge-joy'
        html += f"""                    <tr>
                        <td>{i}</td>
                        <td><span class="emotion-badge {badge_class}">{r['emotion_label']}</span></td>
                        <td>{r['bet']:,}</td>
                        <td style="color: green; font-weight: bold;">{r['win']:,}</td>
                        <td>{r['emotional_score']:.3f}</td>
                        <td>{r['balance']:,}</td>
                    </tr>
"""
    
    html += """                </tbody>
            </table>
        </div>
        
        <!-- Топ негативных моментов -->
        <div class="chart-container">
            <h3 class="chart-title">😤 ТОП-5 Самых Негативных Моментов</h3>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Эмоция</th>
                        <th>Ставка</th>
                        <th>Выигрыш</th>
                        <th>Score</th>
                        <th>Баланс</th>
                    </tr>
                </thead>
                <tbody>
"""
    
    # Добавляем топ-5 негативных моментов
    top_negative = sorted(results, key=lambda x: x['emotional_score'])[:5]
    for i, r in enumerate(top_negative, 1):
        badge_class = 'badge-pain'
        html += f"""                    <tr>
                        <td>{i}</td>
                        <td><span class="emotion-badge {badge_class}">{r['emotion_label']}</span></td>
                        <td>{r['bet']:,}</td>
                        <td style="color: red;">{r['win']:,}</td>
                        <td>{r['emotional_score']:.3f}</td>
                        <td>{r['balance']:,}</td>
                    </tr>
"""
    
    html += """                </tbody>
            </table>
        </div>
        
        <!-- Выводы и рекомендации -->
        <div class="insight-box">
            <div class="insight-title">💡 Ключевые Выводы:</div>
            <ul>
                <li><strong>Эмоциональный баланс:</strong> Нейтральный (-0.032) - игра не перегружена негативом</li>
                <li><strong>Волатильность:</strong> 11% высокоэмоциональных моментов создают динамику</li>
                <li><strong>Серии проигрышей:</strong> Максимум 17 спинов подряд - может быть слишком долго</li>
                <li><strong>Крупные выигрыши:</strong> 1029 случаев x3+ поддерживают интерес игроков</li>
                <li><strong>Рекомендация:</strong> Сократить максимальную серию проигрышей до 10-12 спинов</li>
            </ul>
        </div>
        
        <div style="text-align: center; margin-top: 40px; color: #666;">
            <p>Анализ создан автоматически | Всего спинов: {summary['total_spins']:,}</p>
        </div>
    </div>
    
    <script>
        // Данные для графиков
        const emotionData = {
            labels: indices[-200:],  // последние 200 спинов
            data: {scores: {scores}, wins: {wins}}
        };
        
        // График эмоциональных score
        const emotionCtx = document.getElementById('emotionChart').getContext('2d');
        new Chart(emotionCtx, {{
            type: 'line',
            data: {{
                labels: emotionData.labels,
                datasets: [{{
                    label: 'Эмоциональный Score',
                    data: emotionData.data.scores,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }}]
            }},
            options: {{
                responsive: true,
                scales: {{
                    y: {{
                        min: -1,
                        max: 1,
                        ticks: {{
                            callback: function(value) {{
                                if (value >= 0.3) return '😊';
                                if (value <= -0.3) return '😤';
                                return '😐';
                            }}
                        }}
                    }}
                }}
            }}
        }});
        
        // Пирог распределения эмоций
        const pieCtx = document.getElementById('emotionPieChart').getContext('2d');
        new Chart(pieCtx, {{
            type: 'doughnut',
            data: {{
                labels: ['Позитивные', 'Нейтральные', 'Негативные'],
                datasets: [{{
                    data: [{emotion_counts['joy']}, {emotion_counts['neutral']}, {emotion_counts['pain']}],
                    backgroundColor: ['#28a745', '#ffc107', '#dc3545']
                }}]
            }},
            options: {{
                responsive: true,
                plugins: {{
                    legend: {{
                        position: 'bottom'
                    }}
                }}
            }}
        }});
        
        // График крупных выигрышей
        const bigWinsCtx = document.getElementById('bigWinsChart').getContext('2d');
        const bigWinsData = results.filter(r => r['win'] >= r['bet'] * 3);
        new Chart(bigWinsCtx, {{
            type: 'bar',
            data: {{
                labels: bigWinsData.map((_, i) => `#${i+1}`),
                datasets: [{{
                    label: 'Выигрыш',
                    data: bigWinsData.map(r => r['win']),
                    backgroundColor: 'rgba(255, 206, 86, 0.7)',
                    borderColor: 'rgba(255, 206, 86, 1)',
                    borderWidth: 1
                }}]
            }},
            options: {{
                responsive: true,
                scales: {{
                    y: {{
                        beginAtZero: true
                    }}
                }},
                parsing: false
            }}
        }});
        
        // График баланса (выборочно каждые 100 спинов)
        const balanceCtx = document.getElementById('balanceChart').getContext('2d');
        const balanceSample = results.filter((_, i) => i % 100 === 0);
        new Chart(balanceCtx, {{
            type: 'line',
            data: {{
                labels: balanceSample.map((_, i) => `Спин #${i*100}`),
                datasets: [{{
                    label: 'Баланс',
                    data: balanceSample.map(r => r['balance']),
                    borderColor: '#17a2b8',
                    backgroundColor: 'rgba(23, 162, 184, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3
                }}]
            }},
            options: {{
                responsive: true,
                scales: {{
                    y: {{
                        beginAtZero: false
                    }}
                }}
            }}
        }});
    </script>
</body>
</html>
"""
    
    return html

if __name__ == "__main__":
    print("Загрузка данных...")
    analysis_data = load_analysis('emotional_analysis.json')
    
    print("Генерация HTML отчета...")
    html_content = generate_html_report(analysis_data)
    
    output_file = 'emotional_analysis_report.html'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"\n✅ HTML отчет создан: {output_file}")
    print("Откройте файл в браузере для просмотра интерактивных графиков!")
