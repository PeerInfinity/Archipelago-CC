#!/usr/bin/env node
/**
 * seedling-fidelity-spearrect D1 — a MODEL search for CHASER outcomes the game's spear rule changes: boot at each
 * walkable tile centre of a level with chasers, tap `dir`, then thrust every 8 ticks for `ticks`; a row when the chasers'
 * hits (per tick) differ OFF vs ON. Each row says which spear rows differ (first test / repeat) and the reach of each hit.
 *   node d1-chaser-search.mjs --levels=63,98 [--ticks=96] [--max=4]
 */
const M = '../../../../frontend/modules/seedlingDemo/';
const { ropeStaging } = await import(`${M}fidelityRope.js`);
const { createRunForStaging } = await import(`${M}tapeRunner.js`);
const { atlasLevelSource } = await import(`${M}levelSource.js`);
const { withContactFidelity } = await import(`${M}contactFidelity.js`);
const { inventorySlotsFor, INVENTORY_ITEM_IDS } = await import(`${M}tapeFormat.js`);
const { withKillLockBodies } = await import(`${M}killLockBodies.js`);
const { KILLLOCK_ALL_ON } = await import(`${M}killLockWitness.js`);

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
const levels = (arg('levels') ?? '63').split(',').map(Number);
const TICKS = Number(arg('ticks') ?? 96);
const MAX = Number(arg('max') ?? 4);
const levelSource = atlasLevelSource();

function play(staging, keys, on) {
    return withKillLockBodies(KILLLOCK_ALL_ON, () => withContactFidelity({ spearGameTest: on }, () => {
        let run;
        try { run = createRunForStaging(staging, levelSource); } catch (e) { return { err: e.message.slice(0, 80) }; }
        const seq = [];
        let err = null;
        try {
            for (const k of keys) {
                run.advance(new Set(k));
                const sp = run.entities('spinnerBodies');
                const spin = (sp ? [...(sp.values?.() ?? sp)] : []).map((b) => `${b.id}:${b.hits ?? b.spinner?.hits ?? '?'}`);
                const wf = (run.entities('wallFlyers') ?? []).map?.((w) => `${w.id}:${w.hits}`) ?? [];
                seq.push([...(run.entities('chasers') ?? []).map((c) => `${c.id}:${c.hits}`), ...spin, ...wf].join(' ')
                    + ` P${run.damage.hits}`);
            }
        } catch (e) { err = e.message.slice(0, 140); }
        return { seq, err, presses: run.presses.filter((p) => p.weapon === 'spear'), level: run.level };
    }));
}

for (const level of levels) {
    const probe = await ropeStaging({ boot: { level, x: 0, y: 0 }, items: ['hasSpear'], persistence: [] });
    const slot = inventorySlotsFor(probe.seam.items).indexOf(INVENTORY_ITEM_IDS.spear);
    const world = createRunForStaging({ ...probe, boot: { level, x: 8, y: 8 } }, levelSource).world;
    const tiles = world.walkableTiles ?? [];
    let found = 0;
    console.log(`L${level}: ${tiles.length} walkable tile(s)`);
    for (const t of tiles) {
        if (found >= MAX) break;
        for (const dir of ['right', 'up', 'left', 'down']) {
            const staging = { ...probe, boot: { level, x: t.tx * 16, y: t.ty * 16 }, equips: [{ t: 0, slot }] };
            const keys = [[dir], ...Array.from({ length: TICKS }, (_, i) => (i % 8 === 5 ? ['primary'] : []))];
            const off = play(staging, keys, false);
            if (off.err && off.seq.length < 3) continue;
            const on = play(staging, keys, true);
            const n = Math.min(off.seq.length, on.seq.length);
            let i = 0;
            while (i < n && off.seq[i] === on.seq[i]) i += 1;
            if (i === n && (off.err ?? null) === (on.err ?? null)) continue;
            found += 1;
            const ENEMY = new Set(['Enemy', 'Spinner', 'ShieldBoss', 'FinalBoss', 'Watcher']);
            const rows = (ps) => ps.filter((p) => p.hits.some((h) => ENEMY.has(h.as3)))
                .map((p) => `f${p.fired}${p.repeat != null ? `+r${p.repeat}` : ''}[${p.hits.filter((h) => ENEMY.has(h.as3)).map((h) => `${h.id}${h.landed ? '' : '(no)'}`).join(',')}]`).join(' ');
            console.log(`  boot(${t.tx * 16},${t.ty * 16}) tap ${dir}: first diff at tick ${i}: OFF {${off.seq[i]}} ON {${on.seq[i]}}`
                + `${off.err || on.err ? ` errs OFF[${off.err}] ON[${on.err}]` : ''}\n    OFF ${rows(off.presses)}\n    ON  ${rows(on.presses)}`);
            break;
        }
    }
}
