from PIL import Image

mobile = Image.open('e:/slot-game-fixed-v2/frontend/public/assets/themes/aztec/bg_mini.png')
if mobile.mode != 'RGBA': mobile = mobile.convert('RGBA')
wm, hm = mobile.size
print(f'Mobile frame: {wm}x{hm}')
print(f'Center Y: {hm//2}')

# Find gradient changes on left pillar
print('\n=== LEFT PILLAR GRADIENT ===')
for scan_x in [70, 90, 110, 130]:
    print(f'\nX={scan_x}:')
    prev_b = None
    for y in range(650, 950):
        r, g, b, a = mobile.getpixel((scan_x, y))
        if a < 10: prev_b = None; continue
        bright = (r + g + b) / 3
        if prev_b is not None and abs(bright - prev_b) > 12:
            d = 'UP' if bright > prev_b else 'DOWN'
            print(f'  Y={y}: {bright:.0f} ({d}) RGB({r},{g},{b})')
        prev_b = bright

print('\n=== RIGHT PILLAR GRADIENT ===')
for scan_x in [990, 1020, 1050, 1080]:
    print(f'\nX={scan_x}:')
    prev_b = None
    for y in range(650, 950):
        r, g, b, a = mobile.getpixel((scan_x, y))
        if a < 10: prev_b = None; continue
        bright = (r + g + b) / 3
        if prev_b is not None and abs(bright - prev_b) > 12:
            d = 'UP' if bright > prev_b else 'DOWN'
            print(f'  Y={y}: {bright:.0f} ({d}) RGB({r},{g},{b})')
        prev_b = bright

# Check proposed torch locations
print('\n\n=== TORCH CANDIDATES ===')
candidates = [
    ('L1', 110, 760), ('L2', 90, 775), ('L3', 110, 780), ('L4', 110, 800),
    ('R1', 1020, 760), ('R2', 1030, 775), ('R3', 1020, 780), ('R4', 1020, 800),
    ('L5', 110, 830), ('L6', 100, 840), ('R5', 1020, 830), ('R6', 1030, 840),
]
for label, x, y in candidates:
    r, g, b, a = mobile.getpixel((x, y))
    print(f'  {label}: X={x}, Y={y} RGB({r},{g},{b})')