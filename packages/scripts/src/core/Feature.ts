/**
 * Feature Entity
 *
 * Represents a feature specification with auto-incrementing numbers.
 * Manages feature lifecycle, state transitions, and file operations.
 */

import { git, files, paths } from '../utils/index.js';
import type {
  CreateFeatureResult,
  FeaturePathsResult
} from '../contracts/spec-kit-library.js';
import {
  FeatureBranchError,
  FileOperationError,
  FEATURE_BRANCH_PATTERN
} from '../contracts/spec-kit-library.js';
import path from 'path';

// Forward declaration to avoid circular dependency
interface SpecKitProject {
  readonly repoRoot: string;
  readonly currentBranch: string;
  readonly specsDir: string;
  readonly templatesDir: string;
  getTemplatePaths(): Promise<{ spec?: string; plan?: string; tasks?: string }>;
  getNextFeatureNumber(): Promise<string>;
}

/**
 * Feature state enumeration representing the development lifecycle
 */
export enum FeatureState {
  /** Feature branch and directory structure created */
  Created = 'Created',
  /** spec.md written with requirements */
  Specified = 'Specified',
  /** plan.md created with implementation approach */
  Planned = 'Planned',
  /** tasks.md generated with actionable items */
  Tasked = 'Tasked',
  /** Tasks completed and code implemented */
  Implemented = 'Implemented'
}

export class Feature {
  public readonly number: string;
  public readonly name: string;
  public readonly description: string;
  public readonly branchName: string;
  public readonly directory: string;
  public readonly specFile: string;
  public readonly planFile: string;
  public readonly tasksFile: string;
  public readonly researchFile: string;
  public readonly dataModelFile: string;
  public readonly quickstartFile: string;
  public readonly contractsDir: string;

  private readonly project: SpecKitProject;

  /**
   * Private constructor - use static factory methods to create instances
   */
  private constructor(
    project: SpecKitProject,
    number: string,
    name: string,
    description: string
  ) {
    this.project = project;
    this.number = number;
    this.name = name;
    this.description = description;
    this.branchName = `${number}-${name}`;

    // Validate branch name follows pattern
    if (!FEATURE_BRANCH_PATTERN.test(this.branchName)) {
      throw new FeatureBranchError(
        `Generated branch name "${this.branchName}" does not follow feature pattern (###-name)`
      );
    }

    // Calculate all file paths
    const featurePaths = paths.resolveFeaturePaths(project.repoRoot, this.branchName);
    this.directory = featurePaths.FEATURE_DIR;
    this.specFile = featurePaths.FEATURE_SPEC;
    this.planFile = featurePaths.IMPL_PLAN;
    this.tasksFile = featurePaths.TASKS;
    this.researchFile = featurePaths.RESEARCH;
    this.dataModelFile = featurePaths.DATA_MODEL;
    this.quickstartFile = featurePaths.QUICKSTART;
    this.contractsDir = featurePaths.CONTRACTS_DIR;
  }

