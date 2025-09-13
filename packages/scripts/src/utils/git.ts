/**
 * Git Operations Utilities
 *
 * Provides git-related functionality for the spec-kit library including
 * repository operations, branch management, and feature branch validation.
 */

import { simpleGit } from 'simple-git';
import type { SimpleGit } from 'simple-git';
import { GitRepositoryError, FeatureBranchError, FEATURE_BRANCH_PATTERN } from '../contracts/spec-kit-library.js';
import path from 'path';

export class GitOperations {
  private git: SimpleGit;

  constructor(workingDir?: string) {
    this.git = simpleGit(workingDir || process.cwd());
  }

  /**
   * Get absolute path to repository root
   * @returns Promise resolving to absolute path of git repository root
   * @throws GitRepositoryError if not in a git repository
   */
  async getRepoRoot(): Promise<string> {
    try {
      const rootPath = await this.git.revparse(['--show-toplevel']);
      return path.resolve(rootPath.trim());
    } catch (error) {
      throw new GitRepositoryError(
        `Not in a git repository: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get current branch name
   * @returns Promise resolving to current branch name
   * @throws GitRepositoryError if unable to determine current branch
   */
  async getCurrentBranch(): Promise<string> {
    try {
      const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
      return branch.trim();
    } catch (error) {
      throw new GitRepositoryError(
        `Unable to get current branch: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if current branch follows feature branch pattern (###-name)
   * @param branch Branch name to check
   * @returns true if branch follows feature pattern, false otherwise
   */
  checkFeatureBranch(branch: string): boolean {
    return FEATURE_BRANCH_PATTERN.test(branch);
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
          `Branch name "${branchName}" does not follow feature pattern (###-name)`
        );
      }

      // Check if branch already exists
      const branches = await this.git.branch();
      if (branches.all.includes(branchName)) {
        throw new FeatureBranchError(`Branch "${branchName}" already exists`);
      }

      // Create and checkout new branch
      await this.git.checkoutLocalBranch(branchName);
    } catch (error) {
      if (error instanceof FeatureBranchError) {
        throw error;
      }
      throw new GitRepositoryError(
        `Unable to create branch "${branchName}": ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if working directory is clean (no uncommitted changes)
   * @returns Promise resolving to true if working directory is clean
   */
  async isWorkingDirectoryClean(): Promise<boolean> {
    try {
      const status = await this.git.status();
      return status.files.length === 0;
    } catch (error) {
      throw new GitRepositoryError(
        `Unable to check git status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get list of all local branches
   * @returns Promise resolving to array of branch names
   */
  async getLocalBranches(): Promise<string[]> {
    try {
      const branches = await this.git.branch();
      return branches.all.filter(branch => !branch.startsWith('remotes/'));
    } catch (error) {
      throw new GitRepositoryError(
        `Unable to get branches: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// Export singleton instance for convenience
export const git = new GitOperations();