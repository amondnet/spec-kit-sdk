import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { spawn } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'

const execFile = promisify(require('child_process').execFile)

// Path to the CLI script
const CLI_PATH = path.resolve(import.meta.dir, '../src/index.ts')

// Helper function to run the CLI with timeout
async function runCLI(args: string[] = [], timeout: number = 3000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn('bun', [CLI_PATH, ...args], {
      env: { ...process.env, FORCE_COLOR: '0' }, // Disable colors for testing
      timeout: timeout,
    })

    let stdout = ''
    let stderr = ''
    let resolved = false

    // Set a timeout to kill the process if it hangs
    const timer = setTimeout(() => {
      if (!resolved) {
        child.kill('SIGTERM')
        setTimeout(() => {
          if (!resolved) {
            child.kill('SIGKILL')
          }
        }, 100)
      }
    }, timeout)

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      resolved = true
      resolve({
        stdout,
        stderr,
        exitCode: code || 0,
      })
    })

    child.on('error', (error) => {
      clearTimeout(timer)
      resolved = true
      reject(error)
    })
  })
}

describe('CLI Banner Tests', () => {
  test('should display banner when no arguments provided', async () => {
    const result = await runCLI([])

    // Check for the actual banner characters (box drawing)
    expect(result.stdout).toContain('███████╗')
    expect(result.stdout).toContain('Spec-Driven Development Toolkit')
    expect(result.stdout).toContain('Run "specify --help" for usage information')
    expect(result.exitCode).toBe(0)
  })

  test('should display banner exactly once for --help', async () => {
    const result = await runCLI(['--help'])

    // The tagline appears in banner AND in the description, so we expect 2
    // What's important is the banner itself (box drawing) appears once
    const bannerBoxOccurrences = (result.stdout.match(/███████╗██████╗/g) || []).length
    expect(bannerBoxOccurrences).toBe(1)

    expect(result.stdout).toContain('Spec-Driven Development Toolkit')
    expect(result.stdout).toContain('Usage: specify')
    expect(result.exitCode).toBe(0)
  })

  test('should not display error message for --help', async () => {
    const result = await runCLI(['--help'])

    expect(result.stderr).toBe('')
    expect(result.stdout).not.toContain('Error:')
    expect(result.stdout).not.toContain('(outputHelp)')
    expect(result.exitCode).toBe(0)
  })
})

describe('CLI Help Command Tests', () => {
  test('should display main help with proper formatting', async () => {
    const result = await runCLI(['--help'])

    expect(result.stdout).toContain('Usage: specify [options] [command]')
    expect(result.stdout).toContain('Options:')
    expect(result.stdout).toContain('-V, --version')
    expect(result.stdout).toContain('-h, --help')
    expect(result.stdout).toContain('Commands:')
    expect(result.stdout).toContain('init')
    expect(result.stdout).toContain('check')
    expect(result.exitCode).toBe(0)
  })

  test('should display init command help', async () => {
    const result = await runCLI(['init', '--help'])

    expect(result.stdout).toContain('Usage: specify init [options] [project-name]')
    expect(result.stdout).toContain('Initialize a new Specify project')
    expect(result.stdout).toContain('--ai <assistant>')
    expect(result.stdout).toContain('--script <type>')
    expect(result.stdout).toContain('--here')
    expect(result.stdout).toContain('--no-git')
    expect(result.stdout).toContain('Examples:')
    expect(result.exitCode).toBe(0)
  })

  test('should display check command help', async () => {
    const result = await runCLI(['check', '--help'])

    expect(result.stdout).toContain('Usage: specify check')
    expect(result.stdout).toContain('Check that all required tools are installed')
    expect(result.exitCode).toBe(0)
  })

  test('should display version', async () => {
    const result = await runCLI(['--version'])

    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/)
    expect(result.exitCode).toBe(0)
  })
})

