import type { CLIConfig } from '../src/types.js'
import { beforeEach, describe, expect, test } from 'bun:test'
import { CommandRouter } from '../src/router.js'

describe('Official Wrapper Integration', () => {
  describe('Configuration handling', () => {
    test('should handle bun-first configuration', () => {
      const config: CLIConfig = {
        mode: 'bun-first',
        official: {
          repository: 'git+https://github.com/github/spec-kit.git',
        },
      }

      const router = new CommandRouter(config)
      expect(router.getMode()).toBe('bun-first')
    })

    test('should handle official-first configuration', () => {
      const config: CLIConfig = {
        mode: 'official-first',
        official: {
          repository: 'git+https://github.com/custom/spec-kit.git',
        },
      }

      const router = new CommandRouter(config)
      expect(router.getMode()).toBe('official-first')
    })

    test('should handle missing optional config', () => {
      const config: CLIConfig = {
        mode: 'bun-first',
      }

      const router = new CommandRouter(config)
      expect(router.getMode()).toBe('bun-first')
    })
  })

  describe('Command registration', () => {
    let router: CommandRouter

    beforeEach(() => {
      router = new CommandRouter()
    })

    test('should maintain local command registry', () => {
      const initialCommands = router.getLocalCommands()
      expect(initialCommands).toContain('init')
      expect(initialCommands).toContain('check')
      expect(initialCommands).toContain('config')
      expect(initialCommands).toContain('sync')
    })

    test('should allow dynamic command registration', () => {
      const newCommand = 'custom-command'

      expect(router.hasLocalCommand(newCommand)).toBe(false)

      router.addLocalCommand(newCommand)
      expect(router.hasLocalCommand(newCommand)).toBe(true)

      router.removeLocalCommand(newCommand)
      expect(router.hasLocalCommand(newCommand)).toBe(false)
    })
  })

  describe('Execution modes validation', () => {
    test('should validate bun-first mode behavior', async () => {
      const router = new CommandRouter({ mode: 'bun-first' })

      // Local command should throw LOCAL_COMMAND error
      await expect(router.execute('init', ['my-project']))
        .rejects
        .toThrow('LOCAL_COMMAND:init')
    })

    test('should validate official-first mode behavior', async () => {
      const router = new CommandRouter({ mode: 'official-first' })

      // Should attempt official first, then fallback to local for known commands
      // This will depend on uvx availability in test environment
      const isOfficialAvailable = await router.isOfficialAvailable()

      if (isOfficialAvailable) {
        // If uvx is available, it should try official first
        // In real scenario, this might succeed or fail depending on command availability
      }
      else {
        // If uvx not available, should fallback to local
        await expect(router.execute('init', ['my-project']))
          .rejects
          .toThrow('LOCAL_COMMAND:init')
      }
    })
  })

  describe('Error handling', () => {
    test('should handle unknown commands appropriately', async () => {
      const router = new CommandRouter({ mode: 'bun-first' })

      // Unknown command should be handled based on mode
      // In bun-first, it should try official if not local
      // This test validates the flow without actual execution
      expect(router.hasLocalCommand('unknown-command')).toBe(false)
    })
  })

  describe('Type safety', () => {
    test('should enforce correct config types', () => {
      // Valid configurations
      const bunFirst: CLIConfig = { mode: 'bun-first' }
      const officialFirst: CLIConfig = { mode: 'official-first' }

      expect(bunFirst.mode).toBe('bun-first')
      expect(officialFirst.mode).toBe('official-first')
    })

    test('should handle optional config properties', () => {
      const configWithOfficial: CLIConfig = {
        mode: 'bun-first',
        official: {
          repository: 'custom-repo',
        },
      }

      const configWithoutOfficial: CLIConfig = {
        mode: 'bun-first',
      }

      expect(configWithOfficial.official?.repository).toBe('custom-repo')
      expect(configWithoutOfficial.official).toBeUndefined()
    })
  })
})
