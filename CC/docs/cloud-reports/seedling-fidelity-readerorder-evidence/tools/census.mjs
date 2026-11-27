#!/usr/bin/env node
// Census (wave 64, read-only): every room where a reader that updates BEFORE the responders can meet one.
//   (A) a PushableBlock* that can stand in, or be pushed into, a responder's box;
//   (B) a Spinner's or WallFlyer's sweep that crosses a responder's box.
// A "responder" is any `world.activators` row (Lock, WandLock, GrassLock, ShieldLock*, Cover, BossLock) or a
// `world.magicalLocks` row. Each one is classified by the transitions it can make:
//   OPEN  — always possible, unless its group has no presser at all (then it is static);
//   RESET — only a lock-family/Cover row with `t >= 0` whose group holds a MOMENTARY presser: a plain `button`
//           (`Button.update` re-collides every frame) or a `buttonroom {room -1, flip 1}` (publishes false). A
//           `t = -1` kill lock, a BossLock, a ShieldLock (touch) and a MagicalLock open only.
// The reach is geometry, an UPPER BOUND, with no route asked:
//   (A) a breadth-first walk of the block's 16 px cell over cells free of static solids (every responder treated
//       open), never onto water/lava/pit (the block is destroyed there); a player-pushed `pushableblock` needs the
//       opposite cell free as a stance, a fire/spear block does not (`hit()` moves it from a distance).
//   (B) the spinner (`Spinner.as`: 7x7 box, 1 px/tick along the diagonal, reflect per axis) is SIMULATED for
//       20000 ticks in two worlds: every responder CLOSED ("meets": a reflection off one) and every responder OPEN
//       ("enters": its box overlaps one). The wallflyer (`WallFlyer.as`: 14x14, `decideMotion`, 4 px/tick until a
//       Solid) is flown wall to wall 40 times in the same two worlds (it is assumed always triggered).
// Over: the vanilla atlas, the playthrough's delivered set, the committed generated presets, and a generator sweep
// (`seedlingModel` skeleton records, kinds x seeds x {weighgate, holdgate, killgate, shortcut}). Plus CONTROLS:
// staged rooms the census must find (the D3 staging shapes). usage: node census.mjs [--seeds=N] [--json=out.json]
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const M = (p) => import(`${ROOT}frontend/modules/${p}`);
const { buildLevelWorld, rectsOverlap } = await M('seedlingDemo/levelWorld.js');
const { atlasLevelSource } = await M('seedlingDemo/levelSource.js');
const { levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
const { mountedRecordsOf } = await M('seedlingDemo/wasmWalkTape.js');
const { l25Sets } = await M('seedlingDemo/fidelityL25ApItem.js');
const { assembleGeneratedSeedlingSet } = await M('seedlingDemo/seedlingGeneratedSet.js');
const { seedlingModel } = await M('seedlingDemo/procgenSeedling.js');
const { parseSkeleton } = await M('procgenCore/skeletonKinds.js');
const { RESPONDERS, TOUCH_RESPONDERS, KEY_RESPONDERS } = await M('seedlingDemo/activators.js');
const STAGE = await import(new URL('./stage.mjs', import.meta.url));
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d);
const SEEDS = Number(arg('seeds', '40'));
const JSON_OUT = arg('json', null);

const rect = (x, y, w, h) => ({ x, y, w, h, right: x + w, bottom: y + h });
const near = (a, b, m = 1) => a.x < b.right + m && a.right > b.x - m && a.y < b.bottom + m && a.bottom > b.y - m;

function classify(rec, w) {
    const pressers = new Map();
    for (const e of rec.entities) {
        if (e.type !== 'button' && e.type !== 'buttonroom') continue;
        const t = Number(e.attrs?.tset);
        if (!pressers.has(t)) pressers.set(t, []);
        const momentary = e.type === 'button' || (Number(e.attrs?.room) === -1 && Number(e.attrs?.flip) === 1);
        pressers.get(t).push({ id: `${e.type}@${e.x},${e.y}`, momentary });
    }
    const out = [];
    for (const a of w.activators ?? []) {
        const fam = RESPONDERS[a.tag] ? 'responder' : (KEY_RESPONDERS[a.tag] ? 'key' : 'other');
        const ps = pressers.get(a.t) ?? [];
        let open = true;
        let reset = false;
        if (TOUCH_RESPONDERS[a.tag] || fam === 'key') reset = false;
        else if (fam === 'responder' && a.t >= 0) { reset = ps.some((p) => p.momentary); open = ps.length > 0; }
        else if (fam === 'responder' && a.t < 0) reset = false; // a kill lock: `checkEnemies` only ever sets true
        out.push({ id: a.id, tag: a.tag, t: a.t, rect: a.rect, open, reset, pressers: ps.map((p) => p.id) });
    }
    for (const m of w.magicalLocks ?? []) {
        out.push({ id: m.id, tag: 'magicallock', t: null, rect: m.rect ?? rect(m.x, m.y, 16, 16), open: true, reset: false, pressers: [] });
    }
    return out;
}

