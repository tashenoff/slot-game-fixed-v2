with open('e:/slot-game-fixed-v2/backend/app.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()
print('Total lines:', len(lines))
for i in range(354, min(430, len(lines))):
    print(f'{i+1}:{lines[i]}', end='')