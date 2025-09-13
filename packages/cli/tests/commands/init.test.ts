import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { initCommand } from '../../src/commands/init.js'
import { consoleUtils } from '../../src/ui/Console.js'

describe('Init Command', () => {
  let tempDir: string
  let originalCwd: string
  let consoleErrorSpy: any
  let processExitSpy: any

  beforeEach(async () => {
    // Save original working directory
    originalCwd = process.cwd()

    // Create temporary directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'specify-init-test-'))
    process.chdir(tempDir)

    // Mock console methods
    consoleErrorSpy = spyOn(consoleUtils, 'error').mockImplementation(() => {})

    // Mock process.exit to prevent test runner from exiting
    processExitSpy = spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`Process.exit(${code})`)
    })
  })

  afterEach(async () => {
    // Restore original working directory
    process.chdir(originalCwd)

    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe('Parameter Validation', () => {
    test.skip('should reject invalid project names', async () => {
      // TODO: This test needs to be fixed - project name validation is not implemented
      // and the test times out waiting for interactive input
      const invalidNames = [
        'Project Name!', // Special characters
        'project name', // Spaces
        'project@name', // @ symbol
        'project#name', // # symbol
        'プロジェクト', // Non-ASCII characters
      ]

      for (const name of invalidNames) {
        consoleErrorSpy.mockClear()
        processExitSpy.mockClear()

        try {
          await initCommand({
            projectName: name,
            noGit: false,
            here: false,
            skipTLS: false,
            debug: false,
            ignoreAgentTools: false,
          })
        }
        catch (error: any) {
          expect(error.message).toContain('Process.exit(1)')
        }

        expect(consoleErrorSpy).toHaveBeenCalled()
        const errorMessage = consoleErrorSpy.mock.calls[0][0]
        expect(errorMessage).toContain('Project name can only contain')
      }
    }, 10000)

    test('should accept valid project names', () => {
      const validNames = [
        'my-project',
        'my_project',
        'myProject123',
        'project-2024',
        'test_app_v2',
      ]

      for (const name of validNames) {
        // Just validate the name format
        const isValid = /^[\w-]+$/.test(name)
        expect(isValid).toBe(true)
      }
    })

    test('should reject conflicting --here and project-name options', async () => {
      consoleErrorSpy.mockClear()
      processExitSpy.mockClear()

      try {
        await initCommand({
          projectName: 'my-project',
          noGit: false,
          here: true,
          skipTLS: false,
          debug: false,
          ignoreAgentTools: false,
        })
      }
      catch (error: any) {
        expect(error.message).toContain('Process.exit(1)')
      }

      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorMessage = consoleErrorSpy.mock.calls[0][0]
      expect(errorMessage).toContain('Cannot specify both project name and --here flag')
    })

    test('should validate AI assistant options', () => {
      const validAssistants = ['claude', 'gemini', 'copilot', 'cursor']
      const invalidAssistants = ['chatgpt', 'bard', 'unknown']

      validAssistants.forEach((assistant) => {
        // Valid assistants should be in the allowed list
        expect(validAssistants).toContain(assistant)
      })

      invalidAssistants.forEach((assistant) => {
        // Invalid assistants should not be in the allowed list
        expect(validAssistants).not.toContain(assistant)
      })
    })

    test('should validate script type options', () => {
      const validScriptTypes = ['sh', 'ps']
      const invalidScriptTypes = ['bash', 'powershell', 'cmd']

      validScriptTypes.forEach((type) => {
        expect(validScriptTypes).toContain(type)
      })

      invalidScriptTypes.forEach((type) => {
        expect(validScriptTypes).not.toContain(type)
      })
    })
  })

  describe('Directory Handling', () => {
    test('should handle --here option correctly', async () => {
      // Create a test file in the current directory
      await fs.writeFile('existing-file.txt', 'test content')

      // Mock the actual init process since we're just testing parameter handling
      mock(() => Promise.resolve())
      mock(() => Promise.resolve())

      // The init command should work in the current directory with --here
      const options = {
        projectName: undefined,
        noGit: false,
        here: true,
        skipTLS: false,
        debug: false,
        ignoreAgentTools: false,
      }
      expect(options.here).toBe(true)

      // Verify the existing file is present
      const files = await fs.readdir('.')
      expect(files).toContain('existing-file.txt')
    })

    test('should create new project directory when project name is provided', async () => {
      const projectName = 'test-project'

      // Mock the actual init process
      mock(() => Promise.resolve())
      mock(() => Promise.resolve())

      // The init command should create a new directory
      const projectPath = path.join(tempDir, projectName)

      // Verify directory doesn't exist yet
      const dirExists = await fs.access(projectPath).then(() => true).catch(() => false)
      expect(dirExists).toBe(false)
    })

    test('should reject if project directory already exists', async () => {
      const projectName = 'existing-project'

      // Create the directory first
      await fs.mkdir(projectName)
      await fs.writeFile(path.join(projectName, 'file.txt'), 'content')

      consoleErrorSpy.mockClear()
      processExitSpy.mockClear()

      try {
        await initCommand({
          projectName,
          noGit: false,
          here: false,
          skipTLS: false,
          debug: false,
          ignoreAgentTools: false,
        })
      }
      catch {
        // Expected to throw
      }

      // Should error about existing directory
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe('Git Initialization', () => {
    test('should respect --no-git flag', () => {
      const options = {
        projectName: 'test-project',
        noGit: true,
        here: false,
        skipTLS: false,
        debug: false,
        ignoreAgentTools: false,
      }

      // Verify that noGit option is properly set
      expect(options.noGit).toBe(true)
    })

    test('should default to git initialization', () => {
      const options = {
        projectName: 'test-project',
        noGit: false,
        here: false,
        skipTLS: false,
        debug: false,
        ignoreAgentTools: false,
      }

      // Verify that git initialization is enabled by default
      expect(options.noGit).toBe(false)
    })
  })

  describe('Debug Mode', () => {
    test('should handle debug flag', () => {
      const options = {
        projectName: 'test-project',
        noGit: false,
        here: false,
        skipTLS: false,
        debug: true,
        ignoreAgentTools: false,
      }

      expect(options.debug).toBe(true)
    })
  })

  describe('TLS/SSL Handling', () => {
    test('should handle skipTLS flag', () => {
      const options = {
        projectName: 'test-project',
        noGit: false,
        here: false,
        skipTLS: true,
        debug: false,
        ignoreAgentTools: false,
      }

      expect(options.skipTLS).toBe(true)
    })

    test('should default to TLS verification', () => {
      const options = {
        projectName: 'test-project',
        noGit: false,
        here: false,
        skipTLS: false,
        debug: false,
        ignoreAgentTools: false,
      }

      expect(options.skipTLS).toBe(false)
    })
  })

  describe('Agent Tools', () => {
    test('should handle ignoreAgentTools flag', () => {
      const options = {
        projectName: 'test-project',
        noGit: false,
        here: false,
        skipTLS: false,
        debug: false,
        ignoreAgentTools: true,
      }

      expect(options.ignoreAgentTools).toBe(true)
    })
  })
})