function pushReach(w, responders, p) {
    const allOpen = new Set(responders.map((r) => r.id));
    const opts = { openActivators: allOpen, openMagicalLocks: allOpen };
    const free = (cx, cy) => {
        if (cx < 0 || cy < 0 || cx >= w.width || cy >= w.height) return false; // `width`/`height` are in TILES
        if (w.collidesSolid(rect(cx * 16, cy * 16, 16, 16), opts)) return false;
        return true;
    };
    const deadly = (cx, cy) => [1, 6, 17].includes(w.nearestWalkableTile(cx * 16 + 8, cy * 16 + 8)?.t);
    const player = p.tag === 'pushableblock';
    const start = [Math.floor(p.x / 16), Math.floor(p.y / 16)];
    const seen = new Set([start.join(',')]);
    const q = [start];
    while (q.length) {
        const [cx, cy] = q.shift();
        if (deadly(cx, cy)) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (seen.has(`${nx},${ny}`) || !free(nx, ny)) continue;
            if (player && !free(cx - dx, cy - dy)) continue;
            seen.add(`${nx},${ny}`);
            q.push([nx, ny]);
        }
    }
    const hits = [];
    for (const r of responders) {
        const inBox = [...seen].some((k) => { const [cx, cy] = k.split(',').map(Number); return rectsOverlap(rect(cx * 16, cy * 16, 16, 16), r.rect); });
        if (inBox) hits.push(r);
    }
    return { cells: seen.size, hits };
}

function spinnerSweep(w, responders, s, openAll) {
    const open = new Set(openAll ? responders.map((r) => r.id) : []);
    const opts = { openActivators: open, openMagicalLocks: open };
    let x = s.x + 8;
    let y = s.y + 8;
    let vx = Math.cos(-Math.PI / 4);
    let vy = Math.sin(-Math.PI / 4);
    const box = (px, py) => rect(px - 4, py - 4, 7, 7);
    const met = new Map();
    const hitAt = (r0) => {
        for (const r of responders) if (rectsOverlap(r0, r.rect)) return r;
        return null;
    };
    for (let t = 0; t < 20000; t++) {
        const nx = x + vx;
        const bx = box(nx, y);
        if (w.collidesSolid(bx, opts)) { const r = !openAll && hitAt(bx); if (r && !met.has(r.id)) met.set(r.id, t); vx = -vx; } else x = nx;
        const ny = y + vy;
        const by = box(x, ny);
        if (w.collidesSolid(by, opts)) { const r = !openAll && hitAt(by); if (r && !met.has(r.id)) met.set(r.id, t); vy = -vy; } else y = ny;
        if (openAll) { const r = hitAt(box(x, y)); if (r && !met.has(r.id)) met.set(r.id, t); }
        if (x < -64 || y < -64 || x > w.width * 16 + 64 || y > w.height * 16 + 64) break;
    }
    return met;
}

