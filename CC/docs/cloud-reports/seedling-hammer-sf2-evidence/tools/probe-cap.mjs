// SCRATCH (seedling-hammer-sf2 D2): G1's committed witness walk (staging A, ghost sword), sampled every STEP ticks:
// one derivation per sample under OFF and under ON at each preview cap — where the gate rows' ticks come from.
//   node probe-cap.mjs [--step=10] [--caps=0,2,4,8,16,Infinity] > out.jsonl     (REPO = the tree)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const STEP = Number(arg('step', '10'));
const CAPS = arg('caps', '0,2,4,8,16,Infinity').split(',').map(Number);
const { STRIKE_ETA_FLOOR, deriveStrike, withStrikeEtaFloor } = await M('solverBot.js');
const { createRunForStaging, createTapeStepper, stagingFromTape } = await M('tapeRunner.js');
const { parseTape } = await M('tapeFormat.js');
const { atlasLevelSource } = await M('levelSource.js');
const tape = parseTape(readFileSync(join(REPO, 'frontend/modules/seedlingDemo/fixtures/hammer-g1-ghostkill-witness/hammer-g1-l40-ghostkill.tape.json'), 'utf8'));
const held = [];
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h) => { held[t] = h; } });
for (let r = st.next(); !r.done; r = st.next());
const run = createRunForStaging({ ...stagingFromTape(tape), equips: [] }, atlasLevelSource());
const short = (r) => (r === null ? null : r.cell === null ? null : [r.cell.x, r.cell.y, r.pressAt, r.eta]);
const was = STRIKE_ETA_FLOOR.previewCap;
for (const k of held.filter(Boolean)) {
    const t = run.ticksCompleted;
    if (t % STEP === 0 && (run.entities('spinnerBodies') ?? []).some((b) => b.id === 'spinner@880,848')) {
        const row = { t, off: short(withStrikeEtaFloor(false, () => deriveStrike(run, 'spinner@880,848', new Set(), 0))) };
        for (const cap of CAPS) {
            STRIKE_ETA_FLOOR.previewCap = cap;
            const r = withStrikeEtaFloor(true, () => deriveStrike(run, 'spinner@880,848', new Set(), 0));
            row[`k${cap}`] = short(r);
            row[`s${cap}`] = r?.scanned ?? null;
            row[`c${cap}`] = r?.capSkipped ?? null;
        }
        STRIKE_ETA_FLOOR.previewCap = was;
        console.log(JSON.stringify(row));
    }
    run.advance(k);
}
