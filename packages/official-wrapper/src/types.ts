/**
 * Types for the official spec-kit wrapper
 */

export interface ExecutionResult {
  exitCode: number
  success: boolean
}

export interface OfficialConfig {
  repository: string
}

export interface CLIConfig {
  mode: 'official-first' | 'bun-first'
  official?: OfficialConfig
}

export type ExecutionMode = 'official-first' | 'bun-first'

export interface CommandDefinition {
  name: string
  description?: string
  available: boolean
}

export interface CommandRegistry {
  local: CommandDefinition[]
  official: CommandDefinition[]
}
