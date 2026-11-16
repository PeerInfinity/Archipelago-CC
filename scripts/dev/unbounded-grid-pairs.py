#!/usr/bin/env python3
"""unbounded-grid-pairs — compose the survey's side-by-side PNGs (box | huge box) from the shots
`unbounded-grid-shots.mjs` wrote, each half scaled to the same display height (700 px): the two
halves are the WHOLE map at the same height, so the cell size differs between them (that is the
point: the huge-box map is mostly empty cells).

  python3 scripts/dev/unbounded-grid-pairs.py <dir>
Writes <dir>/pair-<name>.png for each <name>-box.png + <name>-huge.png, and shrinks any shot
wider than 2400 px in place (the ALTTP huge-box shot is 10560 px wide at 1 px per tile).
"""
import glob
import os
import sys

from PIL import Image, ImageDraw

Image.MAX_IMAGE_PIXELS = None
d = sys.argv[1]
for f in glob.glob(os.path.join(d, '*.png')):
    im = Image.open(f)
    if im.width > 2400 and not os.path.basename(f).startswith('pair-'):
        s = 2400 / im.width
        im.resize((2400, round(im.height * s)), Image.LANCZOS).save(f, optimize=True)
        print('shrunk', f, im.size, '->', 2400)

for box in sorted(glob.glob(os.path.join(d, '*-box.png'))):
    name = os.path.basename(box)[:-len('-box.png')]
    huge = os.path.join(d, f'{name}-huge.png')
    if not os.path.exists(huge):
        continue
    a, b = Image.open(box).convert('RGB'), Image.open(huge).convert('RGB')
    H = 700
    a2 = a.resize((max(1, round(a.width * H / a.height)), H), Image.LANCZOS if a.height > H else Image.NEAREST)
    b2 = b.resize((max(1, round(b.width * H / b.height)), H), Image.LANCZOS)
    W = a2.width + b2.width + 30
    out = Image.new('RGB', (W, H + 40), 'white')
    out.paste(a2, (0, 30))
    out.paste(b2, (a2.width + 30, 30))
    dr = ImageDraw.Draw(out)
    dr.text((4, 6), f'{name}: TODAY (committed box)', fill='black')
    dr.text((a2.width + 34, 6), f'{name}: HUGE BOX 2N+1 (start centred; teleport targets uniform over the box)', fill='black')
    out.save(os.path.join(d, f'pair-{name}.png'), optimize=True)
    print('pair', name, out.size)
