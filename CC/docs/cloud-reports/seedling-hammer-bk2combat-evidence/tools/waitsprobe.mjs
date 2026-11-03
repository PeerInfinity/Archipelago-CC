// scratch (BK2COMBAT): the latch boot (pocket shut) stepped T still ticks from AT, then deriveKillByChaser(BODY, AIM)
// OFF and ON — does the ON answer carry `waits`, and is everything else equal? Decides nothing.
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { l40LatchBoot } = await import(M + 'fidelityL40Latch.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { buildTape } = await import(M + 'botDriverV1.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const SB = await import(M + 'solverBot.js');
let boot = await l40LatchBoot();
const [x, y] = (process.env.AT ?? '480,571').split(',').map(Number);
boot = { ...boot, boot: { ...boot.boot, x, y }, persistence: boot.persistence.filter((p) => !(p.level === 40 && p.tag === 0)) };
const keys = Array.from({ length: Number(process.env.T ?? 1) }, () => []);
const folded = buildTape(keys.map((k) => new Set(k)), boot.boot, 'w', { noclip: false, noDamage: false, noHazards: [], grants: [] });
const tape = parseTape(JSON.stringify({ ...boot, name: 'w', tick_count: keys.length, inputs: folded.inputs, equips: [] }));
let run = null;
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
for (let r = st.next(); !r.done; r = st.next());
const body = { id: process.env.BODY ?? 'bobsoldier@880,832' };
const [ax, ay] = (process.env.AIM ?? '888,824').split(',').map(Number);
const t0 = Date.now();
const off = SB.withChaserStagedHunt(false, () => SB.deriveKillByChaser(run, body, new Set(), { aim: { x: ax, y: ay }, tolerance: 1.0 }));
const on = SB.withChaserStagedHunt(true, () => SB.deriveKillByChaser(run, body, new Set(), { aim: { x: ax, y: ay }, tolerance: 1.0 }));
const { waits, ...rest } = on;
console.log('ms', Date.now() - t0, 'pos', run.state.x, run.state.y);
console.log('OFF', off.stance ? JSON.stringify(off.stance) : String(off.why).slice(0, 600));
console.log('OFF keys', Object.keys(off).join(','), 'ON keys', Object.keys(on).join(','));
console.log('ON minus waits == OFF', JSON.stringify(rest) === JSON.stringify(off));
console.log('waits', JSON.stringify(waits));
