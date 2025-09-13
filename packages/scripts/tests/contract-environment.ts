/**
 * Isolated Contract Test Environment
 * Provides completely isolated temp directories for each contract test
 * Similar to compatibility test environment but optimized for contract testing
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { $ } from 'bun'
import { git } from '../src/utils/git.js'

export class IsolatedContractEnvironment {
  private tempDir: string = ''
  private originalCwd: string

  constructor() {
    this.originalCwd = process.cwd()
  }

  /**
   * Create a complete isolated Git repository for contract testing
   */
  async createIsolatedRepo(): Promise<string> {
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contract-test-'))

    // Initialize Git repository
    await $`git init`.cwd(this.tempDir)
    await $`git config user.name "Contract Test"`.cwd(this.tempDir)
    await $`git config user.email "contract@test.com"`.cwd(this.tempDir)

    // Create spec-kit directory structure
    await fs.mkdir(path.join(this.tempDir, '.specify', 'templates'), { recursive: true })
    await fs.mkdir(path.join(this.tempDir, '.specify', 'scripts', 'bash'), { recursive: true })
    await fs.mkdir(path.join(this.tempDir, 'specs'), { recursive: true })

    // Create essential template files
    const specTemplate = `# Feature [FEATURE NUMBER]: [FEATURE NAME]

## Description

[FEATURE NAME]

## Requirements

- [ ] To be defined

## Implementation Notes

- [ ] Review requirements
- [ ] Create implementation plan
- [ ] Write tests`

    await fs.writeFile(
      path.join(this.tempDir, '.specify', 'templates', 'spec-template.md'),
      specTemplate,
    )

    // Create initial commit to establish main branch
    await fs.writeFile(path.join(this.tempDir, 'README.md'), '# Test Repository\n\nContract testing environment.')
    await $`git add .`.cwd(this.tempDir)
    await $`git commit -m "Initial commit"`.cwd(this.tempDir)

    return this.tempDir
  }

  /**
   * Switch to the test directory and reset git singleton
   */
  changeToTestDir(): void {
    if (this.tempDir) {
      process.chdir(this.tempDir)
      // Critical: Reset git singleton to use the test directory
      git.setWorkingDirectory(this.tempDir)
    }
  }

  /**
   * Create a feature branch for testing
   */
  async createFeatureBranch(branchName: string): Promise<void> {
    if (!this.tempDir) {
      throw new Error('Test repository not initialized')
    }

    await $`git checkout -b ${branchName}`.cwd(this.tempDir)
  }

  /**
   * Switch back to main branch
   */
  async switchToMain(): Promise<void> {
    if (!this.tempDir) {
      throw new Error('Test repository not initialized')
    }

    await $`git checkout main`.cwd(this.tempDir)
  }

  /**
   * Create a file in the test directory
   */
  async createFile(filename: string, content: string): Promise<void> {
    if (!this.tempDir) {
      throw new Error('Test repository not initialized')
    }

    const filePath = path.join(this.tempDir, filename)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, content)
  }

  /**
   * Get absolute path for a file in the test directory
   */
  getPath(filename: string): string {
    if (!this.tempDir) {
      throw new Error('Test repository not initialized')
    }
    return path.join(this.tempDir, filename)
  }

  /**
   * Check if a file exists in the test directory
   */
  async fileExists(filename: string): Promise<boolean> {
    if (!this.tempDir) {
      return false
    }

    try {
      await fs.access(this.getPath(filename))
      return true
    }
    catch {
      return false
    }
  }

  /**
   * Get current Git branch
   */
  async getCurrentBranch(): Promise<string> {
    if (!this.tempDir) {
      throw new Error('Test repository not initialized')
    }

    const result = await $`git rev-parse --abbrev-ref HEAD`.cwd(this.tempDir)
    return result.stdout.toString().trim()
  }

  /**
   * Get the temporary directory path
   */
  getTempDir(): string {
    return this.tempDir
  }

  /**
   * Clean up the test environment
   */
  async cleanup(): Promise<void> {
    // Restore original working directory
    process.chdir(this.originalCwd)
    // Critical: Restore git singleton to original directory
    git.setWorkingDirectory(this.originalCwd)

    // Clean up temporary directory
    if (this.tempDir) {
      try {
        await fs.rm(this.tempDir, { recursive: true, force: true })
      }
      catch (error) {
        console.warn(`Failed to cleanup contract test dir ${this.tempDir}:`, error)
      }
    }

    this.tempDir = ''
  }
}

/**
 * Utility function to validate contract test results
 */
export function validateContractResult(result: any, expectedFields: string[]): string[] {
  const errors: string[] = []

  if (!result || typeof result !== 'object') {
    errors.push('Result must be an object')
    return errors
  }

  for (const field of expectedFields) {
    if (!(field in result)) {
      errors.push(`Missing required field: ${field}`)
    }
  }

  return errors
}

/**
 * Common contract test patterns
 */
export const CONTRACT_PATTERNS = {
  BRANCH_NAME: /^\d{3}-[\w-]+$/,
  FEATURE_NUM: /^\d{3}$/,
  SPEC_FILE: /\/specs\/\d{3}-[\w-]+\/spec\.md$/,
  PLAN_FILE: /\/specs\/\d{3}-[\w-]+\/plan\.md$/,
} as const
