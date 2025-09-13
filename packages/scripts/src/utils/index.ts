/**
 * Utility Functions Export
 *
 * Re-exports all utility classes and functions for convenient importing
 * throughout the spec-kit library.
 */

// Export all utility types from contracts
export type {
  FileOperations as FileOperationsInterface,
  GitOperationsInterface,
  PathUtilities as PathUtilitiesInterface,
} from '../contracts/spec-kit-library.js'
export { FileOperations, files } from './file.js'
export { git, GitOperations } from './git.js'

export { paths, PathUtilities } from './path.js'
