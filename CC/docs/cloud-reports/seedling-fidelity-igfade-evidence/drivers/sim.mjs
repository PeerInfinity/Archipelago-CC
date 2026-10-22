// The model over a witness tape: per tick the player, the clock's dead frames, and the igneous events.
// node sim.mjs <tape.json> [<game.json from probe-igfade.mjs>]   (switches from the env: SEEDLING_IGNEOUS_DEAD_FRAMES=1 …)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const MOD = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', 'frontend', 'modules', 'seedlingDemo');
const { createTapeStepper } = await import(join(MOD, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MOD, 'levelSource.js'));
const tape = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const game = process.argv[3] ? JSON.parse(readFileSync(process.argv[3], 'utf8')) : null;
let run = null;
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
const rows = [];
let err = null;
try {
    for (let r = st.next(); !r.done; r = st.next()) {
        const o = r.value.observation;
        rows.push({ t: o.t, level: o.level, x: o.x, y: o.y, dead: run ? run.deadFramesOwed : null });
    }
} catch (e) { err = e; }
const gObs = new Map((game?.obs ?? []).map((o) => [o.t, o]));
const gDead = new Map((game?.rows ?? []).map((r) => [r.t, r.game.dead]));
let worst = 0; let first = null; let deadOff = null;
for (const m of rows) {
    const g = gObs.get(m.t);
    if (g) {
        const d = g.level === m.level ? Math.max(Math.abs(g.x - m.x), Math.abs(g.y - m.y)) : Infinity;
        if (d > 1e-9 && first === null) first = m.t;
        worst = Math.max(worst, d);
    }
    // calibrated: the game's sample at tick T reads the dead frames after the model's tick T - 1
    const gd = gDead.get(m.t + 1);
    if (gd !== undefined && gd !== null && gd !== m.dead && deadOff === null) deadOff = { t: m.t, game: gd, model: m.dead };
}
const jumps = rows.filter((r, i) => i > 0 && r.dead !== rows[i - 1].dead).map((r) => `t${r.t}:${r.dead}`);
console.log(JSON.stringify({ tape: tape.name, ticks: rows.length, error: err ? `${err.code ?? ''} ${err.message.slice(0, 300)}` : null,
    worst, firstOff: first, deadOff, modelDeadJumps: jumps,
    gameDeadJumps: game ? game.rows.filter((r, i) => i > 0 && r.game.dead !== game.rows[i - 1].game.dead).map((r) => `t${r.t}:${r.game.dead}`) : null,
    deaths: run?.playerDeaths?.map((d) => d.t ?? d) ?? null,
    igneous: (run?.igneousEvents ?? []).filter((e) => e.event !== 'frame').map((e) => `${e.tile}:${e.event}@t${e.t}${e.dead ? `(${e.dead})` : ''}`) }, null, 1));
