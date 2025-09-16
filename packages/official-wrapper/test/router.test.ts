import type { OfficialConfig } from '../src/types.js'
import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { LocalCommandError, UvxNotInstalledError } from '../src/errors.js'
import { CommandRouter } from '../src/router.js'

// Mock implementation of OfficialExecutor for testing
class MockOfficialExecutor {
  public executeMock = mock()
  public isAvailableMock = mock()
  public getRepositoryMock = mock()
  public updateRepositoryMock = mock()

  constructor(public config?: OfficialConfig) {
    this.getRepositoryMock.mockReturnValue(config?.repository || 'git+https://github.com/github/spec-kit.git')
    this.isAvailableMock.mockResolvedValue(true)
    this.executeMock.mockResolvedValue({ exitCode: 0, success: true })
  }

  async execute(command: string, args: string[]) {
    return this.executeMock(command, args)
  }

  async isAvailable() {
    return this.isAvailableMock()
  }

  getRepository() {
    return this.getRepositoryMock()
  }

  updateRepository(repository: string) {
    this.updateRepositoryMock(repository)
  }

  reset() {
    this.executeMock.mockClear()
    this.isAvailableMock.mockClear()
    this.getRepositoryMock.mockClear()
    this.updateRepositoryMock.mockClear()
  }
}

describe('CommandRouter', () => {
  let router: CommandRouter
  let mockExecutor: MockOfficialExecutor

  beforeEach(() => {
    mockExecutor = new MockOfficialExecutor()

    // Create router and inject mock executor via constructor
    router = new CommandRouter(undefined, mockExecutor as any)
  })

  describe('constructor', () => {
    test('should use default config when none provided', () => {
      const defaultRouter = new CommandRouter()
      expect(defaultRouter.getMode()).toBe('bun-first')
    })

    test('should use provided config', () => {
      const customRouter = new CommandRouter({
        mode: 'official-first',
        official: {
          repository: 'git+https://github.com/custom/spec-kit.git',
        },
      })
      expect(customRouter.getMode()).toBe('official-first')
    })
  })

  describe('hasLocalCommand', () => {
    test('should return true for local commands', () => {
      expect(router.hasLocalCommand('init')).toBe(true)
      expect(router.hasLocalCommand('check')).toBe(true)
      expect(router.hasLocalCommand('config')).toBe(true)
      expect(router.hasLocalCommand('sync')).toBe(true)
    })

    test('should return false for non-local commands', () => {
      expect(router.hasLocalCommand('apm')).toBe(false)
      expect(router.hasLocalCommand('unknown')).toBe(false)
    })
  })

  describe('execute - bun-first mode', () => {
    beforeEach(() => {
      router.setMode('bun-first')
    })

    test('should throw LocalCommandError for local commands', async () => {
      await expect(router.execute('init', ['my-project'])).rejects.toThrow(LocalCommandError)
    })

    test('should execute non-local commands with official executor', async () => {
      mockExecutor.executeMock.mockResolvedValue({ exitCode: 0, success: true })

      const result = await router.execute('apm', ['init'])

      expect(mockExecutor.executeMock).toHaveBeenCalledWith('apm', ['init'])
      expect(result).toEqual({ exitCode: 0, success: true })
    })

    test('should handle uvx not installed error gracefully', async () => {
      mockExecutor.executeMock.mockRejectedValue(new UvxNotInstalledError())

      const result = await router.execute('apm', ['init'])

      expect(result).toEqual({ exitCode: 1, success: false })
    })

    test('should re-throw other errors', async () => {
      mockExecutor.executeMock.mockRejectedValue(new Error('Some other error'))

      await expect(router.execute('apm', ['init'])).rejects.toThrow('Some other error')
    })
  })

  describe('execute - official-first mode', () => {
    beforeEach(() => {
      router.setMode('official-first')
    })

    test('should try official executor first when uvx is available', async () => {
      mockExecutor.isAvailableMock.mockResolvedValue(true)
      mockExecutor.executeMock.mockResolvedValue({ exitCode: 0, success: true })

      const result = await router.execute('init', ['my-project'])

      expect(mockExecutor.executeMock).toHaveBeenCalledWith('init', ['my-project'])
      expect(result).toEqual({ exitCode: 0, success: true })
    })

    test('should fallback to local when uvx not available', async () => {
      mockExecutor.isAvailableMock.mockResolvedValue(false)

      await expect(router.execute('init', ['my-project'])).rejects.toThrow(LocalCommandError)
    })

    test('should fallback to local when official execution fails', async () => {
      mockExecutor.isAvailableMock.mockResolvedValue(true)
      mockExecutor.executeMock.mockRejectedValue(new Error('Official execution failed'))

      await expect(router.execute('init', ['my-project'])).rejects.toThrow(LocalCommandError)
    })

    test('should return error for unknown commands', async () => {
      mockExecutor.isAvailableMock.mockResolvedValue(false)

      const result = await router.execute('unknown', [])

      expect(result).toEqual({ exitCode: 1, success: false })
    })
  })

  describe('command management', () => {
    test('should get local commands list', () => {
      const commands = router.getLocalCommands()
      expect(commands).toEqual(['init', 'check', 'config', 'sync'])
    })

    test('should add local command', () => {
      router.addLocalCommand('test')
      expect(router.hasLocalCommand('test')).toBe(true)
    })

    test('should remove local command', () => {
      router.removeLocalCommand('init')
      expect(router.hasLocalCommand('init')).toBe(false)
    })
  })

  describe('mode management', () => {
    test('should get current mode', () => {
      expect(router.getMode()).toBe('bun-first')
    })

    test('should set mode', () => {
      router.setMode('official-first')
      expect(router.getMode()).toBe('official-first')
    })
  })

  describe('isOfficialAvailable', () => {
    test('should delegate to executor isAvailable method', async () => {
      mockExecutor.isAvailableMock.mockResolvedValue(true)

      const result = await router.isOfficialAvailable()

      expect(mockExecutor.isAvailableMock).toHaveBeenCalled()
      expect(result).toBe(true)
    })
  })
})
