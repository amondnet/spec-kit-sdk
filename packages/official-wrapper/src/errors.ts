/**
 * Custom error classes for better error handling
 */

export class UvxNotInstalledError extends Error {
  public readonly code = 'UVX_NOT_INSTALLED'

  constructor(message = 'uvx is not installed. Please install uv first: https://docs.astral.sh/uv/getting-started/installation/') {
    super(message)
    this.name = 'UvxNotInstalledError'
  }
}

export class CommandExecutionError extends Error {
  public readonly code = 'COMMAND_EXECUTION_ERROR'

  constructor(message: string, public readonly command?: string) {
    super(message)
    this.name = 'CommandExecutionError'
  }
}

export class LocalCommandError extends Error {
  public readonly code = 'LOCAL_COMMAND'

  constructor(public readonly command: string) {
    super(`LOCAL_COMMAND:${command}`)
    this.name = 'LocalCommandError'
  }
}
