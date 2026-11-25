import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_URL, mysteryPageUrl } from './mysteryPage.js';

describe('mysteryPageUrl', () => {
  it('by default frames this app\'s own copy of the game', () => {
    expect(DEFAULT_PAGE_URL).toBe('./modules/mystery-clue-game/index.html');
    expect(mysteryPageUrl({ story: 'x', case: 'cases/x' })).toBe('./modules/mystery-clue-game/index.html?case=cases/x');
  });

  it('names the case by its story under cases/', () => {
    expect(mysteryPageUrl({ story: 'custom-house-fire' }))
      .toBe(`${DEFAULT_PAGE_URL}?case=cases/custom-house-fire`);
  });

  it('uses the block\'s own case directory when it names one', () => {
    expect(mysteryPageUrl({ story: 'garden-room', case: 'cases/miniatures/garden-room' }, 'http://localhost:8321/'))
      .toBe('http://localhost:8321/?case=cases/miniatures/garden-room');
  });

  it('adds to a query that is already there, and keeps a hash last', () => {
    expect(mysteryPageUrl({ story: 'a b' }, './page.html?x=1#top')).toBe('./page.html?x=1&case=cases/a%20b#top');
  });
});
