// Stage `r6-owl-kill` (or another tape) with optional dark-suit grant, keys ON/OFF; dump Owl contacts + ticks.
// node stage.mjs [tape=r6-owl-kill] [ticks=816] [owl=0|1] [dsbr=0|1] [suit=0|1] [presses=0|1] [hold=<key> from=<t>] [noDamage=0|1] [health=N]
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { atlasLevelSource } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { createRunForStaging, stagingFromTape } from '../../../../../frontend/modules/seedlingDemo/tapeRunner.js';
import { loadTape } from '../../../../../frontend/modules/seedlingDemo/fixtures/index.js';
import { heldKeysAt } from '../../../../../frontend/modules/seedlingDemo/tapeFormat.js';

export function stage({ tape: name = 'r6-owl-kill', ticks = 816, owl = false, dsbr = false, suit = true, presses = true,
    hold = null, from = 0, noDamage = null, health = 0, keysAt = null, stripFrom = 0 }) {
    const tape = loadTape(name);
    const extra = [...(suit ? ['darksuit'] : []), ...Array(health).fill('health')];
    const grants = [...(tape.grants ?? []), ...(extra.length ? [{ level: tape.boot.level, items: extra }] : [])];
    return withContactFidelity({ owlContactInStep: owl, darkSuitBossRetaliation: dsbr }, () => {
        const st = stagingFromTape(tape);
        const run = createRunForStaging({ ...st, grants, noDamage: noDamage ?? st.noDamage }, atlasLevelSource());
        let thrown = null; let t = 0;
        try {
            for (; t < ticks; t += 1) {
                let keys = keysAt ? keysAt(t, tape) : heldKeysAt(tape, t);
                if (!presses && t >= stripFrom) keys = new Set([...keys].filter((k) => k !== 'primary'));
                if (hold !== null && t >= from) keys = new Set([hold]);
                run.advance(keys);
            }
        } catch (e) { thrown = `t${t}: ${e.message}`; }
        return { thrown, t, run, hits: run.ledger('playerHits').filter((h) => h.source === 'owlBody'),
            owlTicks: run.owlTicks };
    });
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const o = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')));
    const r = stage({ tape: o.tape, ticks: o.ticks ? +o.ticks : undefined, owl: o.owl === '1', dsbr: o.dsbr === '1',
        suit: o.suit !== '0', presses: o.presses !== '0', hold: o.hold ?? null, from: +(o.from ?? 0),
        noDamage: o.noDamage === undefined ? null : o.noDamage === '1', health: +(o.health ?? 0), stripFrom: +(o.stripFrom ?? 0) });
    console.log(JSON.stringify({ thrown: r.thrown?.slice(0, 900) ?? null, ticksRun: r.t, hits: r.hits,
        owlTicks: r.owlTicks.length, lastOwl: r.owlTicks.at(-1) }, null, 1));
}
