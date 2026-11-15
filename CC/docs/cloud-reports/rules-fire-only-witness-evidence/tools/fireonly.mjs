#!/usr/bin/env node
// rules-fire-only-witness: hand-authored (open-loop) key scripts for the Fire-only crossings of L92 (reverse) and L73,
// authored on the JS model from the GAME'S OWN LANDING (`fidelityArrival.arrivalStaging`, the staging the solver's
// refusals used), then played on the wasm game (p4g, headless logic-only channel).
//
//   node fireonly.mjs --model [--case=a,b] [--trace]     author each script on the model; print hits, end, chasers
//   node fireonly.mjs --build=<dir> [--case=a,b]          also write <dir>/<case>.tape.json
//   node fireonly.mjs --play=<dir> [--case=a,b]           play each tape on the game; print one ROW (hits, end level,
//                                                         first-hit tick, the chasers at the end) and write
//                                                         <dir>/<case>.game.json (every polled tick + botMobiles)
//
// Script ops: ['to', x, y] walk (keysToward, 1 px) until there or stalled; ['fire'] one primary tick (the slot-0 arm:
// these stagings hold one weapon); ['wait', n]; ['keys', 'up+left', n]; ['fireEvery', n, gap] n presses gap apart.
// The model only CHOOSES keys and predicts; the game decides (hits are read off `botStatus.hits`).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const R = new URL('../../../../../', import.meta.url).pathname;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
const keysToward = (x, y, tx, ty, tol = 1) => {
    const k = [];
    if (tx - x > tol) k.push('right'); else if (tx - x < -tol) k.push('left');
    if (ty - y > tol) k.push('down'); else if (ty - y < -tol) k.push('up');
    return k;
};

const L92_ITEMS = ['hasFire', 'canSwim', 'hasShield', 'hasTorch', 'hasFeather']; // the forward witness's set
const L91 = { level: 92, x: 32, y: 128 }; // the L91 door's landing (FIREBREAK_RULES_REFUSED rules-l92-reverse)
const L72 = { level: 73, x: 32, y: 128 }; // the L72 door's landing (rules-l73-north)
const L74 = { level: 73, x: 64, y: 16 }; // the L74 door's landing (rules-l73-south)

export const CASES = {};
const add = (name, boot, items, script, note) => { CASES[name] = { boot, items, script, note }; };

// ── Controls: `--case=<name>-sword` runs any case below with Fire replaced by the pre-Fire arm (Sword) in its staging.

// ── L92 reverse. Stage 1 (r1c7 -> r3c12): swim east, break `@176,48` from its west side.
// Stage 2 (r3c12 -> r7c17): break `@256,112` from its west side and walk out to the L87 door (272,144).
const l92Lead = [['to', 40, 88], ['to', 136, 88], ['to', 136, 72], ['to', 152, 56], ['to', 160, 56]];
add('l92-direct', L91, L92_ITEMS, [...l92Lead, ['fire'], ['wait', 20], ['to', 200, 56], ['to', 240, 72], ['to', 240, 104],
    ['fire'], ['wait', 24], ['to', 272, 120], ['to', 272, 150], ['wait', 40]], 'straight through, as the solver would');

// The shelf beyond `@176,48` is region r3c12 (a cliff ledge, a pixelmask, parts it from the water side at x ~ 190, so Bob
// cannot be walked into the water: Enemy.as:39 `dieInWater`). Its two bodies: Bob (Bob.as, 0.5 px/tick, runRange 80,
// no leash) and the Spinner (Spinner.as: bounces at 1 px/tick, a hammer line of 13 px swept by `Game.time`, hitForce 4).
// `l92-wait-<w1>-<w2>`: the direct route with w1 idle ticks on the shelf at (200,72) and w2 at the rock stance before
// the walk out (the spinner's phase is the variable); `--search` picks (w1, w2) on the model.
export const l92Wait = (w1, w2, stance = [248, 104], face = null) => [...l92Lead, ['fire'], ['wait', 20], ['to', 192, 56], ['to', 200, 72], ['wait', w1],
    ['to', 240, 72], ['to', ...stance], ...(face ? [['keys', face, 1]] : []), ['fire'], ['wait', 24 + w2], ['to', 272, 120], ['keys', 'down', 45], ['wait', 30]];
