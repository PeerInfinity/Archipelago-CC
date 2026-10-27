// the F2 census: every tick a lock's run alpha differs from the skin's (OFF) — tape, t, id; and whether the
// lock was re-pressed on the next step (the behavioural half of F2).
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { runTape } = await import(R + 'tapeRunner.js');
const { atlasLevelSource } = await import(R + 'levelSource.js');
const { solidsSkinView, stepSolidsSkin, RESPONDER_CLASS } = await import(R + 'seedlingSolidsSkin.js');
const names = process.argv.slice(2);
for (const name of names) {
    const tape = JSON.parse(readFileSync(R + `fixtures/tapes/${name}.json`, 'utf8'));
    let skin = null; let prevOpen = new Map(); const lagAt = [];
    let last = new Map();
    runTape(tape, { levelSource: atlasLevelSource(), onTick: (t, now, held, run) => {
        const view = solidsSkinView(run, { record: null });
        skin = stepSolidsSkin(skin, view, t);
        const live = new Map((run.activatorsNow?.responders ?? []).map((r) => [r.id, r]));
        for (const a of view.responders) {
            const st = skin.responders.get(a.id); const r = live.get(a.id);
            if (!st || !r || RESPONDER_CLASS[a.tag] !== 'lock') continue;
            const pending = last.get(a.id);
            if (pending) { console.log(`  next step t${t} ${a.id}: held ${r.held} open ${r.open} runAlpha ${r.alpha}`); last.delete(a.id); }
            if (prevOpen.get(a.id) && !r.open) { lagAt.push({ t, id: a.id, run: r.alpha, skin: st.alpha }); last.set(a.id, true); }
        }
        prevOpen = new Map([...live].map(([id, r]) => [id, r.open]));
    } });
    if (lagAt.length) console.log(name, JSON.stringify(lagAt));
}