function wallFlyerSweep(w, responders, f, openAll) {
    const open = new Set(openAll ? responders.map((r) => r.id) : []);
    const opts = { openActivators: open, openMagicalLocks: open };
    let x = f.x + 8;
    let y = f.y + 8;
    const box = (px, py) => rect(px - 7, py - 7, 14, 14);
    const solidAt = (px, py) => w.collidesSolid(box(px, py), opts);
    const decide = () => {
        let d = 0;
        if (solidAt(x + 14, y)) d += 1;
        if (solidAt(x, y - 14)) d += 2;
        if (solidAt(x - 14, y)) d += 4;
        if (solidAt(x, y + 14)) d += 8;
        const ang = { 1: Math.PI, 2: 1.5 * Math.PI, 3: 1.25 * Math.PI, 4: 0, 5: 0, 6: 1.75 * Math.PI, 7: 1.5 * Math.PI, 8: Math.PI / 2, 9: 0.75 * Math.PI, 10: Math.PI / 2, 11: Math.PI, 12: Math.PI / 4, 13: Math.PI / 2, 14: 0 }[d];
        return ang === undefined ? null : [4 * Math.cos(ang), -4 * Math.sin(ang)];
    };
    const met = new Map();
    const hitAt = (r0) => { for (const r of responders) if (rectsOverlap(r0, r.rect)) return r; return null; };
    for (let flight = 0; flight < 40; flight++) {
        const v = decide();
        if (!v) break;
        for (let t = 0; t < 400; t++) {
            let stop = false;
            for (const axis of [0, 1]) {
                const d = v[axis];
                for (let i = 0; i < Math.abs(d); i++) {
                    const st = Math.min(1, Math.abs(d) - i) * Math.sign(d);
                    const nb = axis === 0 ? box(x + st, y) : box(x, y + st);
                    if (w.collidesSolid(nb, opts)) { const r = !openAll && hitAt(nb); if (r && !met.has(r.id)) met.set(r.id, flight); stop = true; break; }
                    if (axis === 0) x += st; else y += st;
                    if (openAll) { const r = hitAt(box(x, y)); if (r && !met.has(r.id)) met.set(r.id, flight); }
                }
                if (stop) break;
            }
            if (stop) break;
        }
    }
    return met;
}

function censusRoom(rec, level) {
    let w;
    try { w = buildLevelWorld(rec); } catch (e) { return { level, error: String(e.message).slice(0, 120) }; }
    const responders = classify(rec, w);
    const rows = [];
    if (!responders.length) return { level, rows, responders: 0, readers: 0 };
    for (const p of w.pushables ?? []) {
        const r = pushReach(w, responders, p);
        for (const h of r.hits) rows.push({ pairing: 'A', reader: p.id, responder: h.id, t: h.t, open: h.open, reset: h.reset, how: 'block reaches the box' });
    }
    for (const s of w.spinners ?? []) {
        const closed = spinnerSweep(w, responders, s, false);
        const opened = spinnerSweep(w, responders, s, true);
        for (const r of responders) {
            if (!closed.has(r.id) && !opened.has(r.id)) continue;
            rows.push({ pairing: 'B', reader: s.id, responder: r.id, t: r.t, open: r.open, reset: r.reset,
                how: `${closed.has(r.id) ? `reflects off it closed (t${closed.get(r.id)})` : ''}${closed.has(r.id) && opened.has(r.id) ? '; ' : ''}${opened.has(r.id) ? `enters it open (t${opened.get(r.id)})` : ''}` });
        }
    }
    const flyers = rec.entities.filter((e) => e.type === 'wallflyer');
    for (const f of flyers) {
        const closed = wallFlyerSweep(w, responders, f, false);
        const opened = wallFlyerSweep(w, responders, f, true);
        for (const r of responders) {
            if (!closed.has(r.id) && !opened.has(r.id)) continue;
            rows.push({ pairing: 'B', reader: `wallflyer@${f.x},${f.y}`, responder: r.id, t: r.t, open: r.open, reset: r.reset,
                how: `${closed.has(r.id) ? `stops on it closed (flight ${closed.get(r.id)})` : ''}${closed.has(r.id) && opened.has(r.id) ? '; ' : ''}${opened.has(r.id) ? `flies into it open (flight ${opened.get(r.id)})` : ''}` });
        }
    }
    return { level, rows, responders: responders.length,
        readers: (w.pushables?.length ?? 0) + (w.spinners?.length ?? 0) + flyers.length };
}

