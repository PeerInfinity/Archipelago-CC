#!/usr/bin/env node
/**
 * plan-seedling-ghostmotion — ⛓⛓⛓ seedling-fidelity-ghostmotion: THE GHOST SWORD'S DASH CLOCK, DRIVEN ON THE GAME.
 *
 * A dash (`set slashing`'s first arm: `knockback(2, Point(x - v.x, y - v.y))`) re-arms only when the animation it
 * played ENDS: `slashEnd()` → `slashing = false` → `slashDashed = false`. The ghost sword plays its OWN animations
 * (`sprGhostSword`: "slash" 7 frames at 30, "slashnarrow" 4 at 20 → 7 and 6 ticks under the `FP.elapsed` clamp), not
 * the sword's (5 and 4). Until this slice `levelRun` timed the release off the SWORD's table for every swing, so a
 * press 5–6 ticks after a ghost dash was a second dash in the model (+2 px along travel) and SWALLOWED in the game.
 * That is the wave-10 sweep's 18 tick-exact legs (|Δ| 2.00 on an axis, 1.41 on a diagonal, at t 9 or t 29).
 *
 *   ghostmotion-l102-axis   leg 760's own plan: L102 (176,96), the sword + the ghost sword, `right` held, presses at
 *                           t 0 · 2 · 8 · 14 (the SWORD's dash chain, `DASH_CHAIN_PATTERN`). The game: swing, dash,
 *                           SWALLOWED (the t2 dash's animation is still up — it ends at t 8, below the press), dash;
 *                           the BEFORE model is 2.00 px ahead at t 9. The walk takes the teleporter to L107.
 *   ghostmotion-l102-diag   L102 (96,144), open floor, `right`+`down` held, presses at t 0 · 2 · 9 · 15: swing, dash,
 *                           dash (gap 7: the t2 dash ended at t8), SWALLOWED (gap 6). The knockback splits over both
 *                           axes, so the BEFORE model's extra dash (at t15) is 2/√2 = 1.41 px on each, at t 16.
 *                           With the axis tape's gap-6 swallow this pins the ghost dash clock at exactly 6.
 *
 * Each tape is authored with `GHOSTSWORD_MOTION` ON and asserts the BEFORE model (OFF) leaves it at the press: that is
 * the defect, reproduced by name. Recorded on the GAME (`check-seedling-bot-differential --record --only=<name>`).
 *
 * The stances and schedules are CHOSEN, not derived — a witness is not a solve.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-ghostmotion.mjs            # write the tapes
 *   node scripts/procgen/plan-seedling-ghostmotion.mjs --check    # exit 1 on drift
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
    const TAPES = join(MODULE, 'fixtures', 'tapes');

    const CHECK = process.argv.includes('--check');

    const { parseTape, PIN_NAMES } = await import(join(MODULE, 'tapeFormat.js'));
    const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { ROLES } = await import(join(MODULE, 'levelWorld.js'));
    const { GHOSTSWORD_PRESS, GHOSTSWORD_MOTION, withGhostSwordMotion } = await import(join(MODULE, 'ghostSword.js'));

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };

    if (GHOSTSWORD_PRESS.enabled !== true || GHOSTSWORD_MOTION.enabled !== true) {
        console.error('plan-seedling-ghostmotion: `GHOSTSWORD_PRESS` and `GHOSTSWORD_MOTION` must both be ON (unset '
            + 'SEEDLING_GHOSTSWORD / SEEDLING_GHOSTMOTION, or set them to 1).');
        process.exit(2);
    }

    const levelSource = atlasLevelSource();
    const ITEMS = Object.freeze({ hasSword: true, hasGhostSword: true });

    function stage(boot, items) {
        return createLevelRun({
            levelSource,
            boot,
            noclip: false,
            noHazards: [],
            noDamage: false,
            grants: [],
            persistence: [],
            despawn: [],
            equips: [],
            pins: [...PIN_NAMES],
            save: { totem_parts: [], keys: [], seal_parts: [] },
            rng: null,
            seam: { items },
            roles: ROLES,
        });
    }

    function tapeJson(name, boot, perTick, items, description) {
        const folded = buildTape(perTick, boot, name,
            { noclip: false, noDamage: false, noHazards: [], grants: [] });
        const tape = {
            game: 'seedling',
            name,
            boot,
            noclip: false,
            noDamage: false,
            noHazards: [],
            grants: [],
            persistence: [],
            equips: [],
            pins: [...PIN_NAMES],
            save: { totem_parts: [], keys: [], seal_parts: [] },
            rng: { seed: 1, split: false },
            seam: { items },
            tick_count: perTick.length,
            inputs: folded.inputs,
            tape_version: 8,
        };
        const parsed = parseTape({ ...tape, description });
        return `${JSON.stringify({ ...parsed, description, note: '' }, null, 4)}\n`;
    }

    function emit(name, json) {
        const path = join(TAPES, `${name}.json`);
        if (CHECK) {
            const same = existsSync(path) && readFileSync(path, 'utf8') === json;
            check(`⛓ the committed ${name} is what this script produces today`, same,
                same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
        } else {
            writeFileSync(path, json);
            console.log(`wrote ${path.slice(REPO.length + 1)}`);
        }
    }

    /** Drive `perTick` once; the per-tick player rows and the press outcomes. */
    function drive(boot, perTick) {
        const run = stage(boot, ITEMS);
        const rows = [];
        let transition = null;
        for (let t = 0; t < perTick.length; t += 1) {
            const r = run.advance(perTick[t]);
            rows.push({ t: t + 1, level: run.level ?? boot.level, x: run.state.x, y: run.state.y, vx: run.state.vx, vy: run.state.vy });
            if (r?.transition && !transition) transition = { ...r.transition, t };
        }
        const outcomes = run.slashPresses.map((p) => `${p.t}:${p.outcome}`);
        return { rows, transition, outcomes };
    }

    function author({ name, boot, walk, ticks, pressAt, onOutcomes, offOutcomes, apartAt, expectDelta, story }) {
        const perTick = [];
        for (let t = 0; t < ticks; t += 1) {
            const held = new Set(walk);
            if (pressAt.includes(t)) held.add('primary');
            perTick.push(held);
        }
        const on = drive(boot, perTick);
        const off = withGhostSwordMotion(false, () => drive(boot, perTick));
        check(`⛓⛓⛓ ${name}: the ghost sword's chain (its dash animation is 6 ticks) — ${onOutcomes.join(' ')}`,
            JSON.stringify(on.outcomes) === JSON.stringify(onOutcomes), JSON.stringify(on.outcomes));
        check(`⛓⛓ ${name}: the BEFORE model (motion OFF, the sword's 4-tick dash clock) — ${offOutcomes.join(' ')}`,
            JSON.stringify(off.outcomes) === JSON.stringify(offOutcomes), JSON.stringify(off.outcomes));
        const firstApart = on.rows.findIndex((r, i) => r.x !== off.rows[i].x || r.y !== off.rows[i].y);
        const a = on.rows[firstApart];
        const b = off.rows[firstApart];
        const dx = b ? b.x - a.x : NaN;
        const dy = b ? b.y - a.y : NaN;
        // ⚠ `t` is ticks COMPLETED (the sweep's and the plan's `expected[t]` convention): the t 8 press shows at t 9.
        check(`⛓⛓ ${name}: OFF leaves ON at t ${apartAt} by (${expectDelta.map((d) => d.toFixed(2)).join(', ')}) px — the `
            + 'swallowed press\'s knockback, along travel',
            a?.t === apartAt && Math.abs(dx - expectDelta[0]) < 1e-9 && Math.abs(dy - expectDelta[1]) < 1e-9,
            `first apart t ${a?.t}, Δ (${dx?.toFixed(4)}, ${dy?.toFixed(4)})`);
        const description = `⛓⛓⛓ seedling-fidelity-ghostmotion — ${story} Holding the sword AND the ghost sword, `
            + `presses at t ${pressAt.join(' · ')}. The game (and the model, GHOSTMOTION ON): ${onOutcomes.join(' · ')}. `
            + 'The ghost "slash" is 7 frames at 30 = 7 ticks and its "slashnarrow" 4 at 20 = 6 ticks; a dash re-arms only '
            + 'at `slashEnd` (from `sprites()`, BELOW the press), so a press 6 ticks after a ghost dash is SWALLOWED and '
            + 'one 7 ticks after dashes. The model before fidelity GHOSTMOTION released every swing on the SWORD\'s clock '
            + `(4 ticks for a dash): ${offOutcomes.join(' · ')} — (${expectDelta.map((d) => d.toFixed(2)).join(', ')}) px `
            + `ahead at t ${apartAt}. Authored by scripts/procgen/plan-seedling-ghostmotion.mjs.`;
        emit(name, tapeJson(name, boot, perTick, ITEMS, description));
        console.log(`## ${name}: ${perTick.length} ticks, outcomes ${on.outcomes.join(' ')}, transition `
            + `${JSON.stringify(on.transition)}, end (${on.rows.at(-1).x.toFixed(2)}, ${on.rows.at(-1).y.toFixed(2)})`);
    }

    author({
        name: 'ghostmotion-l102-axis',
        boot: Object.freeze({ level: 102, x: 176, y: 96 }),
        walk: ['right'],
        ticks: 24,
        pressAt: [0, 2, 8, 14],
        onOutcomes: ['0:slash', '2:dash', '8:swallowed', '14:dash'],
        offOutcomes: ['0:slash', '2:dash', '8:dash', '14:dash'],
        apartAt: 9,
        expectDelta: [2, 0],
        story: 'THE GHOST DASH CLOCK ON AN AXIS (sweep leg 760\'s plan). L102 at (176,96), `right` held.',
    });
    author({
        name: 'ghostmotion-l102-diag',
        boot: Object.freeze({ level: 102, x: 96, y: 144 }),
        walk: ['right', 'down'],
        ticks: 24,
        // ⛓ gap 7 (2 → 9) DASHES and gap 6 (9 → 15) is SWALLOWED: with the axis tape's gap 6 this pins the ghost dash
        // clock at EXACTLY 6 — the axis tape alone cannot tell 6 from 7.
        pressAt: [0, 2, 9, 15],
        onOutcomes: ['0:slash', '2:dash', '9:dash', '15:swallowed'],
        offOutcomes: ['0:slash', '2:dash', '9:dash', '15:dash'],
        apartAt: 16,
        expectDelta: [Math.SQRT2, Math.SQRT2],
        story: 'THE GHOST DASH CLOCK ON A DIAGONAL. L102 at (96,144), open floor, `right`+`down` held: the '
            + 'knockback splits over both axes (2/√2 each).',
    });

    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}
