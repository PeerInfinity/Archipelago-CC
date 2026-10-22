// W0 census, the player's swing (`Player.slash`, `Player.as:905-918`) — fidelity MASKS.
// For every level holding a "Solid" pixelmask and a swing target: (player P, target point E) pairs where the game's
// gates pass — `collideRectInto` (inclusive) of the slash rect for some direction, `distanceRectPoint(P, box) <= reach` —
// for the NORMAL swing (16x32, reach 16) and the DASH swing (24x20.8, reach 24), and the line P→E is clear on the BOXES
// but blocked by a MASK pixel (`collidePoint` → `Pixelmask`). Static targets at their entity point; a MOVER (row speed>0)
// at every free position within 40 px of a mask's rect (its box free of the player's solids — an approximation of where it
// can stand; a 2 px grid). Waived: type Solid/Rope, `is Flyer`, a Tree (`Tree.hit` is empty), a LightPole (`genericHit` acts on
// "Spear" only; a ghost swing waives the line), a text-less Watcher (`Watcher.hit` needs `text != ""`).
import { atlasLevelSource, loadAtlas } from '../../../../frontend/modules/seedlingDemo/levelSource.js';
import { buildLevelWorld, combatCensusOf, ENTITY_CLASSES, ROLES, maskHitsBox, PRESS_BOX_OVERRIDES } from '../../../../frontend/modules/seedlingDemo/levelWorld.js';
import { playerBoxAt } from '../../../../frontend/modules/seedlingDemo/playerPhysicsV2.js';
import { slashRect, distanceRectPoint } from '../../../../frontend/modules/seedlingDemo/presses.js';
import { SLASH_SCALE_NORMAL, SLASH_SCALE_DASH } from '../../../../frontend/modules/seedlingDemo/combatVerbs.js';
const src = atlasLevelSource();
const atlas = loadAtlas();
const levels = Object.keys(atlas.levels ?? atlas).filter((k) => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
const SCALES = [['normal', SLASH_SCALE_NORMAL, 16], ['dash', SLASH_SCALE_DASH, 24]];
const incl = (a, b) => a.right >= b.x && a.bottom >= b.y && a.x <= b.right && a.y <= b.bottom;
function walk(fx, fy, tx, ty, at) {
    fx = Math.trunc(fx); fy = Math.trunc(fy); tx = Math.trunc(tx); ty = Math.trunc(ty);
    if (Math.hypot(tx - fx, ty - fy) < 1) return at(fx, ty);
    const xD = Math.abs(tx - fx), yD = Math.abs(ty - fy);
    let xs = tx > fx ? 1 : -1, ys = ty > fy ? 1 : -1, x = fx, y = fy;
    if (xD > yD) { ys *= yD / xD; while (xs > 0 ? x < tx : x > tx) { const s = at(x, y); if (s) return s; x += xs; y += ys; } }
    else { xs *= xD / yD; while (ys > 0 ? y < ty : y > ty) { const s = at(x, y); if (s) return s; x += xs; y += ys; } }
    return null;
}
let total = 0;
for (const n of levels) {
    let rec; try { rec = src(n); } catch { continue; }
    let w; try { w = buildLevelWorld(rec, { roles: ROLES }); } catch { continue; }
    // ⛔ an OpenTree is type "Tree" in AS3 (`Scenery/Tree.as:22`; the table's "Solid" is wrong — measured on p4g)
    const masks = (w.pixelmasks ?? []).filter((p) => p.cls?.type === 'Solid' && p.cls.as3 !== 'OpenTree');
    if (!masks.length) continue;
    const boxes = w.solidBoxesForMover({});
    // per-pixel occupancy, once per level (the samples are integers here: the end points are, and the minor axis is
    // read through `Math.trunc` by both `collidePoint` paths for these integer-edged boxes and for the mask's pixel)
    const W = 2048, H = 2048, OFF = 256;
    const boxOcc = new Uint8Array(W * H), maskOcc = new Int16Array(W * H).fill(-1);
    for (const b of boxes) for (let y = Math.max(-OFF, Math.ceil(b.y)); y < Math.min(H - OFF, b.bottom); y++) for (let x = Math.max(-OFF, Math.ceil(b.x)); x < Math.min(W - OFF, b.right); x++) boxOcc[(y + OFF) * W + x + OFF] = 1;
    masks.forEach((p, i) => { for (let y = 0; y < p.mask.h; y++) for (let x = 0; x < p.mask.w; x++) if (p.mask.rows[y][x] === '#') { const X = p.maskX + x + OFF, Y = p.maskY + y + OFF; if (X >= 0 && Y >= 0 && X < W && Y < H && maskOcc[Y * W + X] < 0) maskOcc[Y * W + X] = i; } });
    const boxAt = (px, py) => { const X = Math.floor(px) + OFF, Y = Math.floor(py) + OFF; return (X >= 0 && Y >= 0 && X < W && Y < H && boxOcc[Y * W + X]) ? true : null; };
    const maskAt = (px, py) => { const X = Math.trunc(px) + OFF, Y = Math.trunc(py) + OFF; const i = (X >= 0 && Y >= 0 && X < W && Y < H) ? maskOcc[Y * W + X] : -1; return i >= 0 ? masks[i] : null; };
    const freeMemo = new Map();
    const playerFree = (px, py) => { const k = px * 4096 + py; let v = freeMemo.get(k); if (v === undefined) { v = !w.collidesSolid(playerBoxAt(px, py)); freeMemo.set(k, v); } return v; };
    const targets = [];
    for (const e of combatCensusOf(rec).enemies) {
        if (e.as3 === 'Flyer' || !e.row?.hitbox) continue;
        const hb = e.row.hitbox;
        targets.push({ id: `${e.tag}@${e.x},${e.y}`, as3: e.as3, hb, mover: (e.row.speed ?? 0) > 0, x: e.cx, y: e.cy });
    }
    for (const e of rec.entities ?? []) {
        const cls = ENTITY_CLASSES[e.type];
        if (!cls || ['Solid', 'Rope', 'Tree', 'LightPole'].includes(cls.type) || cls.as3 === 'LightPole') continue;
        if (cls.as3 === 'Watcher' && !(e.attrs?.text)) continue;
        const geo = PRESS_BOX_OVERRIDES[cls.as3] ?? (cls.collider === 'rect' ? cls : null);
        if (!geo || targets.some((t) => t.id === `${e.type}@${e.x},${e.y}`)) continue;
        targets.push({ id: `${e.type}@${e.x},${e.y}`, as3: cls.as3, hb: { w: geo.w, h: geo.h, ox: geo.originX, oy: geo.originY },
            mover: false, x: e.x + geo.dx, y: e.y + geo.dy });
    }
    if (!targets.length) continue;
    for (const t of targets) {
        const spots = [];
        if (!t.mover) spots.push([t.x, t.y]);
        else {
            const seen = new Set();
            for (const m of masks) for (let y = m.rect.y - 40; y <= m.rect.bottom + 40; y += 2) for (let x = m.rect.x - 40; x <= m.rect.right + 40; x += 2) {
                const k = `${x},${y}`; if (seen.has(k)) continue; seen.add(k);
                const b = { x: x - t.hb.ox, y: y - t.hb.oy, right: x - t.hb.ox + t.hb.w, bottom: y - t.hb.oy + t.hb.h };
                if (w.collidesSolid(b)) continue;
                spots.push([x, y]);
            }
        }
        const res = {};
        for (const [name, scale, reach] of SCALES) {
            let pairs = 0, ex = null; const by = new Map();
            for (const [x, y] of spots) {
                const box = { x: x - t.hb.ox, y: y - t.hb.oy, right: x - t.hb.ox + t.hb.w, bottom: y - t.hb.oy + t.hb.h };
                for (let py = Math.floor(box.y - reach); py <= box.bottom + reach; py++) for (let px = Math.floor(box.x - reach); px <= box.right + reach; px++) {
                    if (distanceRectPoint(px, py, box) > reach) continue;
                    if (![0, 1, 2, 3].some((d) => incl(slashRect(px, py, d, scale), box))) continue;
                    if (!playerFree(px, py)) continue;
                    if (walk(px, py, x, y, boxAt)) continue;
                    const m = walk(px, py, x, y, maskAt);
                    if (!m) continue;
                    pairs++; ex ??= `P(${px},${py})→E(${x},${y})`;
                    const k = `${m.tag}@${m.x},${m.y}`; by.set(k, (by.get(k) ?? 0) + 1);
                }
            }
            res[name] = { pairs, ex, by: [...by].map(([k, v]) => `${k}×${v}`).join(' ') };
        }
        if (res.normal.pairs || res.dash.pairs) {
            total++;
            console.log(`L${n}\t${t.id}\t${t.as3}${t.mover ? ' (mover, ' + spots.length + ' spots)' : ''}\tnormal=${res.normal.pairs}${res.normal.ex ? ' e.g. ' + res.normal.ex : ''} [${res.normal.by}]\tdash=${res.dash.pairs}${res.dash.ex ? ' e.g. ' + res.dash.ex : ''} [${res.dash.by}]`);
        }
    }
}
console.log(`TOTAL targets with a mask-only swing line: ${total}`);
