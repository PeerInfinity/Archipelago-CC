#!/usr/bin/env node
// rules-l77-suit-alone-witness: FlashPunk's World.collideLine (net/flashpunk/World.as:411-500, int arguments, Number
// (IEEE double) stepping, Entity.collidePoint half-open rects) and LavaTrap.as:81-88 (int(FP.distance) <= chompRange 32,
// the ray from the trap's centre to the player's position truncated to int), over every integer player position of a
// tile. Solids = the level's wall tiles (the playthrough grid's `wall` cells), 16x16 each. Prints the positions the trap
// can launch at.   node fpline.mjs [level=77] [trapTx,trapTy=6,12] [tile tx,ty=4,11]
const m = await import(new URL('../../../../../scripts/procgen/make-seedling-playthrough-rules.mjs', import.meta.url).pathname);
const level = Number(process.argv[2] ?? 77);
const [ttx, tty] = (process.argv[3] ?? '6,12').split(',').map(Number);
const [qx, qy] = (process.argv[4] ?? '4,11').split(',').map(Number);
const L = m.PLAYTHROUGH_MAP.levels.find((l) => l.level === level);
const g = m.playthroughGridFor(L);
const walls = [];
for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) if (g.cells[y * g.width + x].kind === 'wall') walls.push([x * 16, y * 16]);
const solidAt = (px, py) => walls.some(([wx, wy]) => px >= wx && py >= wy && px < wx + 16 && py < wy + 16);
export function collideLine(fromX, fromY, toX, toY) { // ints in, as World.as
    fromX |= 0; fromY |= 0; toX |= 0; toY |= 0;
    if (Math.hypot(toX - fromX, toY - fromY) < 1) return solidAt(fromX, toY);
    const xDelta = Math.abs(toX - fromX), yDelta = Math.abs(toY - fromY);
    let xSign = toX > fromX ? 1 : -1, ySign = toY > fromY ? 1 : -1, x = fromX, y = fromY;
    if (xDelta > yDelta) {
        ySign *= yDelta / xDelta;
        if (xSign > 0) { while (x < toX) { if (solidAt(x, y)) return true; x += xSign; y += ySign; } }
        else { while (x > toX) { if (solidAt(x, y)) return true; x += xSign; y += ySign; } }
    } else {
        xSign *= xDelta / yDelta;
        if (ySign > 0) { while (y < toY) { if (solidAt(x, y)) return true; x += xSign; y += ySign; } }
        else { while (y > toY) { if (solidAt(x, y)) return true; x += xSign; y += ySign; } }
    }
    return solidAt(toX, toY);
}
const cx = ttx * 16 + 8, cy = tty * 16 + 8;
const rows = [];
let clear = 0, n = 0;
for (let py = qy * 16; py < qy * 16 + 16; py++) {
    let s = `${py} `;
    for (let px = qx * 16; px < qx * 16 + 16; px++) {
        n++;
        const inRange = Math.floor(Math.hypot(px - cx, py - cy)) <= 32;
        const c = inRange && !collideLine(cx, cy, px, py);
        if (c) { clear++; rows.push([px, py]); }
        s += c ? 'P' : inRange ? 'b' : '.';
    }
    console.log(s);
}
console.log(`trap (${ttx},${tty}) centre (${cx},${cy}); tile (${qx},${qy}): ${clear}/${n} integer positions launch (P), b = in range but the ray hits a Solid, . = out of range`);
console.log('launch positions:', JSON.stringify(rows));
