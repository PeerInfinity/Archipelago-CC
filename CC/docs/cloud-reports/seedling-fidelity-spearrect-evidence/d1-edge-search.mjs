#!/usr/bin/env node
/**
 * seedling-fidelity-spearrect D1 — a MODEL search for stances where the game's spear rule (`spearGameTest` ON) and the
 * model's old one (OFF) disagree on a thrust's FIRST test, against a static press responder. Each candidate: boot the
 * level at an integer (bx, by) with the spear held and selected, tap `dir` for one tick, idle `settle` ticks, press, idle 8.
 * The run's `presses` ledger is read OFF and ON; a candidate is a row when the first test's hits differ.
 * `--taps=2`: two taps (a perpendicular one, then the facing one) and the row is kept only when the bodies' END state
 * differs (a block's position, a turret's / chaser's hits) — the outcome a game recording can see.
 *   node d1-edge-search.mjs --levels=65,98 [--as3=PushableBlockSpear,IceTurret] [--max=40] [--taps=2]
 */
const M = '../../../../frontend/modules/seedlingDemo/';
const { ropeStaging } = await import(`${M}fidelityRope.js`);
const { createRunForStaging } = await import(`${M}tapeRunner.js`);
const { atlasLevelSource } = await import(`${M}levelSource.js`);
const { withContactFidelity } = await import(`${M}contactFidelity.js`);
const { inventorySlotsFor, INVENTORY_ITEM_IDS } = await import(`${M}tapeFormat.js`);

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
const levels = (arg('levels') ?? '65').split(',').map(Number);
const classes = (arg('as3') ?? 'PushableBlockSpear,IceTurret,LightPole,RopeStart,Tile').split(',');
const MAX = Number(arg('max') ?? 60);
const TAPS = Number(arg('taps') ?? 1);
const levelSource = atlasLevelSource();
const DIRS = [['right', 0], ['up', 1], ['left', 2], ['down', 3]];
const hitKey = (p) => (p ? p.hits.map((h) => `${h.as3}:${h.id ?? ''}${h.moved === false || h.landed === false || h.pulled === false ? '(no)' : ''}`).sort().join(',') : '—');

function play(staging, keys, on) {
    return withContactFidelity({ spearGameTest: on }, () => {
        let run;
        try { run = createRunForStaging(staging, levelSource); } catch (e) { return { err: e.message.slice(0, 80) }; }
        const at = [];
        try {
            for (const k of keys) { run.advance(new Set(k)); at.push({ x: run.state.x, y: run.state.y }); }
        } catch (e) { return { err: e.message.slice(0, 120), presses: run.presses }; }
        const end = [...(run.entities('pushables') ?? new Map())].map(([id, p]) => `${id}:${p.rect.x},${p.rect.y}`)
            .concat((run.entities('turretDamage') ?? []).map((d) => `${d.id}:${d.hits}`))
            .concat((run.entities('chasers') ?? []).map((c) => `${c.id}:${c.hits}`)).join(' ');
        return { presses: run.presses.filter((p) => p.weapon === 'spear'), at, level: run.level, dir: run.state.direction, end };
    });
}

let rows = 0;
for (const level of levels) {
    const probe = await ropeStaging({ boot: { level, x: 0, y: 0 }, items: ['hasSpear'], persistence: [] });
    const slot = inventorySlotsFor(probe.seam.items).indexOf(INVENTORY_ITEM_IDS.spear);
    const world = (() => { const r = createRunForStaging({ ...probe, boot: { level, x: 8, y: 8 } }, levelSource); return r.world; })();
    const targets = world.pressResponders.filter((r) => classes.includes(r.as3) && r.rect);
    console.log(`L${level}: ${targets.length} target(s) ${targets.map((t) => `${t.as3}@${t.x},${t.y}`).join(' ')}`);
    const walk = new Set((world.walkableTiles ?? []).map((t) => `${t.tx},${t.ty}`));
    for (const t of targets) {
        const r = t.rect;
        const cands = [];
        // the player x/y near the rect's edges along each thrust axis (boot = player - 8)
        for (let px = Math.floor(r.x) - 40; px <= Math.ceil(r.right) + 40; px += 1) {
            for (let py = Math.floor(r.y) - 40; py <= Math.ceil(r.bottom) + 40; py += 1) {
                const nearX = [r.x - 32, r.right + 32, r.x, r.right].some((e) => Math.abs(px - e) <= 2);
                const nearY = [r.y - 32, r.bottom + 32, r.y, r.bottom].some((e) => Math.abs(py - e) <= 2);
                if (!nearX && !nearY) continue;
                if (!walk.has(`${Math.floor(px / 16)},${Math.floor(py / 16)}`)) continue;
                cands.push([px, py]);
            }
        }
        let found = 0;
        for (const [px, py] of cands) {
            if (found >= MAX) break;
            const seqs = TAPS === 2
                ? DIRS.flatMap(([k1]) => DIRS.filter(([k2]) => k2 !== k1).map(([k2]) => [k1, k2]))
                : DIRS.map(([k]) => [k]);
            for (const seq of seqs) {
                const key = seq.join('+');
                const staging = { ...probe, boot: { level, x: px - 8, y: py - 8 }, equips: [{ t: 0, slot }] };
                const keys = [...seq.flatMap((k) => [[k], [], [], [], [], []]), ['primary'],
                    ...Array.from({ length: TAPS === 2 ? 40 : 8 }, () => [])];
                const off = play(staging, keys, false);
                if (off.err && !off.presses) continue;
                const on = play(staging, keys, true);
                const a = hitKey(off.presses?.[0]);
                const b = hitKey(on.presses?.find((p) => p.repeat == null));
                const differs = TAPS === 2 ? off.end !== on.end : a !== b;
                if (differs || (off.err ?? null) !== (on.err ?? null)) {
                    rows += 1; found += 1;
                    const s = on.at?.[6 * seq.length - 1];
                    console.log(`  ${t.as3}@${t.x},${t.y} boot(${px - 8},${py - 8}) tap ${key} → stance (${s?.x},${s?.y}) dir ${on.dir}: `
                        + `OFF[${a}]${off.err ? ` err:${off.err}` : ''} ON[${b}]${on.err ? ` err:${on.err}` : ''}`
                        + `${TAPS === 2 ? `\n      end OFF {${off.end}}\n      end ON  {${on.end}}` : ''}`);
                }
            }
        }
    }
}
console.log(`\n${rows} disagreeing candidate(s)`);
