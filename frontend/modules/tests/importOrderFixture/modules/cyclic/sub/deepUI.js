// A subdirectory importer of the module's own index.js (`../index.js`). A
// cycle, but not a live one: the index reads nothing from this file.
import { moduleInfo } from '../index.js';

export const deepName = () => moduleInfo.name;