for (const [w1, w2] of (arg('waits') ?? '200:0').split(',').map((p) => p.split(':').map(Number))) {
    add(`l92-wait-${w1}-${w2}`, L91, L92_ITEMS, l92Wait(w1, w2), `${w1} idle ticks on the shelf at (200,72), ${w2} more at the stance (248,104)`);
}

// The Sword CONTROL (L92): the same route; a blade needs the rock in front of it (Player.slash), so the stances are
// (168,56) facing east for `@176,48` and (248,118) facing east for `@256,112`. Played with `-sword` (Fire -> Sword).
{
    const s = l92Wait(0, 0, [248, 118], 'right');
    s[s.findIndex((o) => o[0] === 'to' && o[1] === 160 && o[2] === 56)] = ['to', 168, 56];
    add('l92-control', L91, L92_ITEMS, s, 'the Sword control route (stances 168,56 and 248,118 facing east)');
}

// ── L73 (Fire only). The bodies: lavarunner@72,24 (LavaRunner.as: a Bob, 1.5 px/tick on stone and 1 in lava,
// `dieInLava = false`, hitsMax 2, Bob.runRange 80, no leash) in the north pocket, and bulb@80,80 (Bulb.as: a Bob,
// 0.65 px/tick, hitsMax 1) on the south floor. Fire's damage is 0 (Player.as:178), so neither dies to it.
// North (r3c7 -> r0c4): from the L72 landing, break `@64,48` from below and walk up to the L74 door (64,0).
// `bulb`: the bulb's lava kill first (bulb-search.mjs: go (72,120), go (40,136), idle 80 -> the bulb walks into the
// lava pit c3 r8 on the model). Then a lure point and idle, the stance, Fire, the wait, and up through the pocket.
const BULB = [['go', 72, 120], ['go', 40, 136], ['wait', 80]];
const NORTH = [['go', 72, 24], ['keys', 'up', 40], ['wait', 30]];
add('l73n-direct', L72, ['hasFire'], [['go', 72, 73], ['fire'], ['wait', 24], ...NORTH], 'straight to the stance (72,73) and up');
add('l73n-bulb', L72, ['hasFire'], [...BULB, ['go', 72, 73], ['fire'], ['wait', 24], ...NORTH], 'the bulb into the lava, then the stance (72,73)');
add('l73n-east', L72, ['hasFire'], [...BULB, ['go', 120, 56], ['wait', 120], ['go', 72, 73], ['fire'], ['wait', 24], ...NORTH],
    'the bulb, then (120,56) 120 ticks (the runner parks at the pocket\'s east end), then the stance');
add('l73n-offset', L72, ['hasFire'], [...BULB, ['go', 96, 72], ['wait', 60], ['to', 93, 70], ['fire'], ['wait', 24], ...NORTH],
    'the bulb, then the east stance (93,70) (the flame reaches the rock, the runner shadows over wall r3 c5)');
// South (r0c4 -> r3c7): from the L74 landing (64,16), break `@64,48` from above and walk down to the L72 door (32,144).
add('l73s-idle', L74, ['hasFire'], [['wait', 40]], 'no input: the arrival itself');
add('l73s-direct', L74, ['hasFire'], [['to', 72, 30], ['fire'], ['wait', 24], ['go', 72, 88], ['go', 40, 136], ['keys', 'down', 40], ['wait', 30]],
    'straight down through the rock');
add('l73s-west', L74, ['hasFire'], [['keys', 'left', 12], ['to', 56, 40], ['fire'], ['wait', 24], ['go', 72, 88], ['go', 40, 136], ['keys', 'down', 40], ['wait', 30]],
    'step west off the runner first, press from (56,40)');

const CASE_ARGS = arg('case')?.split(',') ?? null;

async function staging(c, arm = 'fire') {
    const { arrivalStaging } = await M('fidelityArrival.js');
    const items = arm === 'sword' ? c.items.map((i) => (i === 'hasFire' ? 'hasSword' : i)) : c.items;
    return arrivalStaging(c.boot, { items });
}

