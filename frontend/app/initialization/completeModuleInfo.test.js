import { describe, it, expect } from 'vitest';
import { completeModuleInfo } from './completeModuleInfo.js';

describe('completeModuleInfo', () => {
  it('keeps a complete moduleInfo as is', () => {
    const raw = { title: 'Inventory', icon: '🎒', name: 'inventory', column: 1, category: 'UI Panel Modules' };
    expect(completeModuleInfo('inventoryPanel', raw)).toEqual(raw);
  });

  it('falls back to the componentType for a missing title (never to name)', () => {
    expect(completeModuleInfo('fooPanel', { name: 'foo', icon: 'F' }))
      .toEqual({ title: 'fooPanel', name: 'foo', icon: 'F' });
  });

  it('falls back to the componentType for a missing name', () => {
    expect(completeModuleInfo('fooPanel', { title: 'Foo', icon: 'F', column: 2 }))
      .toEqual({ title: 'Foo', name: 'fooPanel', icon: 'F', column: 2 });
  });

  it('turns an empty icon into undefined and completes an empty or absent info', () => {
    expect(completeModuleInfo('fooPanel', { title: 'Foo', name: 'foo', icon: '' }).icon).toBeUndefined();
    expect(completeModuleInfo('fooPanel', {})).toEqual({ title: 'fooPanel', name: 'fooPanel', icon: undefined });
    expect(completeModuleInfo('fooPanel')).toEqual({ title: 'fooPanel', name: 'fooPanel', icon: undefined });
  });
});