describe('CLI Error Handling Tests', () => {
  test('should handle unknown commands gracefully', async () => {
    const result = await runCLI(['unknown-command'])

    expect(result.stderr).toContain('Invalid command')
    expect(result.stderr).toContain('Run "specify --help"')
    expect(result.exitCode).toBe(1)
  })

  test('should handle invalid options', async () => {
    const result = await runCLI(['init', '--invalid-option'])

    expect(result.stderr).toContain('unknown option')
    expect(result.exitCode).toBe(1)
  })
})

describe('Init Command Tests', () => {
  test('should validate conflicting options --here and project-name', async () => {
    const result = await runCLI(['init', '--here', 'my-project'], 1000)

    expect(result.stderr).toContain('Cannot specify both project name and --here flag')
    expect(result.exitCode).toBe(1)
  })

  test.skip('should validate project name format', async () => {
    // TODO: Project name validation is not yet implemented in the CLI
    // This test is skipped until validation is added
    const result = await runCLI(['init', 'Invalid Project Name!'], 2000)

    // The error might be in stdout or stderr depending on how it's output
    const combinedOutput = result.stdout + result.stderr
    expect(combinedOutput).toContain('Project name can only contain')
    expect(result.exitCode).toBe(1)
  })

  test('should show help for init command', async () => {
    const result = await runCLI(['init', '--help'], 1000)

    expect(result.stdout).toContain('--ai <assistant>')
    expect(result.stdout).toContain('claude, gemini, copilot, or cursor')
    expect(result.exitCode).toBe(0)
  })
})

describe('Check Command Tests', () => {
  test('should display tool check results', async () => {
    const result = await runCLI(['check'], 2000)

    expect(result.stdout).toContain('Checking for installed tools')
    // Should check for common tools
    expect(result.stdout.toLowerCase()).toMatch(/git|bun|node/i)
    expect(result.exitCode).toBe(0)
  }, 3000)

  test('should show help for check command', async () => {
    const result = await runCLI(['check', '--help'], 1000)

    expect(result.stdout).toContain('Check that all required tools are installed')
    expect(result.exitCode).toBe(0)
  })
})

describe('Console Utilities Tests', () => {
  test('should properly center text without ANSI codes', async () => {
    // This test verifies that the strip-ansi integration works correctly
    const result = await runCLI([])

    // The banner should be centered properly
    const lines = result.stdout.split('\n')
    const bannerLines = lines.filter(line => line.includes('SPECIFY') || line.includes('███'))

    // Check that banner lines have leading spaces (indicating centering)
    bannerLines.forEach(line => {
      if (line.trim()) {
        expect(line).toMatch(/^\s+/)
      }
    })
  })
})

describe('Exit Code Tests', () => {
  test('should exit with 0 for help command', async () => {
    const result = await runCLI(['--help'], 1000)
    expect(result.exitCode).toBe(0)
  })

  test('should exit with 0 for version command', async () => {
    const result = await runCLI(['--version'], 1000)
    expect(result.exitCode).toBe(0)
  })

  test('should exit with 1 for unknown command', async () => {
    const result = await runCLI(['unknown-command'], 1000)
    expect(result.exitCode).toBe(1)
  })

  test.skip('should exit with 1 for invalid project name', async () => {
    // TODO: Project name validation is not yet implemented
    const result = await runCLI(['init', 'Invalid!Name'], 2000)
    expect(result.exitCode).toBe(1)
  })
})

describe('Banner Display State Tests', () => {
  test('should show banner once for --help', async () => {
    const result = await runCLI(['--help'], 1000)
    // Check that the actual banner box appears only once
    const bannerBoxCount = (result.stdout.match(/███████╗██████╗/g) || []).length
    expect(bannerBoxCount).toBe(1)
  })

  test('should show banner once for init --help', async () => {
    const result = await runCLI(['init', '--help'], 1000)
    const bannerBoxCount = (result.stdout.match(/███████╗██████╗/g) || []).length
    expect(bannerBoxCount).toBe(1)
  })

  test('should show banner once for check --help', async () => {
    const result = await runCLI(['check', '--help'], 1000)
    const bannerBoxCount = (result.stdout.match(/███████╗██████╗/g) || []).length
    expect(bannerBoxCount).toBe(1)
  })
})