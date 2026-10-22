// W0 census (fidelity MASKS): where can a "Solid" pixelmask lie on a `collideLine("Solid", …)` line the game tests?
// For every atlas level with a Solid pixelmask: every swing target (combat census enemies + hazards at their entity point,
// and every rect entity of a hit-able, non-waived type), every crusher, every drill. Candidate player points: the 1 px
// grid within R of the target point where the player box is free (`collidesSolid`). A line counts when the BOX walk is
// clear and the MASK walk is blocked (DRILL's sampler: `maskHitsBox` on a 1x1 box at the sample).
// Usage: node w0-census.mjs [--reach=32]
import { loadAtlas, atlasLevelSource } from '../../../../frontend/modules/seedlingDemo/levelSource.js';
import { buildLevelWorld, combatCensusOf, ENTITY_CLASSES, ROLES, maskHitsBox, PRESS_BOX_OVERRIDES } from '../../../../frontend/modules/seedlingDemo/levelWorld.js';
import { playerBoxAt } from '../../../../frontend/modules/seedlingDemo/playerPhysicsV2.js';
// the swing gate: `FP.distanceRectPoint(x, y, <target's box>) <= slashingSprite.width * scaleX` (16, 24 on a dash)
const R = Number((process.argv.find((a) => a.startsWith('--reach=')) ?? '--reach=24').split('=')[1]);
const distRectPoint = (px, py, r) => Math.hypot(Math.max(r.x - px, 0, px - r.right), Math.max(r.y - py, 0, py - r.bottom));
const src = atlasLevelSource();
const atlas = loadAtlas();
const levels = Object.keys(atlas.levels ?? atlas).filter((k) => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
// `v[i].type == "Solid" || v[i].type == "Rope" || v[i] is Flyer` waive the line (`Player.as:917`); a Tree's `hit()` is
// EMPTY (`Scenery/Tree.as:54`), so its line changes nothing.
const WAIVED = new Set(['Solid', 'Rope', 'Tree']);
function walk(fx, fy, tx, ty, at) {
    fx = Math.trunc(fx); fy = Math.trunc(fy); tx = Math.trunc(tx); ty = Math.trunc(ty);
    if (Math.hypot(tx - fx, ty - fy) < 1) return at(fx, ty);
    const xD = Math.abs(tx - fx), yD = Math.abs(ty - fy);
    let xs = tx > fx ? 1 : -1, ys = ty > fy ? 1 : -1, x = fx, y = fy;
    if (xD > yD) { ys *= yD / xD; while (xs > 0 ? x < tx : x > tx) { const s = at(x, y); if (s) return s; x += xs; y += ys; } }
    else { xs *= xD / yD; while (ys > 0 ? y < ty : y > ty) { const s = at(x, y); if (s) return s; x += xs; y += ys; } }
    return null;
}
const totals = { levels: 0, maskLevels: 0, rows: 0 };
for (const n of levels) {
    let rec; try { rec = src(n); } catch { continue; }
    totals.levels++;
    let w; try { w = buildLevelWorld(rec, { roles: ROLES }); } catch (e) { console.log(`L${n}\tBUILD-FAILED ${e.message.slice(0, 80)}`); continue; }
    const masks = (w.pixelmasks ?? []).filter((p) => p.cls?.type === 'Solid' && p.cls.as3 !== 'OpenTree');   // OpenTree: type "Tree"
    if (masks.length === 0) continue;
    totals.maskLevels++;
    const boxes = w.solidBoxesForMover({});
    const boxAt = (px, py) => boxes.find((s) => px >= s.x && px < s.right && py >= s.y && py < s.bottom) ?? null;
    const maskAt = (px, py) => masks.find((p) => maskHitsBox(p.mask, p.maskX, p.maskY, { x: px, y: py, right: px + 1, bottom: py + 1 })) ?? null;
    const both = (px, py) => boxAt(px, py) ?? maskAt(px, py);
    const targets = [];
    const c = combatCensusOf(rec);
    for (const e of [...c.enemies, ...c.hazards]) {
        const hb = e.row?.hitbox;
        const box = hb ? { x: e.cx - hb.ox, y: e.cy - hb.oy, right: e.cx - hb.ox + hb.w, bottom: e.cy - hb.oy + hb.h } : null;
        targets.push({ id: `${e.tag}@${e.x},${e.y}`, x: e.cx, y: e.cy, tag: e.tag, box, as3: e.as3,
            kind: e.tag === 'crusher' ? 'crusher' : (e.tag === 'drill' ? 'drill' : 'swing') });
    }
    for (const e of rec.entities ?? []) {
        const cls = ENTITY_CLASSES[e.type];
        if (!cls) continue;
        const over = PRESS_BOX_OVERRIDES[cls.as3];
        const geo = over ?? (cls.collider === 'rect' ? cls : null);
        if (!geo || WAIVED.has(cls.type) || !cls.type) continue;
        const t0 = targets.find((t) => t.id === `${e.type}@${e.x},${e.y}`);
        const box = { x: e.x + geo.dx - geo.originX, y: e.y + geo.dy - geo.originY };
        box.right = box.x + geo.w; box.bottom = box.y + geo.h;
        if (t0) { if (!t0.box) t0.box = box; continue; }
        targets.push({ id: `${e.type}@${e.x},${e.y}`, x: e.x + geo.dx, y: e.y + geo.dy, tag: e.type, box, as3: cls.as3, kind: 'swing' });
    }
    const rows = [];
    for (const t of targets) {
        if (t.kind === 'swing' && t.as3 === 'Flyer') continue;   // `v[i] is Flyer` waives the line
        const r = t.kind === 'crusher' ? 72 : (t.kind === 'drill' ? 48 : R + 48);
        const box = t.box ?? { x: t.x - 8, y: t.y - 8, right: t.x + 8, bottom: t.y + 8 };
        let free = 0, hits = 0, minD = Infinity; const by = new Map();
        for (let py = Math.floor(t.y - r); py <= t.y + r; py++) {
            for (let px = Math.floor(t.x - r); px <= t.x + r; px++) {
                const d = Math.hypot(px - t.x, py - t.y);
                if (d > r) continue;
                const dr = t.kind === 'swing' ? distRectPoint(px, py, box) : d;
                if (t.kind === 'swing' && dr > R) continue;
                if (w.collidesSolid(playerBoxAt(px, py))) continue;
                free++;
                // the player's swing line runs player → target; the crusher's/drill's runs body → player
                const [fx, fy, tx, ty] = t.kind === 'swing' ? [px, py, t.x, t.y] : [t.x, t.y, px, py];
                if (walk(fx, fy, tx, ty, boxAt)) continue;
                const m = walk(fx, fy, tx, ty, both);
                if (!m || !m.mask) continue;
                hits++; minD = Math.min(minD, dr);
                const k = `${m.tag}@${m.x},${m.y}`; by.set(k, (by.get(k) ?? 0) + 1);
            }
        }
        if (hits) rows.push(`  ${t.kind}\t${t.id}\tpt(${t.x},${t.y})${t.box ? '' : ' (box guessed 16x16)'}\tfree=${free}\tmaskOnly=${hits}\tminD=${minD.toFixed(1)}\tby=${[...by].map(([k, v]) => `${k}×${v}`).join(' ')}`);
    }
    console.log(`L${n}\tmasks=${masks.length} [${[...new Set(masks.map((p) => p.cls.as3))].join(',')}]\ttargets=${targets.length}\tmask-only lines at ${rows.length} target(s)\tcrushers=${(w.crushers ?? []).length}`);
    for (const r of rows) console.log(r);
    totals.rows += rows.length;
}
console.log(`TOTAL levels=${totals.levels} maskLevels=${totals.maskLevels} targetsWithMaskOnlyLines=${totals.rows} (reach ${R})`);
