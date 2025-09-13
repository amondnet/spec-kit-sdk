/**
 * Git Operations Utilities
 *
 * Provides git-related functionality for the spec-kit library including
 * repository operations, branch management, and feature branch validation.
 * Uses Bun's $ command instead of simple-git to avoid segmentation faults.
 */

import path from 'node:path'
import process from 'node:process'
import { $ } from 'bun'
import { FEATURE_BRANCH_PATTERN, FeatureBranchError, GitRepositoryError } from '../contracts/spec-kit-library.js'

export class GitOperations {
  private workingDir: string

  constructor(workingDir?: string) {
    this.workingDir = workingDir || process.cwd()
  }

  /**
   * Get absolute path to repository root
   * @returns Promise resolving to absolute path of git repository root
   * @throws GitRepositoryError if not in a git repository
   */
  async getRepoRoot(): Promise<string> {
    try {
      const result = await $`git rev-parse --show-toplevel`.cwd(this.workingDir).nothrow()

      if (result.exitCode !== 0) {
        throw new GitRepositoryError('Not in a git repository')
      }

      const rootPath = result.stdout.toString().trim()
      return path.resolve(rootPath)
    }
    catch (error) {
      throw new GitRepositoryError(
        `Not in a git repository: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Get current branch name
   * @returns Promise resolving to current branch name
   * @throws GitRepositoryError if unable to determine current branch
   */
  async getCurrentBranch(): Promise<string> {
    try {
      const result = await $`git rev-parse --abbrev-ref HEAD`.cwd(this.workingDir).nothrow()

      if (result.exitCode !== 0) {
        throw new GitRepositoryError('Unable to get current branch')
      }

      return result.stdout.toString().trim()
    }
    catch (error) {
      throw new GitRepositoryError(
        `Unable to get current branch: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Check if current branch follows feature branch pattern (###-name)
   * @param branch Branch name to check
   * @returns true if branch follows feature pattern, false otherwise
   */
  checkFeatureBranch(branch: string): boolean {
    return FEATURE_BRANCH_PATTERN.test(branch)
  }

  /**
   * Create and checkout new feature branch
   * @param branchName Name of the new branch to create
   * @throws GitRepositoryError if unable to create or checkout branch
   */
  async createFeatureBranch(branchName: string): Promise<void> {
    try {
      // Validate branch name follows feature pattern
      if (!this.checkFeatureBranch(branchName)) {
        throw new FeatureBranchError(
          `Branch name "${branchName}" does not follow feature pattern (###-name)`,
        )
      }

      // Check if branch already exists
      const branches = await this.getLocalBranches()
      if (branches.includes(branchName)) {
        throw new FeatureBranchError(`Branch "${branchName}" already exists`)
      }

      // Create and checkout new branch
      const result = await $`git checkout -b ${branchName}`.cwd(this.workingDir).nothrow()

      if (result.exitCode !== 0) {
        throw new GitRepositoryError(`Failed to create branch: ${result.stderr.toString()}`)
      }
    }
    catch (error) {
      if (error instanceof FeatureBranchError) {
        throw error
      }
      throw new GitRepositoryError(
        `Unable to create branch "${branchName}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Check if working directory is clean (no uncommitted changes)
   * @returns Promise resolving to true if working directory is clean
   */
  async isWorkingDirectoryClean(): Promise<boolean> {
    try {
      const result = await $`git status --porcelain`.cwd(this.workingDir).nothrow()

      if (result.exitCode !== 0) {
        throw new GitRepositoryError('Unable to check git status')
      }

      return result.stdout.toString().trim().length === 0
    }
    catch (error) {
      throw new GitRepositoryError(
        `Unable to check git status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Get list of all local branches
   * @returns Promise resolving to array of branch names
   */
  async getLocalBranches(): Promise<string[]> {
    try {
      const result = await $`git branch --format="%(refname:short)"`.cwd(this.workingDir).nothrow()

      if (result.exitCode !== 0) {
        throw new GitRepositoryError('Unable to get branches')
      }

      const output = result.stdout.toString().trim()
      if (!output) {
        return []
      }

      return output.split('\n').map(branch => branch.trim()).filter(branch => branch.length > 0)
    }
    catch (error) {
      throw new GitRepositoryError(
        `Unable to get branches: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Check if we're currently in a git repository
   * @returns Promise resolving to true if in a git repository
   */
  async isGitRepository(): Promise<boolean> {
    try {
      const result = await $`git rev-parse --git-dir`.cwd(this.workingDir).nothrow()
      return result.exitCode === 0
    }
    catch {
      return false
    }
  }

  /**
   * Get the current working directory for git operations
   * @returns Current working directory path
   */
  getWorkingDirectory(): string {
    return this.workingDir
  }

  /**
   * Set a new working directory for git operations
   * @param workingDir New working directory path
   */
  setWorkingDirectory(workingDir: string): void {
    this.workingDir = workingDir
  }
}

// Export singleton instance for convenience
export const git = new GitOperations()