const grids = new Map();
function gridOf(level) {
    if (grids.has(level)) return grids.get(level);
    const w = gridWorld(level);
    const solid = new Set(w.solids.filter((x) => x.tag !== 'breakablerock').map((x) => `${Math.floor(x.rect.x / 16)},${Math.floor(x.rect.y / 16)}`));
    const g = new Set(w.tiles.filter((t) => !/Lava|Water|Pit/.test(t.name)).map((t) => `${t.tx},${t.ty}`).filter((k) => !solid.has(k)));
    grids.set(level, g);
    return g;
}
let gridWorld = null;

export async function author(c0, arm = 'fire', { trace = false } = {}) {
    if (!gridWorld) {
        const { atlasLevelSource } = await M('levelSource.js');
        const { buildLevelWorld, ROLES } = await M('levelWorld.js');
        const src = atlasLevelSource();
        gridWorld = (l) => buildLevelWorld(src(l), { roles: ROLES });
    }
    const c = { ...c0, script: c0.script.map((o) => [...o]) };
    const { createRunForStaging } = await M('tapeRunner.js');
    const { atlasLevelSource } = await M('levelSource.js');
    const st = await staging(c, arm);
    const run = createRunForStaging(JSON.parse(JSON.stringify(st)), atlasLevelSource(), { scratchPersistence: true });
    const perTick = [];
    const log = [];
    let firstHit = null;
    let err = null;
    const snap = () => ({ t: perTick.length, level: run.level, x: +run.state.x.toFixed(2), y: +run.state.y.toFixed(2),
        hits: run.playerHits.length,
        chasers: (run.chasers ?? []).filter((b) => !b.destroy).map((b) => `${b.id}(${b.x.toFixed(1)},${b.y.toFixed(1)})${b.dying ? 'D' : ''}`) });
    const step = (k) => {
        perTick.push([...k]);
        run.advance(new Set(k));
        if (firstHit === null && run.playerHits.length > 0) firstHit = perTick.length - 1;
        if (trace) log.push(snap());
    };
    try {
        for (const op of c.script) {
            if (op[0] === 'wait') { for (let i = 0; i < op[1]; i++) step([]); continue; }
            if (op[0] === 'keys') { for (let i = 0; i < op[2]; i++) step(op[1].split('+')); continue; }
            if (op[0] === 'fire') { step(['primary']); continue; }
            if (op[0] === 'fireEvery') { for (let i = 0; i < op[1]; i++) { step(['primary']); for (let j = 1; j < op[2]; j++) step([]); } continue; }
            if (op[0] === 'go') {
                // a 4-connected tile path (no lava, water, pit or solid; `breakablerock` cells open: used after a break)
                // from the player's tile to (x,y)'s tile, walked centre to centre, then 'to' (x,y)
                const g = gridOf(run.level);
                const from = `${Math.floor(run.state.x / 16)},${Math.floor(run.state.y / 16)}`;
                const goal = `${Math.floor(op[1] / 16)},${Math.floor(op[2] / 16)}`;
                const prev = new Map([[from, null]]); const q = [from];
                while (q.length) { const c = q.shift(); if (c === goal) break; const [cx, cy] = c.split(',').map(Number);
                    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${cx + dx},${cy + dy}`; if (g.has(k) && !prev.has(k)) { prev.set(k, c); q.push(k); } } }
                if (!prev.has(goal)) throw new Error(`go: no tile path ${from} -> ${goal}`);
                const path = []; for (let c = goal; c; c = prev.get(c)) path.unshift(c);
                const way = path.slice(1, -1).map((c) => c.split(',').map((v) => Number(v) * 16 + 8));
                c.script.splice(c.script.indexOf(op) + 1, 0, ...way.map(([x, y]) => ['to', x, y]), ['to', op[1], op[2]]);
                continue;
            }
            if (op[0] === 'to') {
                let best = Infinity; let stall = 0;
                for (let n = 0; n < 900; n++) {
                    if (run.level !== c.boot.level) break;
                    const k = keysToward(run.state.x, run.state.y, op[1], op[2]);
                    if (!k.length) break;
                    step(k);
                    const d = Math.hypot(run.state.x - op[1], run.state.y - op[2]);
                    if (d < best - 0.05) { best = d; stall = 0; } else if (++stall > 30) break;
                }
                if (trace) console.error('TO', JSON.stringify(op), '->', JSON.stringify(snap()));
            }
        }
    } catch (e) { err = String(e.message).split('\n')[0].slice(0, 400); }
    const end = snap();
    return { st, perTick, log, model: { ticks: perTick.length, end, firstHit, refusal: err,
        hitBy: run.playerHits.map((h) => JSON.stringify(h).slice(0, 200)),
        rocks: (run.rocksBroken ?? []).map((k) => `${k.id}@hit${k.hitTick}/gone${k.goneAt}`) } };
}

async function buildTape(st, perTick, name, note) {
    const { buildStagedTape } = await M('botDriverV1.js');
    const tape = buildStagedTape({ staging: st, perTick: [...perTick.map((k) => new Set(k)), ...Array.from({ length: 8 }, () => new Set())], name });
    return { ...tape, description: `rules-fire-only-witness: ${name} (hand script${note ? `: ${note}` : ''})` };
}

const names = () => {
    const all = [];
    for (const n of Object.keys(CASES)) { all.push(n); all.push(`${n}-sword`); }
    return CASE_ARGS ? all.filter((n) => CASE_ARGS.includes(n)) : all.filter((n) => !n.endsWith('-sword'));
};
const resolve = (n) => (n.endsWith('-sword') ? [CASES[n.slice(0, -6)], 'sword'] : [CASES[n], 'fire']);

if (process.argv.includes('--model') || arg('build')) {
    const dir = arg('build');
    if (dir) mkdirSync(dir, { recursive: true });
    for (const n of names()) {
        const [c, arm] = resolve(n);
        const a = await author(c, arm, { trace: process.argv.includes('--trace') });
        console.log('MODEL', n, JSON.stringify(a.model));
        if (process.argv.includes('--trace')) for (const s of a.log) if (s.t % 10 === 0) console.error(JSON.stringify(s));
        if (dir) writeFileSync(join(dir, `${n}.tape.json`), JSON.stringify(await buildTape(a.st, a.perTick, n, c.note)));
    }
}

if (arg('search') === 'l92') {
    const ARM = arg('arm') ?? 'fire';
    for (let w1 = 0; w1 <= 300; w1 += 10) for (let w2 = 0; w2 <= 120; w2 += 6) {
        const a = await author({ boot: L91, items: L92_ITEMS, script: ARM === 'sword' ? l92Wait(w1, w2, [244, 120], 'right') : l92Wait(w1, w2) }, ARM);
        const ok = a.model.end.hits === 0 && a.model.end.level === 87 && !a.model.refusal;
        if (ok || process.argv.includes('--all')) console.log('SEARCH', JSON.stringify({ w1, w2, ok, ...a.model, hitBy: a.model.hitBy.map((h) => JSON.parse(h.endsWith('}') ? h : '{}').source ?? h.slice(0, 60)) }));
    }
}

// --solve=<dir>: the SOLVER's own plan (twoPassSolve, dashMode 'all', the `fireBreakArm` switch on, as
// `fidelityFireBreak.fireBreakPlan`) for each refused row, once per arm: `fire` (the row's own items) and `sword` (Fire
// replaced by the pre-Fire arm). A plan is written as <dir>/solve-<row>-<arm>.tape.json; a refusal is printed.
if (arg('solve')) {
    const dir = arg('solve'); mkdirSync(dir, { recursive: true });
    const { FIREBREAK_RULES_REFUSED, fireBreakPlan } = await M('fidelityFireBreak.js');
    for (const w of FIREBREAK_RULES_REFUSED.filter((r) => /l73|l92/.test(r.name))) for (const arm of ['fire', 'sword']) {
        const row = arm === 'fire' ? w : { ...w, name: `${w.name}-sword`, items: w.items.map((i) => (i === 'hasFire' ? 'hasSword' : i)) };
        const t0 = Date.now();
        try {
            const { solved, tape } = await fireBreakPlan(row);
            const breaks = solved.out.records.filter((r) => r.strategy === 'break' || r.verb === 'break').map((b) => `${b.target} ${b.weapon} t${b.pressedAt}`);
            writeFileSync(join(dir, `solve-${w.name}-${arm}.tape.json`), JSON.stringify(tape));
            console.log('SOLVE', JSON.stringify({ row: w.name, arm, items: row.items, verdict: 'PLANNED', ticks: solved.out.perTick.length, breaks, ms: Date.now() - t0 }));
        } catch (e) {
            console.log('SOLVE', JSON.stringify({ row: w.name, arm, items: row.items, verdict: 'REFUSED', refusal: String(e.message).split('\n')[0].slice(0, 500), ms: Date.now() - t0 }));
        }
    }
}

if (arg('play')) await play(arg('play'), CASE_ARGS ?? names()); // --case names any <dir>/<name>.tape.json

export async function play(dir, list) {
    const { chromium } = await import('playwright');
    const { HEADLESS_LOGIC_ONLY_ARGS } = await import(join(R, 'scripts/procgen/headlessChromium.js'));
    const { assertLogicOnlyChannel } = await import(join(R, 'scripts/procgen/seedlingChannel.js'));
    const { takeBoxLockOrExit } = await import(join(R, 'scripts/procgen/boxLock.js'));
    const { parseTape, gameVisibleTape } = await M('tapeFormat.js');
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const URL_ = `http://localhost:${process.env.SEEDLING_PORT || '8000'}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    takeBoxLockOrExit({ name: 'rules-fire-only-witness', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const call = (page, n, a) => page.evaluate(([name, x]) => String(x === undefined ? window.__swfBridge.game[name]() : window.__swfBridge.game[name](x)), [n, a]);
    let proved = false;
    const rows = [];
    for (const name of list) {
        const tape = parseTape(readFileSync(join(dir, `${name}.tape.json`), 'utf8'));
        const page = await browser.newPage();
        try {
            await page.goto(URL_, { waitUntil: 'domcontentloaded' });
            for (let i = 0; i < 720 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
            await page.click('#btn-start');
            for (let i = 0; i < 720 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) await page.waitForTimeout(250);
            if (!proved) { await assertLogicOnlyChannel(page); proved = true; console.log('CHANNEL: headless logic-only (asserted)'); }
            const loaded = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape)));
            if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
            if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
            const samples = new Map();
            let status;
            for (const t0 = Date.now(); Date.now() - t0 < 10 * 60 * 1000;) {
                const [s, m] = await page.evaluate(() => [String(window.__swfBridge.game.botStatus()), String(window.__swfBridge.game.botMobiles())]);
                status = JSON.parse(s);
                if (status.error) throw new Error(status.error);
                if (Number.isInteger(status.tick)) {
                    const mob = (JSON.parse(m).mobiles ?? []).filter((b) => !/Player/.test(b.cls ?? ''))
                        .map((b) => `${b.cls}(${(+b.x).toFixed(1)},${(+b.y).toFixed(1)})${b.destroy ? 'X' : ''}`);
                    samples.set(status.tick, { t: status.tick, level: status.level, x: status.x, y: status.y, hits: status.hits ?? null, mob });
                }
                if (status.finished) break;
            }
            const list_ = [...samples.values()].sort((a, b) => a.t - b.t);
            const firstHit = list_.find((s) => (s.hits ?? 0) > 0)?.t ?? null;
            const row = { case: name, finished: !!status?.finished, ticks: tape.tick_count, endLevel: status?.level,
                end: { x: status?.x, y: status?.y, t: status?.tick }, hits: status?.hits ?? null, firstHit,
                levels: [...new Set(list_.map((s) => s.level))], lastInBoot: list_.filter((s) => s.level === tape.boot.level).at(-1) ?? null };
            console.log('ROW', JSON.stringify(row));
            rows.push(row);
            writeFileSync(join(dir, `${name}.game.json`), JSON.stringify({ row, samples: list_ }));
        } catch (e) {
            console.log('ROW', JSON.stringify({ case: name, error: String(e.message).split('\n')[0] }));
        } finally { await page.close(); }
    }
    await browser.close();
    return rows;
}
