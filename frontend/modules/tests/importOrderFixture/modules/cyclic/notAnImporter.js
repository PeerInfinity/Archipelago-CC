// Names './index.js' only in a comment and a string — NOT an importer:
// import { moduleInfo } from './index.js';
export const text = "import { moduleInfo } from './index.js'";
// A dynamic import is not a static cycle edge either.
export const lazy = () => import('./index.js');
