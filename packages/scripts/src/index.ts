#!/usr/bin/env bun
/**
 * Spec-Kit Scripts TypeScript Library
 * Main entry point for the library
 */

import pc from 'picocolors';

// Export all utilities for library usage
export { git, files, paths, GitOperations, FileOperations, PathUtilities } from './utils/index.js';
export * from './contracts/spec-kit-library.js';
export * from './core/index.js';
export * from './commands/index.js';

// CLI entry point when run directly
if (import.meta.main) {
  console.log(pc.green('Spec-Kit Scripts Library v0.1.0'));
  console.log('Usage: spec-kit <command> [options]');
}

export default {
  name: '@spec-kit/scripts',
  version: '0.1.0'
};