/**
 * Path Utilities
 *
 * Provides path resolution and manipulation utilities for the spec-kit library
 * including feature name sanitization, branch name generation, and standardized
 * path resolution for spec-driven development workflows.
 */

import path from 'path';
import type { FeaturePathsResult, SupportedAgentType } from '../contracts/spec-kit-library.js';
import { SUPPORTED_AGENT_TYPES } from '../contracts/spec-kit-library.js';

export class PathUtilities {
  /**
   * Sanitize feature description into valid branch name component
   * Converts to lowercase, replaces spaces/special chars with hyphens,
   * removes invalid characters, and limits length
   * @param description Feature description to sanitize
   * @returns Sanitized feature name suitable for branch names
   */
  sanitizeFeatureName(description: string): string {
    return description
      .toLowerCase()
      .trim()
      // Replace spaces and underscores with hyphens
      .replace(/[\s_]+/g, '-')
      // Remove special characters except hyphens and alphanumeric
      .replace(/[^a-z0-9-]/g, '')
      // Remove consecutive hyphens
      .replace(/-+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
      // Limit length to reasonable size for branch names
      .substring(0, 50)
      // Ensure we don't end with a hyphen after truncation
      .replace(/-+$/, '');
  }

  /**
   * Generate feature branch name from number and description
   * @param featureNum Zero-padded 3-digit feature number (e.g., "001")
   * @param description Feature description to include in branch name
   * @returns Branch name in format "###-feature-name"
   */
  generateBranchName(featureNum: string, description: string): string {
    const sanitizedName = this.sanitizeFeatureName(description);

    // Ensure we have a valid name after sanitization
    if (!sanitizedName) {
      throw new Error('Feature description must contain at least one alphanumeric character');
    }

    return `${featureNum}-${sanitizedName}`;
  }

  /**
   * Resolve agent configuration file path based on agent type
   * @param repoRoot Absolute path to repository root
   * @param agentType Type of AI agent ("claude", "copilot", "gemini")
   * @returns Absolute path to agent configuration file
   */
  getAgentConfigPath(repoRoot: string, agentType: string): string {
    // Validate agent type
    if (!SUPPORTED_AGENT_TYPES.includes(agentType as SupportedAgentType)) {
      throw new Error(`Unsupported agent type: ${agentType}. Supported types: ${SUPPORTED_AGENT_TYPES.join(', ')}`);
    }

    switch (agentType as SupportedAgentType) {
      case 'claude':
        return path.join(repoRoot, '.claude', 'docs', 'tasks', 'context.md');
      case 'copilot':
        return path.join(repoRoot, '.github', 'copilot', 'context.md');
      case 'gemini':
        return path.join(repoRoot, '.gemini', 'context.md');
      default:
        throw new Error(`Agent type configuration not implemented: ${agentType}`);
    }
  }

  /**
   * Get all standardized paths for a feature branch
   * @param repoRoot Absolute path to repository root
   * @param branch Feature branch name (format: ###-feature-name)
   * @returns Complete set of feature-related file paths
   */
  resolveFeaturePaths(repoRoot: string, branch: string): FeaturePathsResult {
    // Extract feature directory name from branch
    // For branch "001-create-taskify", feature dir is "001-create-taskify"
    const featureDir = path.join(repoRoot, 'specs', branch);

    return {
      REPO_ROOT: repoRoot,
      CURRENT_BRANCH: branch,
      FEATURE_DIR: featureDir,
      FEATURE_SPEC: path.join(featureDir, 'spec.md'),
      IMPL_PLAN: path.join(featureDir, 'plan.md'),
      TASKS: path.join(featureDir, 'tasks.md'),
      RESEARCH: path.join(featureDir, 'research.md'),
      DATA_MODEL: path.join(featureDir, 'data-model.md'),
      QUICKSTART: path.join(featureDir, 'quickstart.md'),
      CONTRACTS_DIR: path.join(featureDir, 'contracts')
    };
  }

  /**
   * Get relative path from one absolute path to another
   * @param from Source absolute path
   * @param to Target absolute path
   * @returns Relative path from source to target
   */
  getRelativePath(from: string, to: string): string {
    return path.relative(from, to);
  }

  /**
   * Resolve template file path relative to templates directory
   * @param repoRoot Absolute path to repository root
   * @param templateName Name of template file (e.g., "spec-template.md")
   * @returns Absolute path to template file
   */
  getTemplatePath(repoRoot: string, templateName: string): string {
    return path.join(repoRoot, 'templates', templateName);
  }

  /**
   * Get specs directory path
   * @param repoRoot Absolute path to repository root
   * @returns Absolute path to specs directory
   */
  getSpecsDir(repoRoot: string): string {
    return path.join(repoRoot, 'specs');
  }

  /**
   * Get templates directory path
   * @param repoRoot Absolute path to repository root
   * @returns Absolute path to templates directory
   */
  getTemplatesDir(repoRoot: string): string {
    return path.join(repoRoot, 'templates');
  }

  /**
   * Extract feature number from branch name
   * @param branchName Branch name in format "###-feature-name"
   * @returns Feature number as string or null if not a feature branch
   */
  extractFeatureNumber(branchName: string): string | null {
    const match = branchName.match(/^(\d{3})-/);
    return match ? match[1] : null;
  }

  /**
   * Check if a path is within another path (security check)
   * @param parentPath Parent directory path
   * @param childPath Child path to check
   * @returns true if child path is within parent path
   */
  isPathWithin(parentPath: string, childPath: string): boolean {
    const resolvedParent = path.resolve(parentPath);
    const resolvedChild = path.resolve(childPath);
    const relativePath = path.relative(resolvedParent, resolvedChild);

    // If relative path starts with .. or is absolute, child is outside parent
    return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
  }

  /**
   * Normalize path separators for cross-platform compatibility
   * @param filePath Path to normalize
   * @returns Path with normalized separators
   */
  normalizePath(filePath: string): string {
    return path.normalize(filePath);
  }
}

// Export singleton instance for convenience
export const paths = new PathUtilities();