  /**
   * Create a new feature with auto-incrementing number
   * @param project SpecKitProject instance
   * @param description Feature description
   * @returns Promise resolving to new Feature instance
   * @throws FeatureBranchError if description is invalid
   * @throws FileOperationError if feature creation fails
   */
  static async create(project: SpecKitProject, description: string): Promise<Feature> {
    try {
      // Validate description
      if (!description || typeof description !== 'string') {
        throw new FeatureBranchError('Feature description is required');
      }

      const trimmedDescription = description.trim();
      if (!trimmedDescription) {
        throw new FeatureBranchError('Feature description cannot be empty');
      }

      // Get next feature number
      const featureNumber = await project.getNextFeatureNumber();

      // Sanitize feature name
      const featureName = paths.sanitizeFeatureName(trimmedDescription);
      if (!featureName) {
        throw new FeatureBranchError('Feature description must contain at least one alphanumeric character');
      }

      // Create feature instance
      const feature = new Feature(project, featureNumber, featureName, trimmedDescription);

      // Create feature branch
      await git.createFeatureBranch(feature.branchName);

      // Create feature directory structure
      await feature.createDirectoryStructure();

      // Copy spec template if available
      await feature.initializeSpecFile();

      return feature;
    } catch (error) {
      if (error instanceof FeatureBranchError || error instanceof FileOperationError) {
        throw error;
      }
      throw new FileOperationError(
        `Failed to create feature: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create Feature instance from existing feature directory
   * @param project SpecKitProject instance
   * @param number Feature number (e.g., "001")
   * @param name Feature name (sanitized)
   * @param description Original feature description
   * @returns Feature instance
   */
  static async fromExisting(
    project: SpecKitProject,
    number: string,
    name: string,
    description: string
  ): Promise<Feature> {
    const feature = new Feature(project, number, name, description);

    // Validate that the feature directory exists
    if (!await files.fileExists(feature.directory)) {
      throw new FileOperationError(`Feature directory does not exist: ${feature.directory}`);
    }

    return feature;
  }

  /**
   * Create the directory structure for this feature
   * @throws FileOperationError if directory creation fails
   */
  private async createDirectoryStructure(): Promise<void> {
    try {
      // Create main feature directory
      await files.createDirectory(this.directory);

      // Create contracts subdirectory
      await files.createDirectory(this.contractsDir);
    } catch (error) {
      throw new FileOperationError(
        `Failed to create directory structure for feature ${this.branchName}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Initialize spec file by copying template
   * @throws FileOperationError if template operations fail
   */
  private async initializeSpecFile(): Promise<void> {
    try {
      const templates = await this.project.getTemplatePaths();

      if (templates.spec) {
        // Copy spec template to feature directory
        await files.copyTemplate(templates.spec, this.specFile);

        // Replace template placeholders with feature information
        await this.replaceTemplateVariables(this.specFile);
      } else {
        // Create basic spec file if no template available
        const basicSpec = `# Feature ${this.number}: ${this.description}\n\n## Description\n\n${this.description}\n\n## Requirements\n\n- [ ] To be defined\n\n## Acceptance Criteria\n\n- [ ] To be defined\n`;
        await files.writeFile(this.specFile, basicSpec);
      }
    } catch (error) {
      throw new FileOperationError(
        `Failed to initialize spec file for feature ${this.branchName}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Replace template variables in a file with feature-specific values
   * @param filePath Path to file to process
   */
  private async replaceTemplateVariables(filePath: string): Promise<void> {
    try {
      if (!await files.fileExists(filePath)) {
        return;
      }

      let content = await files.readFile(filePath);

      // Replace common template variables
      content = content
        .replace(/\[FEATURE NUMBER\]/g, this.number)
        .replace(/\[FEATURE NAME\]/g, this.description)
        .replace(/\[FEATURE BRANCH\]/g, this.branchName)
        .replace(/\[FEATURE_NUMBER\]/g, this.number)
        .replace(/\[FEATURE_NAME\]/g, this.description)
        .replace(/\[FEATURE_BRANCH\]/g, this.branchName);

      await files.writeFile(filePath, content);
    } catch (error) {
      throw new FileOperationError(
        `Failed to replace template variables in ${filePath}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Initialize plan file by copying template
   * @throws FileOperationError if template operations fail
   */
  async initializePlanFile(): Promise<void> {
    try {
      const templates = await this.project.getTemplatePaths();

      if (templates.plan) {
        await files.copyTemplate(templates.plan, this.planFile);
        await this.replaceTemplateVariables(this.planFile);
      } else {
        const basicPlan = `# Implementation Plan: ${this.description}\n\n## Overview\n\nImplementation plan for feature ${this.number}.\n\n## Technical Approach\n\n- [ ] To be defined\n\n## Architecture\n\n- [ ] To be defined\n\n## Implementation Steps\n\n1. [ ] Step 1\n2. [ ] Step 2\n3. [ ] Step 3\n`;
        await files.writeFile(this.planFile, basicPlan);
      }
    } catch (error) {
      throw new FileOperationError(
        `Failed to initialize plan file for feature ${this.branchName}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Initialize tasks file by copying template
   * @throws FileOperationError if template operations fail
   */
  async initializeTasksFile(): Promise<void> {
    try {
      const templates = await this.project.getTemplatePaths();

      if (templates.tasks) {
        await files.copyTemplate(templates.tasks, this.tasksFile);
        await this.replaceTemplateVariables(this.tasksFile);
      } else {
        const basicTasks = `# Tasks: ${this.description}\n\n## Implementation Tasks\n\n### Core Tasks\n\n- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3\n\n### Testing Tasks\n\n- [ ] Write unit tests\n- [ ] Write integration tests\n- [ ] Test documentation\n\n### Documentation Tasks\n\n- [ ] Update documentation\n- [ ] Update README if needed\n`;
        await files.writeFile(this.tasksFile, basicTasks);
      }
    } catch (error) {
      throw new FileOperationError(
        `Failed to initialize tasks file for feature ${this.branchName}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Get current state of the feature based on existing files
   * @returns Promise resolving to current FeatureState
   */
  async getCurrentState(): Promise<FeatureState> {
    try {
      // Check what files exist to determine state
      const [specExists, planExists, tasksExists] = await Promise.all([
        files.fileExists(this.specFile),
        files.fileExists(this.planFile),
        files.fileExists(this.tasksFile)
      ]);

      if (tasksExists) {
        // Check if tasks are completed (this is a simplified check)
        return FeatureState.Tasked;
      } else if (planExists) {
        return FeatureState.Planned;
      } else if (specExists) {
        return FeatureState.Specified;
      } else {
        return FeatureState.Created;
      }
    } catch (error) {
      throw new FileOperationError(
        `Failed to determine feature state for ${this.branchName}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Check if all prerequisite files exist for task execution
   * @returns Promise resolving to array of missing file paths
   */
  async checkPrerequisites(): Promise<string[]> {
    const requiredFiles = [this.specFile, this.planFile];
    const missingFiles: string[] = [];

    for (const filePath of requiredFiles) {
      if (!await files.fileExists(filePath)) {
        missingFiles.push(filePath);
      }
    }

    return missingFiles;
  }

  /**
   * Get all file paths for this feature in the contract format
   * @returns FeaturePathsResult object
   */
  getFeaturePaths(): FeaturePathsResult {
    return paths.resolveFeaturePaths(this.project.repoRoot, this.branchName);
  }

  /**
   * Get create feature result in contract format
   * @returns CreateFeatureResult object
   */
  getCreateResult(): CreateFeatureResult {
    return {
      BRANCH_NAME: this.branchName,
      SPEC_FILE: this.specFile,
      FEATURE_NUM: this.number
    };
  }

  /**
   * Check if this feature is currently checked out
   * @returns true if current branch matches this feature's branch
   */
  isCurrentFeature(): boolean {
    return this.project.currentBranch === this.branchName;
  }

  /**
   * Get relative paths from repository root
   * @returns Object with relative paths for easy display
   */
  getRelativePaths(): {
    directory: string;
    specFile: string;
    planFile: string;
    tasksFile: string;
    researchFile: string;
    dataModelFile: string;
    quickstartFile: string;
    contractsDir: string;
  } {
    return {
      directory: paths.getRelativePath(this.project.repoRoot, this.directory),
      specFile: paths.getRelativePath(this.project.repoRoot, this.specFile),
      planFile: paths.getRelativePath(this.project.repoRoot, this.planFile),
      tasksFile: paths.getRelativePath(this.project.repoRoot, this.tasksFile),
      researchFile: paths.getRelativePath(this.project.repoRoot, this.researchFile),
      dataModelFile: paths.getRelativePath(this.project.repoRoot, this.dataModelFile),
      quickstartFile: paths.getRelativePath(this.project.repoRoot, this.quickstartFile),
      contractsDir: paths.getRelativePath(this.project.repoRoot, this.contractsDir)
    };
  }

  /**
   * Convert feature to JSON representation for debugging/serialization
   * @returns Object with feature properties
   */
  toJSON(): {
    number: string;
    name: string;
    description: string;
    branchName: string;
    directory: string;
    specFile: string;
    planFile: string;
    tasksFile: string;
    researchFile: string;
    dataModelFile: string;
    quickstartFile: string;
    contractsDir: string;
    isCurrentFeature: boolean;
  } {
    return {
      number: this.number,
      name: this.name,
      description: this.description,
      branchName: this.branchName,
      directory: this.directory,
      specFile: this.specFile,
      planFile: this.planFile,
      tasksFile: this.tasksFile,
      researchFile: this.researchFile,
      dataModelFile: this.dataModelFile,
      quickstartFile: this.quickstartFile,
      contractsDir: this.contractsDir,
      isCurrentFeature: this.isCurrentFeature()
    };
  }
}