/**
 * @spec-kit/official-wrapper - Official GitHub Spec-Kit wrapper and command router
 *
 * This package provides a wrapper for the official GitHub spec-kit implementation
 * and a command router that can delegate execution between local Bun implementation
 * and official implementation based on configuration.
 */

// Core exports
export { OfficialExecutor } from './executor.js'
export { CommandRouter } from './router.js'

// Type exports
export type {
  CLIConfig,
  CommandDefinition,
  CommandRegistry,
  ExecutionMode,
  ExecutionResult,
  OfficialConfig,
} from './types.js'
