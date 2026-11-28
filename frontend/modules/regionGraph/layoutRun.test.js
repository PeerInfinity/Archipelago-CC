/**
 * ⛓ region-graph-layout-settled: a panel layout run settles ONCE, after its last position change, for an animated
 * and a non-animated layout, and a superseded run never settles (its waiters wait for the run that replaced it).
 * On the panel's vendored Cytoscape, headless with styles on (so animations run).
 */
import { describe, it, expect } from 'vitest';
import { loadCytoscape } from './regionGraphElements.testkit.js';
import { startLayout, supersedeLayout, whenLayoutSettled, layoutSettledCount, LAYOUT_SETTLED_EVENT } from './layoutRun.js';

const ELEMENTS = [
  ...['a', 'b', 'c', 'd', 'e'].map((id, i) => ({ data: { id }, position: { x: i * 10, y: 0 } })),
  { data: { id: 'ab', source: 'a', target: 'b' } }, { data: { id: 'bc', source: 'b', target: 'c' } },
  { data: { id: 'cd', source: 'c', target: 'd' } }, { data: { id: 'de', source: 'd', target: 'e' } },
];

/** A ui stub with a headless cy, and a trace of every position change, settle and layoutstop (in order). */
function makeUi() {
  const cytoscape = loadCytoscape();
  const cy = cytoscape({ headless: true, styleEnabled: true, elements: ELEMENTS });
  cy.style().selector('node').style({ width: 20, height: 20 }).update();
  const trace = [];
  const ui = { cy, isLayoutRunning: false, currentLayout: null, settles: [], onLayoutSettled: (info) => ui.settles.push(info.run) };
  cy.on('position', 'node', () => trace.push('position'));
  cy.on('viewport', () => trace.push('viewport'));
  cy.on('layoutstop', () => trace.push('layoutstop'));
  cy.on(LAYOUT_SETTLED_EVENT, () => trace.push('settled'));
  return { ui, cy, trace };
}

const preset = (k, extra = {}) => ({
  name: 'preset', positions: (n) => ({ x: 100 * k + n.id().charCodeAt(0), y: 50 * k }), fit: true, padding: 10, ...extra,
});
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

describe('⛓ layoutRun: "settled" means the nodes have stopped', () => {
  it('a NON-animated layout settles once, synchronously, after its last position change', async () => {
    const { ui, trace } = makeUi();
    startLayout(ui, preset(1, { animate: false }));
    expect(ui.isLayoutRunning).toBe(false);
    expect(ui.settles).toEqual([1]);
    const i = trace.indexOf('settled');
    expect(trace.slice(i + 1).filter((e) => e === 'position' || e === 'viewport')).toEqual([]);
    await tick(80);
    expect(trace.filter((e) => e === 'settled').length).toBe(1);
    expect(trace.slice(i + 1)).toEqual(['layoutstop']); // the cy-level listener hears the same layoutstop after
  });

  it('an ANIMATED preset settles once, after its last position change (nodes and fit)', async () => {
    const { ui, cy, trace } = makeUi();
    startLayout(ui, preset(2, { animate: true, animationDuration: 120 }));
    const settled = whenLayoutSettled(ui);
    expect(ui.isLayoutRunning).toBe(true);
    await settled;
    expect(ui.isLayoutRunning).toBe(false);
    expect(ui.settles).toEqual([1]);
    expect(trace.filter((e) => e === 'position').length).toBeGreaterThan(5); // it did animate
    const at = trace.indexOf('settled');
    expect(trace.slice(0, at).lastIndexOf('position')).toBeGreaterThan(-1);
    await tick(200);
    expect(trace.slice(at + 1).filter((e) => e !== 'layoutstop')).toEqual([]); // nothing moved after it
    expect(trace.filter((e) => e === 'settled').length).toBe(1);
    expect(cy.getElementById('a').position()).toEqual({ x: 200 + 97, y: 100 });
  });

  it('cose (animate: true, live) settles once, after its final positions and fit', async () => {
    const { ui, trace } = makeUi();
    startLayout(ui, { name: 'cose', animate: true, animationThreshold: 0, refresh: 2, numIter: 200, randomize: false, fit: true });
    expect(ui.isLayoutRunning).toBe(true);
    const settled = whenLayoutSettled(ui);
    await settled;
    const at = trace.indexOf('settled');
    await tick(120);
    expect(trace.slice(at + 1).filter((e) => e === 'position' || e === 'viewport')).toEqual([]);
    expect(trace.filter((e) => e === 'settled').length).toBe(1);
  });

  it('a superseded run never settles; its waiters resolve with the run that replaced it', async () => {
    const { ui, cy, trace } = makeUi();
    startLayout(ui, preset(1, { animate: true, animationDuration: 300 }));
    const early = whenLayoutSettled(ui);
    await tick(40);
    const first = ui.currentLayout;
    expect(ui.isLayoutRunning).toBe(true);
    startLayout(ui, preset(3, { animate: true, animationDuration: 100 }));
    expect(ui.currentLayout).not.toBe(first);
    const info = await early;
    expect(info.run).toBe(2);
    expect(ui.settles).toEqual([2]);
    await tick(400); // past the first run's own duration: it never comes back
    expect(ui.settles).toEqual([2]);
    expect(trace.filter((e) => e === 'settled').length).toBe(1);
    expect(trace.slice(trace.indexOf('settled') + 1).filter((e) => e === 'position' || e === 'viewport')).toEqual([]);
    expect(cy.getElementById('a').position()).toEqual({ x: 300 + 97, y: 150 });
  });

  it('a superseded cose (which runs one more frame after stop) writes no positions and no fit after the next run settles', async () => {
    const { ui, trace } = makeUi();
    startLayout(ui, { name: 'cose', animate: true, animationThreshold: 0, refresh: 1, numIter: 100000, randomize: false, fit: true });
    await tick(60);
    expect(ui.isLayoutRunning).toBe(true);
    startLayout(ui, preset(4, { animate: false }));
    expect(ui.settles).toEqual([2]);
    const at = trace.indexOf('settled');
    await tick(120);
    expect(trace.slice(at + 1).filter((e) => e === 'position' || e === 'viewport')).toEqual([]);
    expect(ui.settles).toEqual([2]);
  });

  it('a supersede with no next run (a rebuild that fits saved positions) releases the waiters, without a settle', async () => {
    const { ui, trace } = makeUi();
    startLayout(ui, preset(1, { animate: true, animationDuration: 300 }));
    const waiting = whenLayoutSettled(ui);
    supersedeLayout(ui);
    const info = await waiting;
    expect(info.superseded).toBe(true);
    expect(ui.isLayoutRunning).toBe(false);
    expect(ui.settles).toEqual([]);
    expect(layoutSettledCount(ui)).toBe(0);
    expect(trace).not.toContain('settled');
    expect(await whenLayoutSettled(ui)).toMatchObject({ superseded: false }); // none running: at once
  });

  it('a settle work that throws still clears the run and releases the waiters', async () => {
    const { ui } = makeUi();
    ui.onLayoutSettled = () => { throw new Error('boom'); };
    expect(() => startLayout(ui, preset(1, { animate: false }))).toThrow('boom');
    expect(ui.isLayoutRunning).toBe(false);
    expect(layoutSettledCount(ui)).toBe(1);
  });
});
