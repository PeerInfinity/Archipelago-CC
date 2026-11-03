// scratch (BK2COMBAT): replay saved latch keys (latch.mjs OUT=) on a fresh latch boot (AT header, TREE=1 pocket shut) up
// to tick T (default: the end), then ask deriveKillByChaser for BODY with AIM, printing every candidate's verdict
// (the refusal shows three). Decides nothing. Usage: AT=hx,hy TREE=1 T=712 BODY=id AIM=x,y node huntprobe.mjs <keys.json>
const ROOT = process.env.ROOT ?? '/home/user/Archipelago-CC';
const M = ROOT + '/frontend/modules/seedlingDemo/';
const fs = await import('node:fs');
const { l40LatchBoot } = await import(M + 'fidelityL40Latch.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { buildTape } = await import(M + 'botDriverV1.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const SB = await import(M + 'solverBot.js');
const saved = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let boot = await l40LatchBoot();
if (process.env.AT) { const [x, y] = process.env.AT.split(',').map(Number); boot = { ...boot, boot: { ...boot.boot, x, y } }; }
if (process.env.TREE === '1') boot = { ...boot, persistence: boot.persistence.filter((p) => !(p.level === 40 && p.tag === 0)) };
const T = Number(process.env.T ?? saved.perTick.length);
const keys = saved.perTick.slice(0, T);
const folded = buildTape(keys.map((k) => new Set(k)), boot.boot, 'lw', { noclip: false, noDamage: false, noHazards: [], grants: [] });
const tape = parseTape(JSON.stringify({ ...boot, name: 'lw', tick_count: keys.length, inputs: folded.inputs, equips: [...(boot.equips ?? []), ...(saved.equips ?? [])] }));
let run = null;
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
for (let r = st.next(); !r.done; r = st.next()) { /* step */ }
console.log('at t', run.ticksCompleted, 'pos', run.state.x.toFixed(1), run.state.y.toFixed(1), 'hits', run.playerHits.length,
    'chasers', run.entities('chasers').map((c) => c.id ?? c).filter((id) => /736|880,832/.test(id)).join(','));
const body = run.entities('strikeBodies').find((b) => b.id === process.env.BODY);
console.log('body', JSON.stringify(body && { id: body.id, rect: body.rect, kind: body.kind }));
const [ax, ay] = (process.env.AIM ?? '888,824').split(',').map(Number);
const h = SB.deriveKillByChaser(run, body, new Set(), { aim: { x: ax, y: ay }, tolerance: 1.0 });
console.log(h.stance ? `STANCE ${JSON.stringify(h.stance)} ticks ${h.ticks}` : `NONE ${String(h.why).slice(0, 4000)}`);
for (const r of h.runnersUp ?? []) console.log('RUNNERUP', JSON.stringify(r));
