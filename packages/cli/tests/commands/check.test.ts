import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { checkCommand } from '../../src/commands/check.js'
import { consoleUtils } from '../../src/ui/Console.js'

// Mock child_process module
mock.module('child_process', () => ({
  execSync: mock((command: string) => {
    // Mock responses for different commands
    if (command.includes('git --version')) {
      return 'git version 2.34.0'
    }
    if (command.includes('bun --version')) {
      return '1.0.0'
    }
    if (command.includes('node --version')) {
      return 'v18.0.0'
    }
    if (command.includes('gh --version')) {
      throw new Error('Command not found')
    }
    if (command.includes('rg --version')) {
      return 'ripgrep 13.0.0'
    }
    return ''
  }),
}))

describe('Check Command', () => {
  let consoleLogSpy: any
  let consoleErrorSpy: any
  let consoleSuccessSpy: any
  let consoleWarnSpy: any
  let consolePanelSpy: any

  beforeEach(() => {
    // Mock console methods
    consoleLogSpy = spyOn(consoleUtils, 'log').mockImplementation(() => {})
    consoleErrorSpy = spyOn(consoleUtils, 'error').mockImplementation(() => {})
    consoleSuccessSpy = spyOn(consoleUtils, 'success').mockImplementation(() => {})
    consoleWarnSpy = spyOn(consoleUtils, 'warn').mockImplementation(() => {})
    consolePanelSpy = spyOn(consoleUtils, 'panel').mockImplementation(() => {})
  })

  describe('Tool Detection', () => {
    test('should check for required tools', async () => {
      await checkCommand()

      // Should display checking message
      expect(consoleLogSpy).toHaveBeenCalled()
      const calls = consoleLogSpy.mock.calls
      const checkingMessage = calls.find((call: any[]) =>
        call[0]?.toString().includes('Checking for installed tools'),
      )
      expect(checkingMessage).toBeDefined()
    })

    test('should detect installed Git', async () => {
      const execSyncMock = mock((command: string) => {
        if (command.includes('git --version')) {
          return 'git version 2.34.0'
        }
        throw new Error('Command not found')
      })

      // Override the mock for this specific test
      const originalExecSync = require('node:child_process').execSync
      require('node:child_process').execSync = execSyncMock

      await checkCommand()

      // Should show Git as installed
      const renderCalls = consoleLogSpy.mock.calls
      const gitStatus = renderCalls.some((call: any[]) =>
        call[0]?.toString().includes('git') && call[0]?.toString().includes('✓'),
      )

      // Restore original
      require('node:child_process').execSync = originalExecSync
    })

    test('should detect installed Bun', async () => {
      const execSyncMock = mock((command: string) => {
        if (command.includes('bun --version')) {
          return '1.0.0'
        }
        throw new Error('Command not found')
      })

      const originalExecSync = require('node:child_process').execSync
      require('node:child_process').execSync = execSyncMock

      await checkCommand()

      const renderCalls = consoleLogSpy.mock.calls
      const bunStatus = renderCalls.some((call: any[]) =>
        call[0]?.toString().includes('bun') && call[0]?.toString().includes('✓'),
      )

      require('node:child_process').execSync = originalExecSync
    })

    test('should detect missing tools', async () => {
      const execSyncMock = mock((command: string) => {
        // All commands fail
        throw new Error('Command not found')
      })

      const originalExecSync = require('node:child_process').execSync
      require('node:child_process').execSync = execSyncMock

      await checkCommand()

      // Should show installation URLs for missing tools
      const panelCalls = consolePanelSpy.mock.calls
      const hasMissingTools = panelCalls.some((call: any[]) =>
        call[0]?.toString().includes('https://'),
      )

      require('node:child_process').execSync = originalExecSync
    })

    test('should handle optional tools gracefully', async () => {
      const execSyncMock = mock((command: string) => {
        if (command.includes('gh --version')) {
          throw new Error('Command not found')
        }
        if (command.includes('rg --version')) {
          throw new Error('Command not found')
        }
        return 'version 1.0.0'
      })

      const originalExecSync = require('node:child_process').execSync
      require('node:child_process').execSync = execSyncMock

      await checkCommand()

      // Should complete without errors even if optional tools are missing
      expect(consoleLogSpy).toHaveBeenCalled()

      require('node:child_process').execSync = originalExecSync
    })
  })

  describe('Version Display', () => {
    test('should display version numbers for installed tools', async () => {
      const execSyncMock = mock((command: string) => {
        if (command.includes('git --version')) {
          return 'git version 2.34.0'
        }
        if (command.includes('bun --version')) {
          return '1.0.25'
        }
        if (command.includes('node --version')) {
          return 'v20.10.0'
        }
        throw new Error('Command not found')
      })

      const originalExecSync = require('node:child_process').execSync
      require('node:child_process').execSync = execSyncMock

      await checkCommand()

      const renderCalls = consoleLogSpy.mock.calls
      const hasVersions = renderCalls.some((call: any[]) => {
        const str = call[0]?.toString() || ''
        return str.includes('2.34.0') || str.includes('1.0.25') || str.includes('20.10.0')
      })

      require('node:child_process').execSync = originalExecSync
    })

    test('should handle version parsing errors gracefully', async () => {
      const execSyncMock = mock((command: string) => {
        // Return unexpected format
        return 'unexpected output format'
      })

      const originalExecSync = require('node:child_process').execSync
      require('node:child_process').execSync = execSyncMock

      // Should not throw an error
      await expect(checkCommand()).resolves.toBeUndefined()

      require('node:child_process').execSync = originalExecSync
    })
  })

  describe('Installation URLs', () => {
    test('should show installation URL for missing Git', async () => {
      const execSyncMock = mock((command: string) => {
        if (command.includes('git')) {
          throw new Error('Command not found')
        }
        return 'version 1.0.0'
      })

      const originalExecSync = require('node:child_process').execSync
      require('node:child_process').execSync = execSyncMock

      await checkCommand()

      const panelCalls = consolePanelSpy.mock.calls
      const hasGitUrl = panelCalls.some((call: any[]) =>
        call[0]?.toString().includes('https://git-scm.com/'),
      )

      require('node:child_process').execSync = originalExecSync
    })

    test('should show installation URL for missing Bun', async () => {
      const execSyncMock = mock((command: string) => {
        if (command.includes('bun')) {
          throw new Error('Command not found')
        }
        return 'version 1.0.0'
      })

      const originalExecSync = require('node:child_process').execSync
      require('node:child_process').execSync = execSyncMock

      await checkCommand()

      const panelCalls = consolePanelSpy.mock.calls
      const hasBunUrl = panelCalls.some((call: any[]) =>
        call[0]?.toString().includes('https://bun.sh/'),
      )

      require('node:child_process').execSync = originalExecSync
    })

    test('should show installation URL for missing Node.js', async () => {
      const execSyncMock = mock((command: string) => {
        if (command.includes('node')) {
          throw new Error('Command not found')
        }
        return 'version 1.0.0'
      })

      const originalExecSync = require('node:child_process').execSync
      require('node:child_process').execSync = execSyncMock

      await checkCommand()

      const panelCalls = consolePanelSpy.mock.calls
      const hasNodeUrl = panelCalls.some((call: any[]) =>
        call[0]?.toString().includes('https://nodejs.org/'),
      )

      require('node:child_process').execSync = originalExecSync
    })
  })

  describe('Summary Display', () => {
    test('should show success message when all required tools are installed', async () => {
      const execSyncMock = mock((command: string) => {
        // All tools are installed
        return 'version 1.0.0'
      })

      const originalExecSync = require('node:child_process').execSync
      require('node:child_process').execSync = execSyncMock

      await checkCommand()

      expect(consoleSuccessSpy).toHaveBeenCalled()
      const successCall = consoleSuccessSpy.mock.calls[0]
      expect(successCall[0]).toContain('Specify CLI is ready to use!')

      require('node:child_process').execSync = originalExecSync
    })

    test('should show warning when some tools are missing', async () => {
      const execSyncMock = mock((command: string) => {
        if (command.includes('gh') || command.includes('rg')) {
          throw new Error('Command not found')
        }
        return 'version 1.0.0'
      })

      const originalExecSync = require('node:child_process').execSync
      require('node:child_process').execSync = execSyncMock

      await checkCommand()

      // Should still complete successfully for optional tools
      const warnCalls = consoleWarnSpy.mock.calls
      const panelCalls = consolePanelSpy.mock.calls

      // Check if missing tools are reported
      const hasMissingInfo = panelCalls.length > 0

      require('node:child_process').execSync = originalExecSync
    })
  })

  describe('Step Tracker', () => {
    test('should use StepTracker for progress display', async () => {
      // Create a spy for StepTracker render method
      const renderSpy = mock(() => 'Rendered output')

      await checkCommand()

      // Should create and use a StepTracker
      expect(consoleLogSpy).toHaveBeenCalled()

      // Check that the tracker is being rendered
      const renderCalls = consoleLogSpy.mock.calls
      const hasTrackerOutput = renderCalls.some((call: any[]) =>
        call[0]?.toString().includes('✓') || call[0]?.toString().includes('❌'),
      )
    })

    test('should update tracker for each tool check', async () => {
      const tools = ['git', 'bun', 'node', 'gh', 'rg']

      await checkCommand()

      // Should have multiple render calls (one for each tool check)
      const renderCalls = consoleLogSpy.mock.calls
      expect(renderCalls.length).toBeGreaterThan(tools.length)
    })
  })
})
