// scratch: does the tape-staged run equal the skin test's jsRuntime boot (ON and OFF), tick by tick?
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const M = R + 'frontend/modules/seedlingDemo/';
const { createJsRuntime } = await import(M + 'jsRuntimeCore.js');
const { ropeStaging } = await import(M + 'fidelityRope.js');
const { buildStagedTape } = await import(M + 'botDriverV1.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const MAP = JSON.parse(readFileSync(R + 'frontend/modules/flashPanel/atlases/seedling-map.json', 'utf8'));
const GAME = JSON.parse(readFileSync(R + 'frontend/modules/flashPanel/games/seedling.json', 'utf8'));
const FIGHT = ['primary', '', '', '', '', '', '', '', '', 'left', 'left', '', '', '', '', '', '', '', '', 'right+primary',
    '', '', '', '', '', '', '', '', '', '', '', 'down+primary', '', '', '', '', '', '', '', 'up', 'up', '', '', ''];
const keys = Array.from({ length: 300 }, (_, i) => { const k = FIGHT[i % FIGHT.length]; return new Set(k ? k.split('+') : []); });
const fmt = (run) => `p(${run.state.x},${run.state.y}) ` + run.chasers.map((c) => `${c.id}(${c.x},${c.y} h${c.hits}${c.dying ? 'D' : ''})`).join(' ');
for (const [name, level, x, y] of [['lavarunner-L71', 71, 96, 200], ['bulb-L74', 74, 80, 100]]) {
    for (const on of [true, false]) {
        const a = withContactFidelity({ pixelMaskSightLines: on }, () => {
            const rt = createJsRuntime({ onStateChanged: () => {}, log: () => {} });
            rt.game.configure(JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties }));
            rt.setVanilla(MAP);
            rt.queueItems([{ class: 'game', property: 'menu', value: false }, { class: 'Main', property: 'hasSword', value: true },
                { invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
            const out = [];
            for (const h of keys) { rt.tick(h); out.push(rt.run ? `t${rt.ticks} ${fmt(rt.run)}` : `t${rt.ticks} -`); }
            return out;
        });
        const staging = await ropeStaging({ boot: { level, x, y }, items: ['hasSword'], persistence: [] });
        const tape = buildStagedTape({ staging, perTick: keys, name });
        const b = withContactFidelity({ pixelMaskSightLines: on }, () => {
            let run = null; const out = [];
            const st = createTapeStepper(parseTape(JSON.stringify(tape)), { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
            try { for (let r = st.next(); !r.done; r = st.next()) out.push(`t${r.value.observation.t} ${fmt(run)}`); } catch (e) { out.push('ERR ' + e.message.slice(0, 60)); }
            return out;
        });
        console.log(name, on ? 'ON' : 'OFF', 'rt', a.length, 'tape', b.length, '| rt[0..2]', a.slice(0, 2).join(' / '), '| tape[0..2]', b.slice(0, 2).join(' / '));
        const strip = (s) => s.replace(/^t\d+ /, '');
        let off = null; for (let i = 0; i < Math.min(a.length, b.length); i++) if (strip(a[i]) !== strip(b[i + 1])) { off = i; break; }
        console.log('  first differing row (same index):', off, off !== null ? `\n   rt  ${a[off]}\n   tape ${b[off + 1]}` : '');
    }
}