const sources = [];
for (const c of STAGE.SHAPES) sources.push([`CONTROL ${c.name} (expect ${c.expect})`, (n) => (n === STAGE.LEVEL ? STAGE.stagedRecord(atlasLevelSource()(n), c) : null), true]);
sources.push(['vanilla atlas', atlasLevelSource(), false]);
sources.push(['delivered (playthrough AP_1, p4g)', l25Sets(ROOT).deliveredSource, false]);
for (const d of readdirSync(`${ROOT}frontend/presets`).filter((n) => n.startsWith('seedling_generated_')).sort()) {
    for (const s of readdirSync(`${ROOT}frontend/presets/${d}`)) {
        const p = `${ROOT}frontend/presets/${d}/${s}/${s}_rules.json`;
        if (!existsSync(p)) continue;
        const set = assembleGeneratedSeedlingSet(JSON.parse(readFileSync(p, 'utf8')), { selfPlayer: 1 }).set;
        sources.push([`generated ${d}/${s} (${set.rooms.length} rooms)`, levelSourceFromAtlas(mountedRecordsOf(set)), false]);
    }
}
const all = { controls: [], sets: [], sweep: null };
const say = (l) => process.stdout.write(`${l}\n`);
for (const [label, src, control] of sources) {
    let levels = 0;
    let withBoth = 0;
    const rows = [];
    for (let n = 0; n <= 300; n++) {
        let rec;
        try { rec = src(n); } catch { continue; }
        if (!rec?.entities) continue;
        levels += 1;
        const r = censusRoom(rec, n);
        if (r.error) { say(`  L${n}: build error ${r.error}`); continue; }
        if (r.responders && r.readers) withBoth += 1;
        for (const row of r.rows) rows.push({ level: n, ...row });
    }
    const a = rows.filter((r) => r.pairing === 'A');
    const b = rows.filter((r) => r.pairing === 'B');
    say(`${label}: levels ${levels}; rooms with a reader and a responder ${withBoth}; (A) ${a.length} pair(s) [reset-capable ${a.filter((r) => r.reset).length}]; (B) ${b.length} pair(s) [reset-capable ${b.filter((r) => r.reset).length}]`);
    for (const r of rows) say(`  ${r.pairing} L${r.level} ${r.reader} → ${r.responder} (t ${r.t}; open ${r.open ? 'Y' : 'n'}, reset ${r.reset ? 'Y' : 'n'}): ${r.how}`);
    (control ? all.controls : all.sets).push({ label, levels, withBoth, rows });
}

// ── the generator sweep: skeleton records (no solve), kinds x seeds x the elements that place a block, a spinner or a
// lock (the weigh gate: block + button + lock; the hold gate: buttonroom + lock; the kill gate and the shortcut:
// spinner + kill lock), plus `elements: none` (the roaming bodies alone).
const KINDS = ['empty', 'winding', 'branchy', 'bushy', 'loopy', 'open', 'rooms'];
const ELEMENTS = ['weighgate', 'holdgate', 'killgate', 'shortcut', null];
const sweep = { kinds: KINDS, seeds: SEEDS, elements: ELEMENTS.map((e) => e ?? 'none'), placed: 0, rooms: 0, withBoth: 0, rows: [] };
for (const kind of KINDS) {
    const skeleton = parseSkeleton(kind, { simulator: false, substrate: 'readerorder census' });
    for (const name of ELEMENTS) {
        for (let seed = 1; seed <= SEEDS; seed++) {
            let m;
            try { m = seedlingModel({ seed, skeleton, ...(name ? { elements: { name } } : {}) }); } catch { continue; }
            if (name && !m.elements?.ran) continue;
            sweep.placed += 1;
            const rec = typeof m.skeleton === 'function' ? m.skeleton() : m.skeleton;
            if (!rec?.entities) continue;
            sweep.rooms += 1;
            const r = censusRoom(rec, 0);
            if (r.error) continue;
            if (r.responders && r.readers) sweep.withBoth += 1;
            for (const row of r.rows) sweep.rows.push({ kind, element: name ?? 'none', seed, ...row });
        }
    }
}
all.sweep = sweep;
const sa = sweep.rows.filter((r) => r.pairing === 'A');
const sb = sweep.rows.filter((r) => r.pairing === 'B');
say(`generator sweep (skeleton records; kinds ${KINDS.join(',')}; seeds 1..${SEEDS}; elements ${sweep.elements.join(',')}): placed ${sweep.placed}, rooms ${sweep.rooms}, with a reader and a responder ${sweep.withBoth}; (A) ${sa.length} [reset-capable ${sa.filter((r) => r.reset).length}]; (B) ${sb.length} [reset-capable ${sb.filter((r) => r.reset).length}]`);
const tally = (rows) => { const m = new Map(); for (const r of rows) { const k = `${r.pairing} ${r.element} ${r.reader.split('@')[0]} → ${r.responder.split('@')[0]} t${r.t < 0 ? '-1' : '≥0'} reset ${r.reset ? 'Y' : 'n'}`; m.set(k, (m.get(k) ?? 0) + 1); } return [...m].sort(); };
for (const [k, n] of tally(sweep.rows)) say(`  ${k}: ${n}`);
for (const r of sweep.rows.filter((x) => x.reset).slice(0, 12)) say(`  e.g. ${r.kind} ${r.element} seed ${r.seed}: ${r.reader} → ${r.responder} (t ${r.t}): ${r.how}`);
if (JSON_OUT) writeFileSync(JSON_OUT, `${JSON.stringify(all, null, 1)}\n`);
