with open(r'e:\slot-game-fixed-v2\backend\app.py', 'r', encoding='utf-8') as f:
    content = f.read()
# Find the relevant sections
import re
# Print lines 415-445
lines = content.split('\n')
for i in range(414, min(445, len(lines))):
    print(f'{i+1}:|{lines[i]}|')
with open(r'e:\slot-game-fixed-v2\backend\app.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i in range(374, 445):
    if i < len(lines):
        line = lines[i]
        print(f'{i+1}:|{repr(line)}|', end='')
with open(r'e:\slot-game-fixed-v2\backend\app.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i in range(425, min(475, len(lines))):
    print(f'{i+1}:{lines[i]}', end='')