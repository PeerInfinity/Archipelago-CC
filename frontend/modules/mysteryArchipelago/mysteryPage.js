// Where the mystery clue game's page is, for the loaded world. Pure: no DOM, no settings.

/** The setting that holds the page's address (`moduleSettings.mysteryArchipelago.pageUrl`). */
export const PAGE_URL_SETTING = 'moduleSettings.mysteryArchipelago.pageUrl';

/** Where the game's repository sits in this one: a git submodule, relative to the repository root. */
export const GAME_SUBMODULE_PATH = 'frontend/modules/mystery-clue-game';

/**
 * The game's page in this app's own copy of the game (the submodule above), relative to the app.
 * It is the setting's schema default; nothing else names the address. The copy is pinned to the
 * commit the committed mystery world was generated from (mysteryPin.test.js), so the page and
 * the world are one version of the case.
 */
export const DEFAULT_PAGE_URL = './modules/mystery-clue-game/index.html';

/**
 * The page's URL for a world's mystery block: the page address with `case=<the case's directory>`.
 * The directory is the block's own `case` when it names one, else `cases/<story>`. The panel that
 * frames the URL adds the adapter's own parameters (`iframeId`, `hostOrigin`).
 * @param {{story: string, case?: string}} block - `slot_data.mystery`
 * @param {string} [pageUrl] - the page's address, absolute or relative to the app
 */
export function mysteryPageUrl(block, pageUrl = DEFAULT_PAGE_URL) {
  const caseDir = typeof block.case === 'string' && block.case ? block.case : `cases/${block.story}`;
  const [beforeHash, hash = ''] = String(pageUrl).split('#');
  const joiner = beforeHash.includes('?') ? '&' : '?';
  // The path is written as the page reads it (slashes kept), each segment encoded.
  const encoded = caseDir.split('/').map(encodeURIComponent).join('/');
  return `${beforeHash}${joiner}case=${encoded}${hash ? `#${hash}` : ''}`;
}
