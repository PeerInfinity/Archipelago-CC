/**
 * MEASUREMENT-ONLY probe (slice seedling-js-item-live-delivery, reviewer item 8): can `jsRuntimeCore` apply an AP
 * delivery while `mounted` is null, or while a NON-rewritten (generated) set is mounted? And what does a later mount do
 * to it? Changes no source.   node probe-item8-mount-order.mjs
 */
import { readFileSync } from 'node:fs';
const R = new URL('../../../../frontend/', import.meta.url).pathname;
const { createJsRuntime } = await import(R + 'modules/seedlingDemo/jsRuntimeCore.js');
const { assembleGeneratedSeedlingSet } = await import(R + 'modules/seedlingDemo/seedlingGeneratedSet.js');
const { planLevelSetChunks } = await import(R + 'modules/seedlingDemo/levelSetValidator.js');
const MAP = JSON.parse(readFileSync(R + 'modules/flashPanel/atlases/seedling-map.json', 'utf8'));
const GEN = JSON.parse(readFileSync(R + 'presets/seedling_generated_room/AP_1/AP_1_rules.json', 'utf8'));
const keyCall = (i) => ({ invocation: 'method_call', path: [{ class: 'Main' }], method: 'hasKeySet', args: [i, true] });
const sealCall = (s, id) => ({ invocation: 'method_call', path: [{ class: 'Main' }], method: 'hasSealPartSet', args: [s, id] });
const flag = (p) => ({ class: 'Main', property: p, value: true });
const tp = (l, x, y) => ({ invocation: 'new_instance', className: 'Game', args: [l, x, y] });
const assembled = assembleGeneratedSeedlingSet(GEN, { selfPlayer: 1 });
const mountSet = (rt) => { let r; for (const c of planLevelSetChunks(assembled.set).chunks) r = rt.game.botLoadLevels(JSON.stringify(c)); return r; };
const deliveries = (rt) => rt.events.filter((e) => e.type === 'delivery').map((e) => `${e.kind}${e.key ?? e.slot ?? e.property ?? ''}:${e.changed ? 'written' : 'no-op'}@L${e.level}`);
const out = {};

// A — nothing mounted: the vanilla first frame (`Main.as:51`) is the live run; the host delivers, THEN mounts.
{
    const rt = createJsRuntime({});
    rt.setVanilla(MAP);
    rt.tick();
    rt.queueItems([keyCall(1), sealCall(0, 3), flag('hasSword')]);
    rt.tick();
    const before = { mounted: rt.mounted?.kind ?? null, level: rt.run.level, runKeys: [...rt.run.keys], deliveries: deliveries(rt) };
    const m = mountSet(rt);
    const { x, y, level } = assembled.set.start;
    rt.queueItems([tp(level, x, y)]);
    rt.tick();
    out.A_delivered_with_nothing_mounted_then_mount = { before, mount: m, kind: rt.mounted?.kind,
        after: { level: rt.run.level, runKeys: [...rt.run.keys],
            sealSlot0: rt.run.saveState.bootSealParts[0] ?? -1, hasSword: rt.run.inventory.hasSword, flags_hasSword: rt.flags.hasSword } };
}
// B — a GENERATED (non-rewritten) set mounted: the host delivers into it.
{
    const rt = createJsRuntime({});
    rt.tick();
    mountSet(rt);
    const { x, y, level } = assembled.set.start;
    rt.queueItems([{ class: 'game', property: 'menu', value: false }, tp(level, x, y)]);
    rt.tick();
    rt.queueItems([keyCall(2), flag('hasShield')]);
    rt.tick();
    out.B_delivered_into_a_generated_set = { kind: rt.mounted.kind, level: rt.run.level, runKeys: [...rt.run.keys],
        hasShield: rt.run.inventory.hasShield, deliveries: deliveries(rt) };
}
console.log(JSON.stringify(out, null, 1));
