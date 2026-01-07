/**
 * CodeMirror 6 Editor Module
 *
 * Provides a CodeMirror 6 based editor panel with JSON support,
 * syntax highlighting, and folding capabilities.
 */

import CodeMirror6UI from './codeMirror6UI.js';

// Helper function for logging with fallback
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('editorCodeMirror6Module', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[editorCodeMirror6Module] ${message}`, ...data);
  }
}

// --- Module Info ---
export const moduleInfo = {
  name: 'editorCodeMirror6',
  title: 'Editor (CodeMirror 6)',
  componentType: 'editorCodeMirror6Panel',
  icon: '📝',
  column: 2, // Middle column
  description: 'CodeMirror 6 based editor with JSON support and folding.',
};

/**
 * Registration function for the CodeMirror 6 Editor module.
 * Registers the editor panel component.
 */
export function register(registrationApi) {
  log('info', '[CodeMirror 6 Editor Module] Registering...');
  registrationApi.registerPanelComponent('editorCodeMirror6Panel', CodeMirror6UI);

  registrationApi.registerEventBusPublisher('files:jsonLoaded');

  log('info', '[CodeMirror 6 Editor Module] Registered successfully');
}
