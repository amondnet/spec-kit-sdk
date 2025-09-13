/**
 * SpecKitProject Entity
 *
 * Represents the root project with Spec-Driven Development structure.
 * Manages project configuration, validation, and integration with utilities.
 */

import type { SpecKitConfig } from '../contracts/spec-kit-library.js'
import path from 'node:path'
import process from 'node:process'
import { DEFAULT_CONFIG, FEATURE_BRANCH_PATTERN, FileOperationError, GitRepositoryError } from '../contracts/spec-kit-library.js'
import { files, GitOperations, paths } from '../utils'

import { Feature } from './Feature.js'

export class SpecKitProject {
  public readonly repoRoot: string
  public readonly currentBranch: string
  public readonly specsDir: string
  public readonly templatesDir: string

  /**
   * Private constructor - use static factory methods to create instances
   */
  private constructor(
    repoRoot: string,
    currentBranch: string,
    specsDir?: string,
    templatesDir?: string,
  ) {
    this.repoRoot = repoRoot
    this.currentBranch = currentBranch
    this.specsDir = specsDir || path.join(repoRoot, DEFAULT_CONFIG.specsDir!)
    this.templatesDir = templatesDir || path.join(repoRoot, DEFAULT_CONFIG.templatesDir!)
  }

  /**
   * Create SpecKitProject instance from current working directory
   * Validates git repository and initializes project structure
   * @param config Optional configuration overrides
   * @returns Promise resolving to SpecKitProject instance
   * @throws GitRepositoryError if not in a git repository
   */
  static async fromCurrentDirectory(config?: Partial<SpecKitConfig>): Promise<SpecKitProject> {
    try {
      // Create a new GitOperations instance for the current directory
      const gitOps = new GitOperations(process.cwd())

      // Get repository root and validate it's a git repository
      const repoRoot = await gitOps.getRepoRoot()
      const currentBranch = await gitOps.getCurrentBranch()

      // Apply configuration with defaults
      const resolvedConfig = { ...DEFAULT_CONFIG, ...config }
      const specsDir = resolvedConfig.specsDir
        ? path.join(repoRoot, resolvedConfig.specsDir)
        : path.join(repoRoot, 'specs')
      const templatesDir = resolvedConfig.templatesDir
        ? path.join(repoRoot, resolvedConfig.templatesDir)
        : path.join(repoRoot, 'templates')

      const project = new SpecKitProject(repoRoot, currentBranch, specsDir, templatesDir)

      // Validate project structure
      await project.validateStructure()

      return project
    }
    catch (error) {
      if (error instanceof GitRepositoryError) {
        throw error
      }
      throw new GitRepositoryError(
        `Failed to initialize SpecKitProject: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Create SpecKitProject instance from explicit repository path
   * @param repoPath Absolute path to git repository root
   * @param config Optional configuration overrides
   * @returns Promise resolving to SpecKitProject instance
   * @throws GitRepositoryError if path is not a git repository
   */
  static async fromRepoPath(repoPath: string, config?: Partial<SpecKitConfig>): Promise<SpecKitProject> {
    try {
      // Validate the path is absolute
      if (!path.isAbsolute(repoPath)) {
        throw new GitRepositoryError(`Repository path must be absolute: ${repoPath}`)
      }

      // Create git operations instance for this specific path
      const gitOps = new GitOperations(repoPath)

      // Validate it's a git repository by getting the root
      const repoRoot = await gitOps.getRepoRoot()
      if (path.resolve(repoRoot) !== path.resolve(repoPath)) {
        throw new GitRepositoryError(`Path ${repoPath} is not the git repository root (root is ${repoRoot})`)
      }

      const currentBranch = await gitOps.getCurrentBranch()

      // Apply configuration with defaults
      const resolvedConfig = { ...DEFAULT_CONFIG, ...config }
      const specsDir = resolvedConfig.specsDir
        ? path.join(repoRoot, resolvedConfig.specsDir)
        : path.join(repoRoot, 'specs')
      const templatesDir = resolvedConfig.templatesDir
        ? path.join(repoRoot, resolvedConfig.templatesDir)
        : path.join(repoRoot, 'templates')

      const project = new SpecKitProject(repoRoot, currentBranch, specsDir, templatesDir)

      // Validate project structure
      await project.validateStructure()

      return project
    }
    catch (error) {
      if (error instanceof GitRepositoryError) {
        throw error
      }
      throw new GitRepositoryError(
        `Failed to initialize SpecKitProject from ${repoPath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Validate that the project has proper SDD structure
   * Creates necessary directories if they don't exist
   * @throws FileOperationError if validation fails
   */
  async validateStructure(): Promise<void> {
    try {
      // Ensure specs directory exists
      if (!await files.fileExists(this.specsDir)) {
        await files.createDirectory(this.specsDir)
      }
      else if (!await files.isDirectory(this.specsDir)) {
        throw new FileOperationError(`Specs path "${this.specsDir}" exists but is not a directory`)
      }

      // Validate templates directory exists (don't create automatically as templates should be provided)
      if (!await files.fileExists(this.templatesDir)) {
        throw new FileOperationError(`Templates directory does not exist: ${this.templatesDir}`)
      }
      else if (!await files.isDirectory(this.templatesDir)) {
        throw new FileOperationError(`Templates path "${this.templatesDir}" exists but is not a directory`)
      }

      // Validate security: ensure directories are within repository
      if (!paths.isPathWithin(this.repoRoot, this.specsDir)) {
        throw new FileOperationError(`Specs directory "${this.specsDir}" is outside repository root`)
      }
      if (!paths.isPathWithin(this.repoRoot, this.templatesDir)) {
        throw new FileOperationError(`Templates directory "${this.templatesDir}" is outside repository root`)
      }
    }
    catch (error) {
      if (error instanceof FileOperationError) {
        throw error
      }
      throw new FileOperationError(
        `Project structure validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Check if current branch is a feature branch
   * @returns true if current branch follows feature pattern (###-name)
   */
  isOnFeatureBranch(): boolean {
    // Check if branch follows feature pattern (###-name)
    return FEATURE_BRANCH_PATTERN.test(this.currentBranch)
  }

  /**
   * Get all existing features in the project
   * @returns Promise resolving to array of Feature instances
   */
  async getFeatures(): Promise<Feature[]> {
    try {
      const featureDirs = await files.getFeatureDirectories(this.specsDir)
      const features: Feature[] = []

      for (const dirName of featureDirs) {
        const match = dirName.match(/^(\d{3})-(.+)$/)
        if (match) {
          const [, number, name] = match

          // Reconstruct description from the directory name
          const description = name.replace(/-/g, ' ')

          const feature = await Feature.fromExisting(this, number, name, description)
          features.push(feature)
        }
      }

      return features.sort((a, b) => a.number.localeCompare(b.number))
    }
    catch (error) {
      throw new FileOperationError(
        `Failed to get features: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Get current feature if on a feature branch
   * @returns Promise resolving to Feature instance or null if not on feature branch
   */
  async getCurrentFeature(): Promise<Feature | null> {
    if (!this.isOnFeatureBranch()) {
      return null
    }

    const featureNumber = paths.extractFeatureNumber(this.currentBranch)
    if (!featureNumber) {
      return null
    }

    const features = await this.getFeatures()
    return features.find(f => f.number === featureNumber) || null
  }

  /**
   * Create a new feature in this project
   * @param description Feature description
   * @returns Promise resolving to new Feature instance
   */
  async createFeature(description: string): Promise<Feature> {
    return Feature.create(this, description)
  }

  /**
   * Get the next available feature number
   * @returns Promise resolving to zero-padded 3-digit feature number
   */
  async getNextFeatureNumber(): Promise<string> {
    return files.getNextFeatureNumber(this.specsDir)
  }

  /**
   * Get all template file paths available in the project
   * @returns Promise resolving to object with template paths
   */
  async getTemplatePaths(): Promise<{
    spec?: string
    plan?: string
    tasks?: string
  }> {
    const templates: { spec?: string, plan?: string, tasks?: string } = {}

    const specTemplate = paths.getTemplatePath(this.repoRoot, 'spec-template.md')
    const planTemplate = paths.getTemplatePath(this.repoRoot, 'plan-template.md')
    const tasksTemplate = paths.getTemplatePath(this.repoRoot, 'tasks-template.md')

    if (await files.fileExists(specTemplate)) {
      templates.spec = specTemplate
    }
    if (await files.fileExists(planTemplate)) {
      templates.plan = planTemplate
    }
    if (await files.fileExists(tasksTemplate)) {
      templates.tasks = tasksTemplate
    }

    return templates
  }

  /**
   * Refresh project state (re-read current branch)
   * @returns Promise resolving to updated SpecKitProject instance
   */
  async refresh(): Promise<SpecKitProject> {
    return SpecKitProject.fromRepoPath(this.repoRoot)
  }

  /**
   * Get relative path from repository root to any path
   * @param targetPath Path to get relative path for
   * @returns Relative path from repository root
   */
  getRelativePathFromRoot(targetPath: string): string {
    return paths.getRelativePath(this.repoRoot, targetPath)
  }

  /**
   * Convert project to JSON representation for debugging/serialization
   * @returns Object with project properties
   */
  toJSON(): {
    repoRoot: string
    currentBranch: string
    specsDir: string
    templatesDir: string
    isOnFeatureBranch: boolean
  } {
    return {
      repoRoot: this.repoRoot,
      currentBranch: this.currentBranch,
      specsDir: this.specsDir,
      templatesDir: this.templatesDir,
      isOnFeatureBranch: this.isOnFeatureBranch(),
    }
  }
}
