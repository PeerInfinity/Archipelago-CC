#!/usr/bin/env node
/**
 * plan-seedling-bulb — ⛓⛓⛓ seedling-fidelity-bulb: THE BULB'S DRIVEN WITNESSES.
 *
 * The Bulb is a stepped chaser whose death writes LAVA under its centre (`chasers.CHASERS.bulb`, `bulb.js`,
 * `contactFidelity.bulbLive` — OFF by default). These tapes are authored against the model with the switch ON,
 * recorded on the GAME by `probe-seedling-chaser-mobiles.mjs --class=Bulb --record` (which embeds the tape in
 * `fixtures/chaser-witness/<name>.json`), and replayed by `fidelityBulb.test.js`. They are NOT roster tapes: the
 * roster replays under the default model, where the Bulb is a static body.
 *
 *   bulb-l77-lava   L77, the player booted at (88,40) north of `bulb@80,72` (built at (88,80)) with a sword, facing
 *                   south: the Bulb chases; one press kills it (`hitsMax` 1); its armed update, "drop" (the slide to
 *                   its tile's centre), the lava write, "die", the removal; then the player walks SOUTH onto the
 *                   written tile, takes the lava hit, drowns and dies — and after `restartLevel()` the rebuilt room
 *                   has the Bulb back and the tile restored (the write lasts the VISIT), which the walk re-crosses.
 *   bulb-l77-placed L77, the player at (120,104) — the top of the one-tile column (7,6)–(7,9) that is the only way to
 *                   the south exit — standing still under the SOLVER's own strike policy (`strikePolicyFor`) with
 *                   that exit as the segment's need (`bulbPlacement.setDropKillNeeds`): every press is the policy's,
 *                   its veto asked before each one, and the kill it takes writes its lava where nothing is cut.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-bulb.mjs --out=<dir>     # write each tape as <dir>/<name>.json
 *   node scripts/procgen/plan-seedling-bulb.mjs --check         # exit 1 if a recorded witness's tape drifted
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
    const WITNESS = join(MODULE, 'fixtures', 'chaser-witness');

    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const CHECK = process.argv.includes('--check');
    const OUT = arg('out');
    if (!CHECK && !OUT) {
        console.error('plan-seedling-bulb: --out=<dir> or --check is required');
        process.exit(2);
    }

    const { parseTape, PIN_NAMES } = await import(join(MODULE, 'tapeFormat.js'));
    const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { ROLES } = await import(join(MODULE, 'levelWorld.js'));
    const { chaserBoxAt } = await import(join(MODULE, 'chasers.js'));
    const { distanceRectPoint, SLASH_REACH } = await import(join(MODULE, 'presses.js'));
    const { withContactFidelity } = await import(join(MODULE, 'contactFidelity.js'));
    const { exitAimFor, strikePolicyFor } = await import(join(MODULE, 'solverBot.js'));
    const { setDropKillNeeds, dropKillVetoFor } = await import(join(MODULE, 'bulbPlacement.js'));

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const levelSource = atlasLevelSource();

    const stage = (boot, items) => createLevelRun({
        levelSource, boot, noclip: false, noHazards: [],
        // ⚠ FALSE — under `noDamage` the run steps no chaser.
        noDamage: false,
        grants: [], persistence: [], despawn: [], equips: [], pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] }, rng: null, seam: { items }, roles: ROLES,
    });

    function tapeOf(name, boot, perTick, items, description) {
        const folded = buildTape(perTick, boot, name, { noclip: false, noDamage: false, noHazards: [], grants: [] });
        const tape = {
            game: 'seedling', name, boot, noclip: false, noDamage: false, noHazards: [], grants: [], persistence: [],
            equips: [], pins: [...PIN_NAMES], save: { totem_parts: [], keys: [], seal_parts: [] },
            rng: { seed: 1, split: false }, seam: { items }, tick_count: perTick.length, inputs: folded.inputs,
            tape_version: 8,
        };
        const parsed = parseTape({ ...tape, description });
        return { ...parsed, description, note: '' };
    }

    function emit(name, tape) {
        if (CHECK) {
            const path = join(WITNESS, `${name}.json`);
            if (!existsSync(path)) {
                check(`⛓ ${name} has a recorded witness`, false, `no ${path.slice(REPO.length + 1)} — record it first`);
                return;
            }
            const recorded = JSON.parse(readFileSync(path, 'utf8')).tape;
            const same = JSON.stringify(recorded) === JSON.stringify(JSON.parse(JSON.stringify(tape)));
            check(`⛓ the recorded ${name}'s tape is what this script produces today`, same,
                same ? 'identical' : '⛔ DRIFT — re-author and re-record');
            return;
        }
        mkdirSync(OUT, { recursive: true });
        const path = join(OUT, `${name}.json`);
        writeFileSync(path, `${JSON.stringify(tape, null, 4)}\n`);
        console.log(`wrote ${path}`);
    }

    // ── bulb-l77-lava ────────────────────────────────────────────────────
    withContactFidelity({ bulbLive: true }, () => {
        const NAME = 'bulb-l77-lava';
        const BOOT = Object.freeze({ level: 77, x: 80, y: 32 });
        const ITEMS = { hasSword: true };
        const TARGET = 'bulb@80,72';
        const CADENCE = 31;
        const run = stage(BOOT, ITEMS);
        const perTick = [];
        let phase = 'fight';
        let last = -99;
        let after = 0;
        for (let i = 0; i < 600; i += 1) {
            const c = run.chasers.find((x) => x.id === TARGET);
            let held = new Set();
            if (phase === 'fight') {
                const b = c && !c.dying ? chaserBoxAt('bulb', c.x, c.y) : null;
                const reach = b ? distanceRectPoint(run.state.x, run.state.y, b) : Infinity;
                // ⚠ ONE tick of `down` first: `slash()` swings the way the player FACES.
                if (i === 0) held = new Set(['down']);
                else if (reach <= SLASH_REACH && i - last >= CADENCE) { held = new Set(['primary']); last = i; }
                if (run.bulbEvents.some((e) => e.kind === 'removed')) phase = 'lava';
            } else if (phase === 'lava') {
                held = new Set(['down']);
                if (run.playerDeaths.length > 0) phase = 'after';
            } else {
                after += 1;
                // the rebuilt room: wait for the fade-in, then re-cross the tile the lava was written on
                held = after > 40 && after <= 52 ? new Set(['down']) : new Set();
                if (after > 70) break;
            }
            perTick.push(held);
            run.advance(held);
        }
        const ev = run.bulbEvents;
        const drop = ev.find((e) => e.kind === 'drop');
        const lava = ev.find((e) => e.kind === 'lava');
        const removed = ev.find((e) => e.kind === 'removed');
        const kills = run.chaserKills;
        check('⛓ ONE kill, billed to the PRESS, at `hitsMax` 1', kills.length === 1 && kills[0].by === 'press'
            && kills[0].hits === 1, JSON.stringify(kills));
        check('⛓⛓ the armed update closes in "drop" one tick after the blow is billed',
            drop && drop.t === kills[0].t + 1, JSON.stringify({ kill: kills[0]?.t, drop: drop?.t }));
        check('⛓⛓ "drop" ends 27 graphic updates on, writing LAVA under the centre — the tile "drop" began on',
            lava && drop && lava.t - drop.t === 26 && lava.tile.tx === drop.tile.tx && lava.tile.ty === drop.tile.ty,
            JSON.stringify({ drop, lava }));
        check('⛓ "die" removes the body 27 updates after the lava write (no fade)', removed && lava
            && removed.t - lava.t === 27, JSON.stringify(removed));
        const lavaHits = run.playerHits.filter((h) => h.source === 'lava');
        const deaths = run.playerDeaths;
        check('⛓⛓⛓ the player walks onto the written tile, takes the lava hit and DROWNS',
            lavaHits.length >= 1 && deaths.length === 1 && deaths[0].source === 'lava' && deaths[0].t > lavaHits[0].t,
            JSON.stringify({ lavaHits: lavaHits.map((h) => h.t), deaths }));
        check('⛓ after `restartLevel()` the visit is new: the tile is restored and the Bulb is back',
            run.tileWrites.size === 0 && run.chasers.some((x) => x.id === TARGET), '');
        const description = '⛓⛓⛓ seedling-fidelity-bulb — THE BULB\'S DEATH WRITES LAVA. L77, the player at (88,40) '
            + 'north of `bulb@80,72` (built at (88,80)) with a sword, facing south. The Bulb chases (Bob\'s block, '
            + `moveSpeed 0.65); one press kills it (\`hitsMax\` 1, billed t ${kills[0]?.t}). \`startDeath\` is empty: the `
            + `armed update runs alive and ends in "drop" (t ${drop?.t}, tile (${drop?.tile.tx},${drop?.tile.ty})); `
            + 'the body slides to the tile\'s centre; "drop"\'s `endAnim` writes LAVA there and plays "die" '
            + `(t ${lava?.t}); "die"'s removes it (t ${removed?.t}, no fade). The player then walks south onto the tile: `
            + `the lava hit (t ${lavaHits[0]?.t}), the drown, \`die()\` (t ${deaths[0]?.t}) and \`restartLevel()\` — and `
            + 'the rebuilt room has the Bulb back and the tile restored, which the walk re-crosses. Authored by '
            + 'scripts/procgen/plan-seedling-bulb.mjs.';
        emit(NAME, tapeOf(NAME, BOOT, perTick, ITEMS, description));
        console.log(`## ${NAME}: ${perTick.length} ticks; kill t ${kills[0]?.t}, drop t ${drop?.t}, lava t ${lava?.t} `
            + `tile (${lava?.tile.tx},${lava?.tile.ty}), removed t ${removed?.t}, lava hit t ${lavaHits[0]?.t}, `
            + `death t ${deaths[0]?.t}`);
    });

    // ── bulb-l77-placed ──────────────────────────────────────────────────
    withContactFidelity({ bulbLive: true }, () => {
        const NAME = 'bulb-l77-placed';
        const BOOT = Object.freeze({ level: 77, x: 112, y: 96 });
        const ITEMS = { hasSword: true };
        const run = stage(BOOT, ITEMS);
        const opts = { liveBag: run.liveGeometryOpts(), avoidVolumes: false, keys: run.progress('keys'),
            contacts: new Set(), lattice: 16, inventory: run.progress('inventory'), noHazards: run.noHazards };
        const south = run.world.teleporters.findIndex((t) => t.rect.x === 96 && t.rect.y === 304);
        setDropKillNeeds(run, [{ what: 'the exit (96,304) → L78', aims: [exitAimFor(run.world, south, opts)],
            allowTeleporter: south }], () => opts);
        const veto = dropKillVetoFor(run);
        check('⛓ the needs are set, so the policy carries a veto', typeof veto === 'function', '');
        // the veto's own answer at the column's top and in the open, for the same body
        const at = (cx, cy) => ({ id: 'bulb@80,72', tag: 'bulb', hits: 0, rect: { x: cx - 6, y: cy - 6, right: cx + 6, bottom: cy + 6 } });
        const inColumn = veto(at(120, 104), { x: 120, y: 88 });
        const inOpen = veto(at(104, 88), { x: 120, y: 88 });
        check('⛔ a Bulb killed IN the column\'s mouth (7,6), the player north of it, is vetoed — its lava would cut the south exit', inColumn !== null,
            inColumn?.why?.slice(0, 160));
        check('⛓ the same Bulb in the open (6,5) is not', inOpen === null, '');
        const strike = strikePolicyFor(run);
        const perTick = [];
        for (let i = 0; i < 400; i += 1) {
            const d = strike.decide(run.state, run.entities('strikeBodies'), i, new Set());
            perTick.push(d.held);
            run.advance(d.held);
            const gone = run.bulbEvents.find((e) => e.kind === 'removed');
            if (gone && i + 1 >= gone.t + 10) break;
        }
        const ev = run.bulbEvents;
        const lava = ev.find((e) => e.kind === 'lava');
        const kills = run.chaserKills;
        check('⛓⛓ the POLICY kills it (one press, by the solver\'s own strike policy)', kills.length === 1
            && kills[0].by === 'press', JSON.stringify(kills));
        const cut = lava ? veto({ ...at(lava.x, lava.y) }, { x: run.state.x, y: run.state.y }) : 'no lava';
        check('⛓⛓ its lava lands where nothing the segment needs is cut', lava && cut === null,
            JSON.stringify(lava));
        check('the player takes no hit', run.playerHits.length === 0, JSON.stringify(run.playerHits));
        const description = '⛓⛓⛓ seedling-fidelity-bulb D3 — A PLACED KILL. L77, the player at (120,104), the top of '
            + 'the one-tile column to the south exit, standing still under the SOLVER\'s strike policy '
            + '(`strikePolicyFor`) with that exit as the segment\'s need: the policy asks its veto '
            + '(`bulbPlacement.dropKillVetoFor`) before every press — a Bulb killed IN the column would write lava '
            + 'across the only way south, and is refused — and takes the kill when `bulb@80,72` comes to it from '
            + `the open room (billed t ${kills[0]?.t}); "drop" t ${ev.find((e) => e.kind === 'drop')?.t}, LAVA at tile `
            + `(${lava?.tile.tx},${lava?.tile.ty}) t ${lava?.t}, removed t ${ev.find((e) => e.kind === 'removed')?.t}. `
            + 'Authored by scripts/procgen/plan-seedling-bulb.mjs.';
        emit(NAME, tapeOf(NAME, BOOT, perTick, ITEMS, description));
        console.log(`## ${NAME}: ${perTick.length} ticks; kill t ${kills[0]?.t}, lava t ${lava?.t} tile `
            + `(${lava?.tile.tx},${lava?.tile.ty})`);
    });

    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}
