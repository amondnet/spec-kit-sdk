import type { ExecutionResult, OfficialConfig } from './types.js'
import { spawn } from 'node:child_process'

/**
 * Executes commands using the official GitHub spec-kit via uvx
 */
export class OfficialExecutor {
  private config: OfficialConfig

  constructor(config?: OfficialConfig) {
    this.config = config || {
      repository: 'git+https://github.com/github/spec-kit.git',
    }
  }

  /**
   * Execute a command using the official spec-kit
   * @param command The command to execute (e.g., 'init', 'apm')
   * @param args Command arguments
   * @returns Promise resolving to execution result
   */
  async execute(command: string, args: string[] = []): Promise<ExecutionResult> {
    const uvxArgs = [
      '--from',
      this.config.repository,
      'specify',
      command,
      ...args,
    ]

    return new Promise((resolve, reject) => {
      const child = spawn('uvx', uvxArgs, {
        stdio: 'inherit',
        shell: false,
      })

      child.on('close', (code) => {
        const exitCode = code || 0
        resolve({
          exitCode,
          success: exitCode === 0,
        })
      })

      child.on('error', (error) => {
        // Check if uvx is not installed
        if (error.message.includes('ENOENT')) {
          reject(new Error('uvx is not installed. Please install uv first: https://docs.astral.sh/uv/getting-started/installation/'))
        }
        else {
          reject(new Error(`Failed to execute official spec-kit: ${error.message}`))
        }
      })
    })
  }

  /**
   * Check if uvx is available on the system
   * @returns Promise resolving to boolean indicating availability
   */
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn('uvx', ['--version'], {
        stdio: 'ignore',
        shell: false,
      })

      child.on('close', (code) => {
        resolve(code === 0)
      })

      child.on('error', () => {
        resolve(false)
      })
    })
  }

  /**
   * Get the repository URL being used
   */
  getRepository(): string {
    return this.config.repository
  }

  /**
   * Update the repository configuration
   */
  updateRepository(repository: string): void {
    this.config.repository = repository
  }
}
