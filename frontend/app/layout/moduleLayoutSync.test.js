import { describe, it, expect } from 'vitest';
import { openComponentTypes, reconcileModuleStates } from './moduleLayoutSync.js';

const TYPES = {
  inventory: 'inventoryPanel',
  events: 'eventsPanel',
  json: 'jsonPanel',
  regions: 'regionsPanel',
  iframePanel: 'iframePanel',
  stateManager: null, // no UI
};
const typeOf = (id) => TYPES[id];

describe('reconcileModuleStates', () => {
  it('leaves an enabled module with a tab alone', () => {
    expect(reconcileModuleStates({ inventory: true }, typeOf, ['inventoryPanel'], ['inventoryPanel']))
      .toEqual({ toDisable: [], toEnable: [] });
  });

  it('disables an enabled module whose tab the swap removed', () => {
    expect(reconcileModuleStates({ events: true }, typeOf, ['inventoryPanel'], ['inventoryPanel', 'eventsPanel']))
      .toEqual({ toDisable: ['events'], toEnable: [] });
  });

  it('leaves an enabled module that had no tab before the swap either (a boot state)', () => {
    expect(reconcileModuleStates({ events: true }, typeOf, ['inventoryPanel'], ['inventoryPanel']))
      .toEqual({ toDisable: [], toEnable: [] });
  });

  it('disables nothing without the previous tab types', () => {
    expect(reconcileModuleStates({ events: true }, typeOf, [])).toEqual({ toDisable: [], toEnable: [] });
  });

  it('enables a disabled module the new layout built a tab for', () => {
    expect(reconcileModuleStates({ json: false }, typeOf, ['jsonPanel'], ['jsonPanel']))
      .toEqual({ toDisable: [], toEnable: ['json'] });
    expect(reconcileModuleStates({ json: false }, typeOf, ['jsonPanel']))
      .toEqual({ toDisable: [], toEnable: ['json'] });
  });

  it('leaves a disabled module without a tab alone', () => {
    expect(reconcileModuleStates({ regions: false }, typeOf, ['jsonPanel'], ['regionsPanel']))
      .toEqual({ toDisable: [], toEnable: [] });
  });

  it('never touches a module with no componentType', () => {
    expect(reconcileModuleStates({ stateManager: true, unknown: false }, typeOf, [], ['x']))
      .toEqual({ toDisable: [], toEnable: [] });
  });

  it('counts a multi-instance module with two tabs as having a tab', () => {
    const tabs = ['iframePanel', 'iframePanel'];
    expect(reconcileModuleStates({ iframePanel: true }, typeOf, tabs, tabs)).toEqual({ toDisable: [], toEnable: [] });
    expect(reconcileModuleStates({ iframePanel: false }, typeOf, tabs, tabs)).toEqual({ toDisable: [], toEnable: ['iframePanel'] });
  });

  it('reports every module in one pass', () => {
    const r = reconcileModuleStates(
      { inventory: false, events: true, json: true, regions: false },
      typeOf,
      ['inventoryPanel', 'jsonPanel'],
      ['eventsPanel', 'jsonPanel'],
    );
    expect(r).toEqual({ toDisable: ['events'], toEnable: ['inventory'] });
  });
});

describe('openComponentTypes', () => {
  it('lists every component item, once per tab, and skips containers', () => {
    const gl = {
      getAllContentItems: () => [
        { isComponent: false, type: 'stack' },
        { isComponent: true, componentType: 'iframePanel' },
        { isComponent: true, componentType: 'iframePanel' },
        { isComponent: true, componentType: 'jsonPanel' },
      ],
    };
    expect(openComponentTypes(gl)).toEqual(['iframePanel', 'iframePanel', 'jsonPanel']);
  });

  it('is empty without a layout', () => {
    expect(openComponentTypes(null)).toEqual([]);
  });
});
