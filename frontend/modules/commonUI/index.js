import commonUI, { debounce } from './commonUI.js';

// --- Module Info ---
export const moduleInfo = {
  name: 'CommonUI',
  description: 'Provides shared UI utility functions and components.',
};

// No registration, initialization, or post-initialization needed for this utility module.

// Re-export the utilities
export { commonUI, debounce };
export default commonUI;
