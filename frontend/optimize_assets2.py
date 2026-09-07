#!/usr/bin/env python3
"""
ВТОРОЙ ПРОХОД: ужимаем 'псевдо-SVG' (содержат ТОЛЬКО растровый слой PNG/JPEG,
без векторных path). Такие файлы фактически являются растровыми картинками
в SVG-обёртке - реальной векторной масштабируемости у них нет.
Уменьшаем встроенный растр до MAX_DIM и перекодируем в PNG (потеря качества
фона незаметна при типичном отображении символа).
Формат .svg, прозрачность и структура сохраняются.
"""
import os, re, base64, io, sys
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

ASSETS = os.path.join(os.getcwd(), 'public', 'assets')
BACKUP = os.path.join(os.getcwd(), 'public_assets_backup')
MAX_DIM = 1024          # максимальное разрешение встроенного растра
MIN_GAIN = 1024 * 100   # требуемая экономия 100КБ
max_file_size = 500 * 1024  # обрабатываем только SVG > 500КБ

count = 0
saved = 0

def backup_file(path):
    rel = os.path.relpath(path, ASSETS)
    dst = os.path.join(BACKUP, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if not os.path.exists(dst):
        import shutil
        shutil.copy2(path, dst)

def has_vector_paths(s):
    """Есть ли в SVG реальные векторные пути (path/чтобы не трогать)."""
    return bool(re.search(r'<path[\s>]', s))

for root, dirs, files in os.walk(ASSETS):
    for fn in sorted(files):
        if not fn.lower().endswith('.svg'):
            continue
        fp = os.path.join(root, fn)
        size = os.path.getsize(fp)
        if size < max_file_size:
            continue
        s = open(fp, 'r', encoding='utf-8', errors='replace').read()

        # Пропускаем настоящие векторные SVG (с путями) - их не дожимаем
        if has_vector_paths(s):
            # но фоновый растр вдоль вектора уменьшать не будем
            continue

        m = re.search(r'<image[^>]*xlink:href="data:image/(\w+);base64,([A-Za-z0-9+/=]+)"', s)
        if not m:
            m = re.search(r'(data:image/(\w+);base64,)([A-Za-z0-9+/=]+)', s)
            if not m:
                continue
        fmt = (m.group(1) if 'data:' in m.group(1) else m.group(2)).lower() \
            if m.lastindex and 'data:' in m.group(0) else None
        # проще: извлечём через regex
        mm = re.search(r'data:image/(\w+);base64,([A-Za-z0-9+/=]+)', s)
        if not mm:
            continue
        fmt2 = mm.group(1).lower()
        b64 = mm.group(2)
        raw = base64.b64decode(b64)
        try:
            im = Image.open(io.BytesIO(raw))
            im.load()
        except Exception as e:
            print(f'[SKIP!] {os.path.relpath(fp, ASSETS)}: {e}')
            continue

        orig_size = len(raw)
        w, h = im.size
        # Масштабируем, если выходит за MAX_DIM
        scale = min(1.0, MAX_DIM / max(w, h))
        if scale < 1.0:
            nw, nh = int(w*scale), int(h*scale)
            im2 = im.resize((nw, nh), Image.LANCZOS)
        else:
            im2 = im

        # Сохраняем с прозрачностью (PNG)
        buf = io.BytesIO()
        if im2.mode in ('RGBA', 'LA', 'P'):
            im2.save(buf, 'PNG', optimize=True)
        else:
            im2.convert('RGBA').save(buf, 'PNG', optimize=True)

        new_raw = buf.getvalue()
        new_size = len(new_raw)

        # Экономия в размере всего SVG (меняется только base64-блок)
        delta = len(b64) - len(base64.b64encode(new_raw).decode('ascii'))

        if delta > MIN_GAIN:
            backup_file(fp)
            new_svg = s.replace('data:image/%s;base64,%s' % (fmt2, b64),
                                'data:image/png;base64,%s' % base64.b64encode(new_raw).decode('ascii'))
            with open(fp, 'w', encoding='utf-8') as f:
                f.write(new_svg)
            count += 1
            saved += delta
            print(f'[<] {os.path.relpath(fp, ASSETS)}: {size/1e6:.2f}MB -> '
                  f'{os.path.getsize(fp)/1e6:.2f}MB (растр {w}x{h} -> {nw}x{nh})')
        else:
            print(f'[=] {os.path.relpath(fp, ASSETS)}: экономия мала, пропуск')

print(f'\nДожато файлов: {count}')
print(f'Общая экономия: {saved/1e6:.2f} МБ')