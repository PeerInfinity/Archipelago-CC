#!/usr/bin/env node
// rules-wand-chaser-killarm-census: a 2-D SCREENING model of a K room with the Wand, built from the repo's ports only
// (levelRun throws when a wand shot reaches a chaser — only the boss totem is modelled — so it cannot choose Wand keys):
//   player   playerPhysicsV1.step, collides with the room's solids (levelWorld), terrain speed/friction per tile
//            (seedlingChaserPursuitGuard.playerTerrain); lava without the Dark Suit = death (pruned)
//   runners  chasers.chaserStep (Bob.as:49-75), axis-separated 1-px moves against the solids + the other runners'
//            boxes (LavaRunner solids carry "Enemy", :43), moveSpeed re-chosen per tile (LavaRunner.as:84-118),
//            onScreen per a 160×160 player-centred camera (Enemy.as:64)
//   shots    wandShot.createWandShot/stepWandShot, spawn at press+WAND_WINDOW.fireTick, `direction` by the v-sign
//            rule (Player.as:1625-1646), stopped by solids and runner boxes; Enemy.hit's gates (Enemy.as:141-181)
//   contact  the player's 4×5 box vs a runner's 12×12 box at hitsTimer <= 0 (Enemy.as:211-221)
// Other bodies (bulbs, grenades, traps, axes) are NOT modelled: the GAME decides every verdict (wplay.mjs).
// Beam search over held key sets per segment (8 dirs + idle, ×{press, no press}); a node dies on contact, on lava
// (no suit), or leaving the room; it scores by the tile distance to the goal (an exit teleporter or a tile set) plus a
// penalty per live runner within 80 px. Emits a tape on the game's arrival staging.
//   node wsim.mjs --boot=72:16:256 --goal=176:0:73 --items=hasWand [--width=40] [--seg=8] [--depth=60] --out=<tape>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
const R = new URL('../../../../../../', import.meta.url).pathname;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const { SEEDLING_SET_PATCHES, patchedMapDocument } = await M('seedlingSetPatches.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const { buildLevelWorld, ROLES } = await M('levelWorld.js');
const { arrivalStaging } = await M('fidelityArrival.js');
const { buildStagedTape } = await M('botDriverV1.js');
const { chaserStep } = await M('chasers.js');
const { ENEMY_CLASSES } = await M('combat.js');
const PP = await M('playerPhysicsV1.js');
const { createWandShot, stepWandShot, WAND_SHOT } = await M('wandShot.js');
const { WAND_WINDOW } = await M('wandVerb.js');
const G = await import(join(R, 'scripts/procgen/seedlingChaserPursuitGuard.js'));
const LC = await M('lavaChain.js');
const MAP = JSON.parse(readFileSync(join(R, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const levelSource = levelSourceFromAtlas(patchedMapDocument(MAP, [...SEEDLING_SET_PATCHES]));

export function makeRoom(level) {
    const rec = levelSource(level);
    const w = buildLevelWorld(rec, { roles: ROLES });
    const W = rec.width * 16, H = rec.height * 16;
    const solids = w.solids.map((s) => s.rect);
    const ttype = new Map(w.tiles.map((t) => [`${t.tx},${t.ty}`, t.t]));
    const tileAt = (x, y) => ttype.get(`${Math.floor(x / 16)},${Math.floor(y / 16)}`) ?? 0;
    const hitSolid = (b) => solids.some((s) => b.x < s.right && s.x < b.x + b.w && b.y < s.bottom && s.y < b.y + b.h);
    const runners = rec.entities.filter((e) => e.type === 'lavarunner').map((e) => ({ id: `lavarunner@${e.x},${e.y}`, x: e.x + 8, y: e.y + 8 }));
    const teleporters = rec.entities.filter((e) => e.type === 'teleporter' || String(e.type).startsWith('stairs'));
    // hazards the sim does not step, as conservative NO-GO zones for the player (screening only):
    //   a LavaChain's reach strip (LavaChain.as:96-118: 48×4 beyond its tile in `dir`), always on;
    //   a LavaTrap's chompRange disc (LavaTrap.as:21, 32 px) without the Dark Suit (with it the reel is survived);
    //   a bulb / grenade / spinning axe: a 28 px disc about its spawn centre
    const hz = [];
    for (const e of rec.entities) {
        const cx = e.x + 8, cy = e.y + 8;
        if (e.type === 'lavachain') {
            const d = Number(e.attrs?.dir ?? 0), wdt = 48, h = 4;
            // the port's rect and anim clock (lavaChain.lavaChainRect / stepLavaChain at Game.time = seam time + tick)
            hz.push({ kind: 'chain', rect: LC.lavaChainRect(cx, cy, d), st: null });
        } else if (e.type === 'lavatrap') hz.push({ kind: 'trap', cx, cy, r: 33 });
        else if (['bulb', 'grenade', 'spinningaxe'].includes(e.type)) hz.push({ kind: e.type, cx, cy, r: 28 });
    }
    return { level, rec, w, W, H, solids, tileAt, hitSolid, runners, teleporters, hz };
}
const HB = ENEMY_CLASSES.lavarunner.hitbox;
const rbox = (x, y) => ({ x: x - HB.ox, y: y - HB.oy, w: HB.w, h: HB.h });
const pbox = (x, y) => ({ x: x - PP.HITBOX.originX, y: y - PP.HITBOX.originY, w: PP.HITBOX.width, h: PP.HITBOX.height });
const ov = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const BY_T = { walk: 1.5, swim: 1 };
const CM = Number(process.env.WSIM_CM ?? '2');   // contact margin (px) for screening: a near miss counts as contact
const grow = (b, m) => ({ x: b.x - m, y: b.y - m, w: b.w + 2 * m, h: b.h + 2 * m });   // chasers.CHASERS.lavarunner.speedByTerrain (LavaRunner.as:17-18)

export function initState(room, staging) {
    const sp = PP.spawnFromBoot(staging.boot);
    return { time0: staging.seam.time ?? 0, t: 0, p: { x: sp.x, y: sp.y, vx: 0, vy: 0 }, dir: 3, pend: [], shots: [], suit: !!staging.seam.items.hasDarkSuit,
        fire: !!staging.seam.items.hasFireWand,
        e: room.runners.map((r) => ({ ...r, v: { x: 0, y: 0 }, moveSpeed: BY_T.walk, runRange: 80, hits: 0, hitsTimer: 0, dead: null })),
        dead: null, contact: null, hitsLog: [], kills: [], ignore: (process.env.WSIM_IGNORE ?? '').split(',').filter(Boolean) };
}
const clone = (s) => ({ ...s, rchains: s.rchains?.map((c) => ({ ...c })), chains: s.chains?.map((cs) => cs.map((c) => ({ ...c }))), p: { ...s.p }, pend: [...s.pend], shots: s.shots.map((x) => ({ ...x, v: { ...x.v } })), e: s.e.map((x) => ({ ...x, v: { ...x.v } })), hitsLog: [...s.hitsLog], kills: [...s.kills] });

/** One tick. keys: Set of held keys ('primary' = a press this tick). Mutates s. */
export function tick(room, s, keys) {
    const { p } = s;
    const tt = room.tileAt(p.x, p.y + PP.CHECK_OFFSET_Y);   // the player's terrain probe point (Player.as getState offset)
    const terr = G.playerTerrain(tt === 17 && s.suit ? 17 : tt === 1 ? 1 : 0);
    const n = PP.step(p, new Set([...keys].filter((k) => k !== 'primary')), { world: { width: room.W, height: room.H }, moveSpeed: terr.moveSpeed, friction: terr.friction,
        collides: (x, y) => room.hitSolid(pbox(x, y)) });
    Object.assign(p, { x: n.x, y: n.y, vx: n.vx, vy: n.vy });
    if (p.vx < 0) s.dir = 2; else if (p.vx > 0) s.dir = 0; else if (p.vy < 0) s.dir = 1; else if (p.vy > 0) s.dir = 3;
    if (keys.has('primary') && s.pend.length === 0 && !s.wanding) { s.pend.push(s.t + WAND_WINDOW.fireTick); s.wanding = true; }
    if (s.pend[0] === s.t) {
        s.pend.shift(); s.wanding = false;
        const a = s.dir * Math.PI / 2; const w = s.fire ? 17 : 16;
        s.shots.push(createWandShot(s.t, p.x + w * Math.cos(a), p.y - w * Math.sin(a), { vx: 3 * Math.cos(a), vy: -3 * Math.sin(a) }, { fire: s.fire }));
    }
    if (room.tileAt(p.x, p.y + PP.CHECK_OFFSET_Y) === 17 && !s.suit) { s.dead = s.t; s.hz = 'lava'; }
    const pb = pbox(p.x, p.y);
    // the chain clock: Game.time = seam time + tick + DT; DT fitted on the game (an L72 run: +18 reproduces its t403 strike by lavachain@160,144);
    // screened as the UNION of DT-3, DT, DT+3 (a margin)
    const DTS = (process.env.WSIM_CHAIN_DT ?? '14,18,22').split(',').map(Number);
    if (!s.chains) s.chains = room.hz.filter((h) => h.kind === 'chain').map(() => DTS.map(() => LC.createLavaChainState()));
    let ci = 0;
    for (const h of room.hz) {
        if (h.kind === 'chain') {
            const sts = s.chains[ci++];
            let reaching = false;
            sts.forEach((st, k) => { if (LC.stepLavaChain(st, s.time0 + s.t + DTS[k])) reaching = true; });
            if (reaching && LC.rectTouchesBox(h.rect, { x: pb.x, y: pb.y, right: pb.x + pb.w, bottom: pb.y + pb.h })) { s.dead = s.t; s.hz = 'chain'; }
            // the chain hits Enemies too (LavaChain.as:84-87: hit(5, chain centre, 1, "LavaChain")), with Enemy.hit's gates;
            // screened on the fitted DT alone (the middle state)
            // the runner arm reads its own clock offset (WSIM_CHAIN_RDT; fitted on the game, see the report)
            if (!s.rchains) s.rchains = room.hz.filter((x) => x.kind === 'chain').map(() => LC.createLavaChainState());
            const mid = s.rchains[ci - 1];
            LC.stepLavaChain(mid, s.time0 + s.t + Number(process.env.WSIM_CHAIN_RDT ?? '19'));
            // ON by default (WSIM_CHAIN_RUNNERS=0 turns it off). Its clock offset (19) reproduces the game's chain hits on
            // L72's lavarunner@136,88 (t40) and @216,240 (t405) within 2 ticks (calib run L72-71to73-wand-k20-0)
            if (process.env.WSIM_CHAIN_RUNNERS !== '0' && (mid.anim === 'hit' || mid.anim === 'extend')) for (const e of s.e) {
                if (e.dead !== null || e.hitsTimer > 0) continue;
                const b = rbox(e.x, e.y);
                if (!LC.rectTouchesBox(h.rect, { x: b.x, y: b.y, right: b.x + b.w, bottom: b.y + b.h })) continue;
                e.hits += 1; e.hitsTimer = 30; s.hitsLog.push(`${e.id}@t${s.t}:chain`);
                if (e.hits >= 2) { e.dead = s.t; s.kills.push(`${e.id}@t${s.t}:chain`); }
                else { const a = Math.atan2(e.y - (h.rect.y + h.rect.h / 2), e.x - (h.rect.x + h.rect.w / 2)); e.v = { x: e.v.x + 5 * Math.cos(a), y: e.v.y + 5 * Math.sin(a) }; }
            }
            continue;
        }
        if (h.kind === 'door') { if (ov(pb, h.rect)) { s.dead = s.t; s.hz = 'door'; } continue; }
        if ( ((h.kind !== 'trap' || !s.suit) && Math.hypot(p.x - h.cx, p.y - h.cy) < h.r && !(s.ignore ?? []).includes(h.kind))) { s.dead = s.t; s.hz = h.kind; }
    }
    const cam = { x: Math.max(0, Math.min(room.W - 160, p.x - 80)), y: Math.max(0, Math.min(room.H - 160, p.y - 80)), w: 160, h: 160 };
    for (const e of s.e) {
        if (e.dead !== null) continue;
        const others = s.e.filter((o) => o !== e && o.dead === null);
        const blocked = (x, y) => room.hitSolid(rbox(x, y)) || others.some((o) => ov(rbox(x, y), rbox(o.x, o.y)));
        const move = (x, y, vx, vy) => {
            for (let i = 0; i < Math.abs(vx); i += 1) { const st = Math.min(1, Math.abs(vx) - i) * Math.sign(vx); if (blocked(x + st, y)) break; x += st; }
            for (let i = 0; i < Math.abs(vy); i += 1) { const st = Math.min(1, Math.abs(vy) - i) * Math.sign(vy); if (blocked(x, y + st)) break; y += st; }
            return { x, y };
        };
        const r = chaserStep('lavarunner', e, p, { onScreen: ov(rbox(e.x, e.y), cam), move, hitPlayer: ({ x, y, v, iframesTicked }) => {
            // an off-screen enemy skips hitUpdate + hitPlayer (Enemy.as:64-67): its i-frames do not tick
            if (!iframesTicked) return { v };
            if (e.hitsTimer > 0) e.hitsTimer -= 1;
            if (e.hitsTimer <= 0 && s.contact === null && ov(pbox(p.x, p.y), grow(rbox(x, y), CM))) s.contact = { t: s.t, id: e.id };
            return { v };
        } });
        e.x = r.x; e.y = r.y; e.v = r.v;
        const et = room.tileAt(e.x, e.y); e.moveSpeed = (et === 17 || et === 1) ? BY_T.swim : BY_T.walk;
    }
    for (const sh of s.shots) {
        if (sh.removed || sh.anim === 'die') continue;
        const box = (x, y) => (sh.fire ? { x: x - 2, y: y - 2, w: 5, h: 5 } : { x: x - 2, y: y - 2, w: 3, h: 3 });
        const ev = stepWandShot(sh, { tick: s.t, hitAt: (nx, ny) => {
            const b = box(nx, ny);
            const hitE = s.e.find((e) => e.dead === null && ov(b, rbox(e.x, e.y)));
            if (hitE) return { kind: 'enemy', id: hitE.id };
            return room.hitSolid(b) ? { kind: 'solid', id: 'solid' } : null;
        } });
        if (ev.event && ev.event.kind !== 'solid') {
            const e = s.e.find((x) => x.id === (sh.hit?.id ?? ev.event.id));
            if (e && e.hitsTimer <= 0 && e.hits < 2) {
                e.hits += sh.fire ? 1 : 0.5; e.hitsTimer = 30; s.hitsLog.push(`${e.id}@t${s.t}`);
                if (e.hits >= 2) { e.dead = s.t; s.kills.push(`${e.id}@t${s.t}`); }
                else { const a = Math.atan2(e.y - sh.y, e.x - sh.x); e.v = { x: e.v.x + 3 * Math.cos(a), y: e.v.y + 3 * Math.sin(a) }; }
            }
        }
    }
    s.shots = s.shots.filter((x) => !x.removed && x.anim !== 'die');
    s.t += 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const [level, bx, by] = arg('boot').split(':').map(Number);
    const items = (arg('items', '') || '').split(',').filter(Boolean);
    const room = makeRoom(level);
    const st = arrivalStaging({ level, x: bx, y: by }, { items });
    const G0 = arg('goal');
    const goalTiles = G0.startsWith('tiles:') ? G0.slice(6).split(';').map((q) => q.split(',').map(Number)) : null;
    const [gx, gy] = goalTiles ? [goalTiles[0][0] * 16, goalTiles[0][1] * 16] : G0.split(':').map(Number);
    const goalRect = goalTiles ? null : { x: gx, y: gy, w: 16, h: 16 };
    // every OTHER exit (a teleporter or stairs that is not the goal) is a no-go zone: the tape must not leave by it
    const goalLevel = goalTiles ? null : Number(G0.split(':')[2]);
    room.hz.push(...room.teleporters.filter((e) => goalTiles || (!(e.x === gx && e.y === gy) && Number(e.attrs?.to) !== goalLevel))
        .map((e) => ({ kind: 'door', rect: { x: e.x, y: e.y, w: 16, h: 16 } })));
    const reached = (s) => (goalRect ? ov(pbox(s.p.x, s.p.y), goalRect) : goalTiles.some(([tx, ty]) => Math.floor(s.p.x / 16) === tx && Math.floor(s.p.y / 16) === ty));
    // tile distance field (lava passable only with the suit)
    const suit = items.includes('hasDarkSuit');
    const pass = new Set();
    for (const t of room.w.tiles) { const k = `${t.tx},${t.ty}`; if ((t.t !== 17 || suit) && !room.hitSolid({ x: t.tx * 16 + 4, y: t.ty * 16 + 4, w: 8, h: 8 })) pass.add(k); }
    const gk = goalTiles ? goalTiles.map(([a, b]) => `${a},${b}`) : [`${Math.floor(gx / 16)},${Math.floor(gy / 16)}`];
    const dist = new Map(gk.map((k) => [k, 0])); const q = [...gk];
    for (const k of gk) pass.add(k);
    while (q.length) { const c = q.shift(); const [cx, cy] = c.split(',').map(Number); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${cx + dx},${cy + dy}`; if (pass.has(k) && !dist.has(k)) { dist.set(k, dist.get(c) + 1); q.push(k); } } }
    const WIDTH = Number(arg('width', '40')), SEG = Number(arg('seg', '8')), DEPTH = Number(arg('depth', '60'));
    const KILLW = Number(arg('killw', '6'));
    const DIRS = [[], ['up'], ['down'], ['left'], ['right'], ['up', 'left'], ['up', 'right'], ['down', 'left'], ['down', 'right']];
    const CH = [...DIRS.map((d) => ({ d, f: false })), ...DIRS.map((d) => ({ d, f: true }))];
    const score = (s) => {
        const d = dist.get(`${Math.floor(s.p.x / 16)},${Math.floor(s.p.y / 16)}`) ?? 99;
        const near = s.e.filter((e) => e.dead === null && Math.hypot(e.x - s.p.x, e.y - s.p.y) < 80).length;
        return d * 16 + near * KILLW - s.e.reduce((m, e) => m + e.hits * 4, 0) + (dist.has(`${Math.floor(s.p.x / 16)},${Math.floor(s.p.y / 16)}`) ? 0 : 200);
    };
    const WINS = Number(arg('wins', '1')); const wins = [];
    let beam = [{ s: initState(room, st), keys: [] }]; let win = null; let best = null;
    for (let depth = 0; depth < DEPTH && wins.length < WINS; depth += 1) {
        const next = [];
        for (const nd of beam) for (const c of CH) {
            const s = clone(nd.s); const ks = [];
            let ok = true;
            for (let i = 0; i < SEG; i += 1) {
                const k = new Set(c.d); if (c.f && i === 0) k.add('primary');
                tick(room, s, k); ks.push([...k]);
                if (s.contact || s.dead !== null) { ok = false; break; }
                if (reached(s)) break;
            }
            if (!ok) continue;
            const n = { s, keys: [...nd.keys, ...ks] };
            if (reached(s)) { if (!win) win = n; if (wins.length < WINS && !wins.some((w) => Math.abs(w.keys.length - n.keys.length) < 3 && Math.hypot(w.s.p.x - n.s.p.x, w.s.p.y - n.s.p.y) < 2)) wins.push(n); continue; }
            next.push(n);
        }
        // dedupe on (tile, quantised pos)
        const seen = new Map();
        for (const n of next) { const k = `${Math.round(n.s.p.x / 3)},${Math.round(n.s.p.y / 3)},${n.s.e.map((e) => e.dead === null ? `${Math.round(e.x / 4)},${Math.round(e.y / 4)},${e.hits}` : 'X').join('|')}`; const sc = score(n.s); if (!seen.has(k) || seen.get(k).sc > sc) seen.set(k, { n, sc }); }
        beam = [...seen.values()].sort((a, b) => a.sc - b.sc).slice(0, WIDTH).map((x) => x.n);
        if (beam[0]) best = beam[0];
        if (process.argv.includes('--v') && depth % 5 === 0 && beam[0]) console.error(`depth ${depth} alive ${beam.length} best s=${score(beam[0].s)} at (${beam[0].s.p.x.toFixed(1)},${beam[0].s.p.y.toFixed(1)}) hits ${beam[0].s.hitsLog.join(' ')} kills ${beam[0].s.kills.join(' ')}`);
        if (!beam.length) break;
    }
    const outs = wins.length ? wins : [best].filter(Boolean);
    outs.forEach((res, i) => {
    console.log(JSON.stringify({ win: !!win, i, ticks: res?.keys.length, end: res && { x: +res.s.p.x.toFixed(1), y: +res.s.p.y.toFixed(1) }, hits: res?.s.hitsLog, kills: res?.s.kills }));
    if (res && arg('out')) {
        const perTick = [...res.keys.map((k) => new Set(k)), ...Array.from({ length: 30 }, () => new Set())];
        const name = arg('out').split('/').pop().replace(/\.tape\.json$/, '') + (outs.length > 1 ? `-${i}` : '');
        const tape = buildStagedTape({ staging: st, perTick, name });
        mkdirSync(dirname(arg('out')), { recursive: true });
        writeFileSync(join(dirname(arg('out')), `${name}.tape.json`), JSON.stringify({ ...tape, description: `rules-wand-chaser-killarm-census wsim beam: ${name} (boot ${arg('boot')}, goal ${G0}, items ${items.join('+') || 'none'}; ${win ? 'model reached the goal' : 'model best node, goal NOT reached'})` }));
    }
    });
}
