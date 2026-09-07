#!/usr/bin/env python3
"""
Оптимизация изображений в frontend/public/assets

Делает бэкап, затем:
- PNG  -> реоптимизация через Pillow (сохранение прозрачности, lossless)
- JPG  -> пересжатие с quality=80
- SVG  -> с редактируемым встроенным JPEG: пересжатие растра с quality=72
          (векторная структура SVG и масштабируемость НЕ меняются)
Все картинки проверим: если сжатый вариант больше исходного - оставляем оригинал.
"""
import os, shutil, re, base64, io, sys
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

ASSETS = os.path.join(os.getcwd(), 'public', 'assets')
if not os.path.isdir(ASSETS):
    print(f'ASSETS не найден: {ASSETS}')
    sys.exit(1)

BACKUP = os.path.join(os.getcwd(), 'public_assets_backup')
JPEG_Q = 80          # для обычных JPG
SVG_JPEG_Q = 72     # для встроенных JPEG внутри SVG
MIN_GAIN = 1024     # порог экономии (1 КБ), чтобы не трогать мелочь

MANY_EXT = {'.png', '.jpg', '.jpeg', '.webp', '.svg'}
count = 0
saved = 0
skipped_png = 0

def backup_file(path):
    rel = os.path.relpath(path, ASSETS)
    dst = os.path.join(BACKUP, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if not os.path.exists(dst):
        shutil.copy2(path, dst)

def opt_png(fp):
    """Реоптимизация PNG lossless (по возможности)."""
    global saved
    orig = os.path.getsize(fp)
    backup_file(fp)
    try:
        im = Image.open(fp)
        im.load()
        # Сохраняем палитровые как есть; RGBA -> RGBA; RGB -> RGB
        buf = io.BytesIO()
        if im.mode in ('P', 'RGBA', 'LA', 'PA'):
            try:
                im.save(buf, 'PNG', optimize=True)
            except Exception:
                im2 = im.convert('RGBA')
                im2.save(buf, 'PNG', optimize=True)
        else:
            im.save(buf, 'PNG', optimize=True)
        new_size = len(buf.getvalue())
        if new_size + MIN_GAIN < orig:
            with open(fp, 'wb') as f:
                f.write(buf.getvalue())
            print(f'  [PNG] {os.path.relpath(fp, ASSETS)} {orig/1e6:.2f}MB -> {new_size/1e6:.2f}MB (экономия {(orig-new_size)/1e3:.0f}КБ)')
            saved += orig - new_size
            return True
        else:
            print(f'  [PNG=] {os.path.relpath(fp, ASSETS)} (не выгодно)')
    except Exception as e:
        print(f'  [PNG!] {os.path.relpath(fp, ASSETS)}: {e}')

def opt_jpg(fp, quality=JPEG_Q):
    """Пересжатие JPG."""
    global saved
    orig = os.path.getsize(fp)
    backup_file(fp)
    try:
        im = Image.open(fp)
        im.load()
        if im.mode != 'RGB':
            im = im.convert('RGB')
        buf = io.BytesIO()
        im.save(buf, 'JPEG', quality=quality, optimize=True, progressive=True)
        new_size = len(buf.getvalue())
        if new_size + MIN_GAIN < orig:
            with open(fp, 'wb') as f:
                f.write(buf.getvalue())
            print(f'  [JPG] {os.path.relpath(fp, ASSETS)} {orig/1e6:.2f}MB -> {new_size/1e6:.2f}MB')
            saved += orig - new_size
            return True
        else:
            print(f'  [JPG=] {os.path.relpath(fp, ASSETS)} (не выгодно)')
    except Exception as e:
        print(f'  [JPG!] {os.path.relpath(fp, ASSETS)}: {e}')

def opt_svg_with_raster(fp):
    """
    Если в SVG есть встроенный JPEG/PNG base64 - пересжимаем растр.
    Векторная структура и масштабируемость SVG сохраняются.
    """
    global saved
    orig = os.path.getsize(fp)
    try:
        s = open(fp, 'r', encoding='utf-8', errors='replace').read()
        m = re.search(r'(data:image/(\w+);base64,)([A-Za-z0-9+/=]+)', s)
        if not m:
            return False
        prefix, fmt, b64 = m.group(1), m.group(2).lower(), m.group(3)
        raw = base64.b64decode(b64)
        im = Image.open(io.BytesIO(raw))
        im.load()

        if fmt in ('jpeg', 'jpg'):
            if im.mode != 'RGB':
                im = im.convert('RGB')
            buf = io.BytesIO()
            im.save(buf, 'JPEG', quality=SVG_JPEG_Q, optimize=True, progressive=True)
            new_prefix = 'data:image/jpeg;base64,'
        else:  # png внутри svg
            if im.mode in ('P', 'RGBA'):
                buf = io.BytesIO()
                im.save(buf, 'PNG', optimize=True)
            else:
                buf = io.BytesIO()
                im.save(buf, 'PNG', optimize=True)
            new_prefix = 'data:image/png;base64,'

        new_b64 = base64.b64encode(buf.getvalue()).decode('ascii')
        new_svg_size = orig - (len(b64) - len(new_b64))

        if new_svg_size + MIN_GAIN < orig:
            new_s = s.replace(prefix + b64, new_prefix + new_b64)
            backup_file(fp)
            with open(fp, 'w', encoding='utf-8') as f:
                f.write(new_s)
            print(f'  [SVG] {os.path.relpath(fp, ASSETS)} {orig/1e6:.2f}MB -> {new_svg_size/1e6:.2f}MB')
            saved += orig - new_svg_size
            return True
        else:
            print(f'  [SVG=] {os.path.relpath(fp, ASSETS)} (не выгодно)')
    except Exception as e:
        print(f'  [SVG!] {os.path.relpath(fp, ASSETS)}: {e}')

if __name__ == '__main__':
    print(f'ASSETS: {ASSETS}')
    print(f'BACKUP: {BACKUP}')
    opts = [a for a in sys.argv[1:] if a in ('--dry-run',)]
    dry = '--dry-run' in opts

    if dry:
        print('ДЕМО-РЕЖИМ (--dry-run): ничего не записываем, только анализ')
    else:
        print('БОЕВОЙ РЕЖИМ: делаем бэкап и перезаписываем файлы')

    for root, dirs, files in os.walk(ASSETS):
        if 'public_assets_backup' in root or 'public_assets_backup' in str(root):
            continue
        for fn in sorted(files):
            ext = os.path.splitext(fn)[1].lower()
            if ext not in MANY_EXT:
                continue
            fp = os.path.join(root, fn)
            if dry:
                size = os.path.getsize(fp)
                print(f'  [параметры] {os.path.relpath(fp, ASSETS)} - {size/1e6:.2f}MB')
                continue
            if ext == '.png':
                opt_png(fp)
            elif ext in ('.jpg', '.jpeg'):
                opt_jpg(fp)
            elif ext == '.svg':
                opt_svg_with_raster(fp)
            elif ext == '.webp':
                pass

    print(f'\nИтого сэкономлено: {saved/1e6:.2f} МБ')
    print(f'Бэкап сохранён в: {BACKUP}')