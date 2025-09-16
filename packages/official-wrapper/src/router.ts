import type { CLIConfig, ExecutionMode, ExecutionResult } from './types.js'
import { red, yellow } from 'picocolors'
import { OfficialExecutor } from './executor.js'

/**
 * Command router that handles execution delegation between Bun and official implementations
 */
export class CommandRouter {
  private config: CLIConfig
  private officialExecutor: OfficialExecutor
  private localCommands: Set<string>

  constructor(config?: CLIConfig) {
    this.config = config || {
      mode: 'bun-first',
      official: {
        repository: 'git+https://github.com/github/spec-kit.git',
      },
    }

    this.officialExecutor = new OfficialExecutor(this.config.official)

    // Define commands available in the local Bun implementation
    this.localCommands = new Set([
      'init',
      'check',
      'config',
      'sync',
    ])
  }

  /**
   * Execute a command using the configured execution mode
   * @param command The command to execute
   * @param args Command arguments
   * @returns Promise resolving to execution result
   */
  async execute(command: string, args: string[] = []): Promise<ExecutionResult> {
    const mode = this.config.mode || 'bun-first'

    if (mode === 'bun-first') {
      return this.executeBunFirst(command, args)
    }
    else {
      return this.executeOfficialFirst(command, args)
    }
  }

  /**
   * Execute with bun-first strategy: try Bun implementation first, fallback to official
   */
  private async executeBunFirst(command: string, args: string[]): Promise<ExecutionResult> {
    // Check if command exists in local implementation
    if (this.localCommands.has(command)) {
      // Local command exists, delegate to the calling CLI to handle it
      throw new Error(`LOCAL_COMMAND:${command}`)
    }

    // Command not available locally, try official implementation
    try {
      console.warn(yellow(`Command '${command}' not found locally, trying official spec-kit...`))
      return await this.officialExecutor.execute(command, args)
    }
    catch (error) {
      if (error instanceof Error && error.message.includes('uvx is not installed')) {
        console.error(red('Error: uvx is required for official spec-kit commands'))
        console.error(red('Install uv: https://docs.astral.sh/uv/getting-started/installation/'))
        return { exitCode: 1, success: false }
      }
      throw error
    }
  }

  /**
   * Execute with official-first strategy: try official implementation first, fallback to Bun
   */
  private async executeOfficialFirst(command: string, args: string[]): Promise<ExecutionResult> {
    // Check if uvx is available
    if (!(await this.officialExecutor.isAvailable())) {
      console.warn(yellow('uvx not available, trying local implementation...'))
      return this.fallbackToLocal(command, args)
    }

    // Try official implementation first
    try {
      return await this.officialExecutor.execute(command, args)
    }
    catch {
      console.warn(yellow(`Official spec-kit failed for '${command}', trying local implementation...`))
      return this.fallbackToLocal(command, args)
    }
  }

  /**
   * Fallback to local implementation
   */
  private fallbackToLocal(command: string, _args: string[]): ExecutionResult {
    if (this.localCommands.has(command)) {
      // Local command exists, delegate to the calling CLI to handle it
      throw new Error(`LOCAL_COMMAND:${command}`)
    }
    else {
      // Command not available in local implementation either
      console.error(red(`Command '${command}' not found in local or official implementations`))
      return { exitCode: 1, success: false }
    }
  }

  /**
   * Check if a command is available locally
   */
  hasLocalCommand(command: string): boolean {
    return this.localCommands.has(command)
  }

  /**
   * Get the current execution mode
   */
  getMode(): ExecutionMode {
    return this.config.mode || 'bun-first'
  }

  /**
   * Update the execution mode
   */
  setMode(mode: ExecutionMode): void {
    this.config.mode = mode
  }

  /**
   * Get the list of local commands
   */
  getLocalCommands(): string[] {
    return Array.from(this.localCommands)
  }

  /**
   * Add a command to the local commands registry
   */
  addLocalCommand(command: string): void {
    this.localCommands.add(command)
  }

  /**
   * Remove a command from the local commands registry
   */
  removeLocalCommand(command: string): void {
    this.localCommands.delete(command)
  }

  /**
   * Check if official executor is available
   */
  async isOfficialAvailable(): Promise<boolean> {
    return this.officialExecutor.isAvailable()
  }
}
