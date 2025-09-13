/**
 * TypeScript API Contracts for Spec-Kit Scripts Library
 *
 * These interfaces define the exact API that must be implemented
 * to maintain backward compatibility with existing shell scripts.
 */

// ============================================================================
// CORE RESULT TYPES (Must match existing JSON outputs exactly)
// ============================================================================

export interface CreateFeatureResult {
  /** Feature branch name in format "###-feature-name" */
  BRANCH_NAME: string
  /** Absolute path to the created spec.md file */
  SPEC_FILE: string
  /** Zero-padded 3-digit feature number */
  FEATURE_NUM: string
}

export interface SetupPlanResult {
  /** Absolute path to the feature specification file */
  FEATURE_SPEC: string
  /** Absolute path to the implementation plan file */
  IMPL_PLAN: string
  /** Absolute path to the feature specs directory */
  SPECS_DIR: string
  /** Current feature branch name */
  BRANCH: string
}

export interface UpdateAgentContextResult {
  /** Absolute path to the agent configuration file */
  AGENT_FILE: string
  /** Whether the file was actually updated */
  UPDATED: boolean
  /** Type of agent that was updated */
  AGENT_TYPE: string
}

export interface CheckTaskPrerequisitesResult {
  /** Overall status: "READY" | "MISSING_FILES" | "ERROR" */
  STATUS: string
  /** Array of missing file paths */
  MISSING_FILES: string[]
  /** Boolean indicating if all prerequisites are met */
  READY: boolean
}

export interface FeaturePathsResult {
  /** Absolute path to repository root */
  REPO_ROOT: string
  /** Current feature branch name */
  CURRENT_BRANCH: string
  /** Absolute path to feature directory */
  FEATURE_DIR: string
  /** Absolute path to spec.md file */
  FEATURE_SPEC: string
  /** Absolute path to plan.md file */
  IMPL_PLAN: string
  /** Absolute path to tasks.md file */
  TASKS: string
  /** Absolute path to research.md file */
  RESEARCH: string
  /** Absolute path to data-model.md file */
  DATA_MODEL: string
  /** Absolute path to quickstart.md file */
  QUICKSTART: string
  /** Absolute path to contracts directory */
  CONTRACTS_DIR: string
}

// ============================================================================
// OPTIONS AND CONFIGURATION
// ============================================================================

export interface CommonOptions {
  /** Output results in JSON format */
  json?: boolean
  /** Show help information */
  help?: boolean
}

export interface CreateFeatureOptions extends CommonOptions {
  /** Feature description (required) */
  description: string
}

export interface UpdateAgentContextOptions extends CommonOptions {
  /** Type of AI agent: "claude" | "copilot" | "gemini" */
  agentType: 'claude' | 'copilot' | 'gemini'
}

export interface CheckTaskPrerequisitesOptions extends CommonOptions {
  /** Custom list of required files to check */
  requiredFiles?: string[]
  /** Check for planning prerequisites (plan.md) */
  checkPlanning?: boolean
  /** Require that we're on a feature branch */
  requireFeatureBranch?: boolean
}

// ============================================================================
// CORE API FUNCTIONS
// ============================================================================

export interface SpecKitLibrary {
  /**
   * Creates a new feature specification with auto-incrementing number
   *
   * Equivalent to: create-new-feature.sh/ps1
   *
   * @param description - Feature description for branch name and spec
   * @param options - Configuration options including JSON output
   * @returns Feature creation result with paths and metadata
   * @throws Error if git repository invalid or description empty
   */
  createNewFeature: (
    description: string,
    options?: Pick<CreateFeatureOptions, 'json'>
  ) => Promise<CreateFeatureResult>

  /**
   * Sets up implementation planning phase for current feature
   *
   * Equivalent to: setup-plan.sh/ps1
   *
   * @param options - Configuration options including JSON output
   * @returns Planning setup result with file paths
   * @throws Error if not on feature branch or templates missing
   */
  setupPlan: (options?: CommonOptions) => Promise<SetupPlanResult>

  /**
   * Updates AI agent configuration files with current context
   *
   * Equivalent to: update-agent-context.sh/ps1
   *
   * @param agentType - Type of AI assistant to configure
   * @param options - Configuration options including JSON output
   * @returns Agent update result with file path and status
   * @throws Error if unsupported agent type or file permissions
   */
  updateAgentContext: (
    agentType: 'claude' | 'copilot' | 'gemini',
    options?: Pick<UpdateAgentContextOptions, 'json'>
  ) => Promise<UpdateAgentContextResult>

  /**
   * Checks if all prerequisites exist for task execution
   *
   * Equivalent to: check-task-prerequisites.sh/ps1
   *
   * @param options - Configuration options including JSON output and custom file checks
   * @returns Prerequisites check result with missing files
   * @throws Error if git repository invalid or not on feature branch
   */
  checkTaskPrerequisites: (options?: CheckTaskPrerequisitesOptions) => Promise<CheckTaskPrerequisitesResult>

  /**
   * Gets standardized paths for current feature branch
   *
   * Equivalent to: get-feature-paths.sh/ps1
   *
   * @param options - Configuration options including JSON output
   * @returns Complete set of feature-related file paths
   * @throws Error if not on feature branch or invalid repository
   */
  getFeaturePaths: (options?: CommonOptions) => Promise<FeaturePathsResult>
}

// ============================================================================
// UTILITY INTERFACES
// ============================================================================

export interface GitOperations {
  /** Get absolute path to repository root */
  getRepoRoot: () => Promise<string>

  /** Get current branch name */
  getCurrentBranch: () => Promise<string>

  /** Check if current branch follows feature branch pattern */
  checkFeatureBranch: (branch: string) => boolean

  /** Create and checkout new feature branch */
  createFeatureBranch: (branchName: string) => Promise<void>
}

export interface FileOperations {
  /** Copy template file to destination */
  copyTemplate: (templatePath: string, destPath: string) => Promise<void>

  /** Create directory structure recursively */
  createDirectory: (dirPath: string) => Promise<void>

  /** Check if file exists and is readable */
  fileExists: (filePath: string) => Promise<boolean>

  /** Get next available feature number */
  getNextFeatureNumber: (specsDir: string) => Promise<string>
}

export interface PathUtilities {
  /** Sanitize feature description into valid branch name */
  sanitizeFeatureName: (description: string) => string

  /** Generate feature branch name from number and description */
  generateBranchName: (featureNum: string, description: string) => string

  /** Resolve agent configuration file path */
  getAgentConfigPath: (repoRoot: string, agentType: string) => string

  /** Get all standardized paths for a feature */
  resolveFeaturePaths: (repoRoot: string, branch: string) => FeaturePathsResult
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class SpecKitError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'SpecKitError'
  }
}

export class GitRepositoryError extends SpecKitError {
  constructor(message: string) {
    super(message, 'GIT_REPOSITORY_ERROR')
  }
}

export class FeatureBranchError extends SpecKitError {
  constructor(message: string) {
    super(message, 'FEATURE_BRANCH_ERROR')
  }
}

export class TemplateError extends SpecKitError {
  constructor(message: string) {
    super(message, 'TEMPLATE_ERROR')
  }
}

export class FileOperationError extends SpecKitError {
  constructor(message: string) {
    super(message, 'FILE_OPERATION_ERROR')
  }
}

// ============================================================================
// CLI INTERFACE TYPES
// ============================================================================

export interface CLICommand {
  /** Command name as used in CLI */
  name: string
  /** Command description for help */
  description: string
  /** Command aliases */
  aliases?: string[]
  /** Available options/flags */
  options: CLIOption[]
  /** Execute the command with given arguments */
  execute: (args: string[]) => Promise<void>
}

export interface CLIOption {
  /** Option name (e.g., "json", "help") */
  name: string
  /** Option description */
  description: string
  /** Option aliases (e.g., ["j"] for --json) */
  aliases?: string[]
  /** Whether option requires a value */
  requiresValue?: boolean
  /** Default value if not provided */
  defaultValue?: any
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

export const FEATURE_BRANCH_PATTERN = /^\d{3}-[a-z0-9-]+$/
export const FEATURE_NUMBER_PATTERN = /^\d{3}$/
export const SUPPORTED_AGENT_TYPES = ['claude', 'copilot', 'gemini'] as const

export type SupportedAgentType = typeof SUPPORTED_AGENT_TYPES[number]

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface SpecKitConfig {
  /** Repository root directory */
  repoRoot: string
  /** Specs directory path (default: specs/) */
  specsDir: string
  /** Templates directory path (default: templates/) */
  templatesDir: string
  /** Maximum lines in agent config files */
  maxAgentConfigLines: number
  /** Default agent type for updates */
  defaultAgentType: SupportedAgentType
}

export const DEFAULT_CONFIG: Partial<SpecKitConfig> = {
  specsDir: 'specs',
  templatesDir: '.specify/templates',
  maxAgentConfigLines: 150,
  defaultAgentType: 'claude',
}
